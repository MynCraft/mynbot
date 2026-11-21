'use strict';
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 30);
});

// 1. B7: Early disconnect before inject_allowed (instance.quit undefined) must not throw TypeError & must close socket
async function testEarlyDisconnect() {
  let socketClosed = false;
  let socketConnected = false;
  const tcpServer = net.createServer(socket => {
    socketConnected = true;
    socket.on('close', () => { socketClosed = true; });
  });
  await new Promise(r => tcpServer.listen(0, '127.0.0.1', r));

  let worker;
  const messages = [];
  const stderrChunks = [];
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => stderrChunks.push(String(b)));

    worker.send({
      action: 'connect',
      bot: { username: 'EarlyBot', host: '127.0.0.1', port: tcpServer.address().port, version: '1.21.1' },
      plugins: {},
    });

    await wait(() => socketConnected, 'TCP socket connected');
    // Immediately send disconnect (before handshake / inject_allowed completes)
    worker.send({ action: 'disconnect', username: 'EarlyBot' });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnected emitted');
    await wait(() => socketClosed, 'underlying TCP socket closed cleanly');

    const stderrText = stderrChunks.join('');
    assert.equal(/TypeError|is not a function/i.test(stderrText), false, 'Must not throw TypeError on early disconnect');
    assert.equal(
      messages.some(m => /TypeError|is not a function/i.test(m.message || '')),
      false,
      'Must not report TypeError in worker logs'
    );
  } finally {
    worker?.kill();
    tcpServer.close();
  }
}

// 2. B8: BotManager 30s timeout double reconnect count, stale disconnected IPC race, and operation-error banner
async function testBotManagerRaces() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mynbot-races-'));
  try {
    buildSync({
      entryPoints: [path.join(root, 'electron/services/botManager.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(dir, 'botManager.cjs'),
    });

    // Mock worker that delays 'disconnected' response by 120ms to trigger stale IPC race & timeout double-count
    const mockWorkerPath = path.join(dir, 'mock-worker.cjs');
    await fs.writeFile(mockWorkerPath, `
      'use strict';
      process.on('message', msg => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.action === 'connect') {
          const u = msg.bot.username;
          const sid = msg.sessionId;
          process.send({ type: 'status', username: u, state: 'connecting', sessionId: sid });
          if (u === 'RaceBot') {
            // Only complete login on the 2nd connect attempt
            if (sid >= 2) {
              setTimeout(() => {
                process.send({ type: 'status', username: u, state: 'connected', sessionId: sid });
              }, 160);
            }
          }
        } else if (msg.action === 'disconnect') {
          const u = msg.username;
          const sid = msg.sessionId;
          setTimeout(() => {
            process.send({ type: 'status', username: u, state: 'disconnected', sessionId: sid });
          }, 120);
        } else if (msg.action === 'trigger-op-err') {
          process.send({ type: 'operation-error', username: msg.username, message: 'Geçici işlem hatası' });
        }
      });
    `, 'utf8');

    const { BotManager } = require(path.join(dir, 'botManager.cjs'));

    // Intercept setTimeout ONLY for 30_000 ms connect timer so timeout test finishes in ~240ms (>160ms connect)!
    const origSetTimeout = global.setTimeout;
    global.setTimeout = (fn, delay, ...args) => {
      const effectiveDelay = delay === 30_000 ? 240 : (delay === 1000 ? 30 : delay);
      return origSetTimeout(fn, effectiveDelay, ...args);
    };

    const manager = new BotManager(mockWorkerPath, dir, () => {});
    // Override runtime() to use current Node binary directly (works regardless of PATH)
    manager.runtime = () => process.execPath;

    const basePlugins = {
      autoReconnect: { enabled: true, delaySeconds: 1, maxAttempts: 1 },
    };

    try {
      // A) Stale disconnect vs immediate reconnect race
      manager.connect({ username: 'RaceBot', host: '127.0.0.1', port: 25565, version: '1.21.1', plugins: basePlugins });
      manager.disconnect('RaceBot');
      manager.connect({ username: 'RaceBot', host: '127.0.0.1', port: 25565, version: '1.21.1', plugins: basePlugins });

      // Wait for delayed disconnect (120ms) and session 2 connect (160ms)
      await wait(() => manager.statuses['RaceBot']?.state === 'connected', 'RaceBot connected despite stale disconnected IPC');

      // Check operation-error does NOT overwrite statuses[username].message
      manager.worker.send({ type: 'operation-error', username: 'RaceBot' });
      manager.send({ action: 'trigger-op-err', username: 'RaceBot' });
      await wait(() => manager.data['RaceBot']?.lastError === 'Geçici işlem hatası', 'lastError recorded');
      assert.equal(manager.statuses['RaceBot']?.message, undefined, 'operation-error must NOT pollute statuses[username].message');

      // B) 30s timeout with maxAttempts=1 must schedule 1 reconnect (NOT double-increment to 2/1 and stop!)
      manager.connect({ username: 'TimeoutBot', host: '127.0.0.1', port: 25565, version: '1.21.1', plugins: basePlugins });
      // Wait for timeout (240ms) + delayed worker disconnected (120ms) + reconnect timer (30ms)
      await new Promise(r => origSetTimeout(r, 420));
      const attempts = manager.reconnectAttempts.get('TimeoutBot') || 0;
      assert.equal(attempts, 1, `maxAttempts=1 after single 30s timeout must count 1 attempt (got ${attempts})`);
      const stoppedLog = (manager.data['TimeoutBot']?.logs || []).some(l => l.includes('Otomatik yeniden bağlanma:'));
      assert.equal(stoppedLog, true, 'Reconnect must actually be scheduled on first timeout with maxAttempts=1');
    } finally {
      global.setTimeout = origSetTimeout;
      manager.shutdown();
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

(async () => {
  await testEarlyDisconnect();
  await testBotManagerRaces();
  console.log('PASS: early disconnect socket cleanup, stale IPC token protection, operation-error isolation, and single reconnect counting');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 150);
});
