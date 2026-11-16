const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
let worker, peer;
let loginCount = 0;
const messages = [];

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

server.on('login', client => {
  loginCount++;
  peer = client;
  client.write('login', {
    ...mcData.loginPacket,
    entityId: client.id,
    isHardcore: false,
    gameMode: 0,
    previousGameMode: 1,
    hashedSeed: [0, 0],
    maxPlayers: 4,
    viewDistance: 4,
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false,
  });
  client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
  client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    const port = server.socketServer.address().port;
    worker.send({
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port, version: '1.16.5' },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'first connected');

    // Kick the bot
    peer.write('kick_disconnect', { reason: JSON.stringify({ text: 'Restarting' }) });
    peer.end();

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'error'), 'error after kick');

    // Immediately reconnect (also test duplicate connect while already connecting/existing)
    const beforeIdx = messages.length;
    worker.send({
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port, version: '1.16.5' },
      plugins: {},
    });

    await wait(() => messages.slice(beforeIdx).some(m => m.type === 'status' && m.state === 'connected'), 'reconnected after kick');
    assert.equal(loginCount, 2, 'Should have logged in twice');

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.slice(beforeIdx).some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: reconnect after kick succeeds without getting stuck in connecting');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
