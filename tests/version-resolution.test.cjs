'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const net = require('node:net');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));

const wait = (predicate, label, timeout = 14000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

// Helper: create a 1.18.1 / 1.17 / 1.16.1 server using closest supported mcData login packet
async function testAutoVersionServer(version, dropPong = false) {
  const mcData = require(path.join(root, 'node_modules/minecraft-data'))(version);
  const server = mc.createServer({
    host: '127.0.0.1',
    port: 0,
    version,
    'online-mode': false,
    keepAlive: false,
  });

  if (dropPong) {
    server.on('connection', client => {
      const origOn = client.on.bind(client);
      // Swallow status 'ping' so server_info is sent but pong is never returned
      client.on('ping', () => {});
      void origOn;
    });
  }

  server.on('login', client => {
    const lp = mcData.loginPacket;
    client.write('login', {
      ...lp,
      entityId: client.id,
      isHardcore: false,
      gameMode: 0,
      previousGameMode: 1,
      hashedSeed: [0, 0],
      maxPlayers: 4,
      viewDistance: 4,
      simulationDistance: 4,
      reducedDebugInfo: false,
      enableRespawnScreen: true,
      isDebug: false,
      isFlat: false,
    });
    client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
    client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
  });

  await new Promise(r => server.once('listening', r));
  let worker;
  const messages = [];
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'VerBot', host: '127.0.0.1', port: server.socketServer.address().port },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), `connected ${version}`);
    const unsupportedLog = messages.some(m => m.type === 'log' && m.message.includes('desteklenmiyor'));
    assert.equal(unsupportedLog, false, `${version} must NOT be rejected as unsupported or fall back to 1.21.8`);

    worker.send({ action: 'disconnect', username: 'VerBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), `disconnect ${version}`);
  } finally {
    worker?.kill();
    server.close();
  }
}

// Server that drops pong explicitly by hijacking raw status ping_start -> server_info without ping reply
async function testNoPongStatusServer() {
  const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.18.1');
  // Use mc.createServer and intercept client ping_start before default handler replies to ping
  const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.18.1', 'online-mode': false, keepAlive: false });
  server.on('connection', client => {
    const origEmit = client.emit.bind(client);
    client.emit = function (event, ...args) {
      if (event === 'ping') return false; // drop client's ping packet -> server never sends pong!
      return origEmit(event, ...args);
    };
  });
  server.on('login', client => {
    client.write('login', {
      ...mcData.loginPacket,
      entityId: client.id,
      isHardcore: false,
      gameMode: 0,
      previousGameMode: 1,
      hashedSeed: [0, 0],
      maxPlayers: 4,
      viewDistance: 4,
      simulationDistance: 4,
      reducedDebugInfo: false,
      enableRespawnScreen: true,
      isDebug: false,
      isFlat: false,
    });
    client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
    client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
  });

  await new Promise(r => server.once('listening', r));
  let worker;
  const messages = [];
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    const start = Date.now();
    worker.send({
      action: 'connect',
      bot: { username: 'NoPongBot', host: '127.0.0.1', port: server.socketServer.address().port },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'connected when pong dropped');
    assert.ok(Date.now() - start < 4500, 'should resolve well under 5s even when pong is dropped');

    worker.send({ action: 'disconnect', username: 'NoPongBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect nopong');
  } finally {
    worker?.kill();
    server.close();
  }
}

// Server with enable-status=false (closes socket on status query, accepts login)
async function testPingDisabledFallback() {
  const closedOnStatusServer = net.createServer(socket => {
    socket.once('data', buf => {
      // Check handshake nextState (last byte is 1 for status, 2 for login)
      if (buf[buf.length - 1] === 1 || buf.includes(0x00)) {
        // Close immediately on status ping
        socket.destroy();
      }
    });
  });
  await new Promise(r => closedOnStatusServer.listen(0, '127.0.0.1', r));
  let worker;
  const messages = [];
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.send({
      action: 'connect',
      bot: { username: 'StatusOffBot', host: '127.0.0.1', port: closedOnStatusServer.address().port },
      plugins: {},
    });
    await wait(
      () => messages.some(m => m.type === 'log' && m.message.includes('status ping yanıtı alınamadı')),
      'ping fallback warning logged'
    );
    worker.send({ action: 'disconnect', username: 'StatusOffBot' });
  } finally {
    worker?.kill();
    closedOnStatusServer.close();
  }
}

(async () => {
  await testAutoVersionServer('1.18.1');
  await testAutoVersionServer('1.17');
  await testAutoVersionServer('1.16.1');
  await testNoPongStatusServer();
  await testPingDisabledFallback();
  console.log('PASS: auto version resolves 1.18.1/1.17/1.16.1, survives dropped pong, and falls back when status is disabled');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 150);
});
