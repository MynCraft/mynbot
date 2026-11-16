const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const messages = [];
const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

// 1. Working 1.16.5 server for HealthyBot
const healthyServer = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
healthyServer.on('login', client => {
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
  client.on('chat', ({ message }) => {
    client.write('chat', { message: JSON.stringify({ text: 'echo:' + message }), position: 0, sender: '00000000-0000-0000-0000-000000000000' });
  });
});

// 2. Mock server that responds to status ping with unsupported protocol 9999 (e.g. 1.21.11)
const unsupportedServer = mc.createServer({
  host: '127.0.0.1',
  port: 0,
  version: '1.21.8',
  'online-mode': false,
  keepAlive: false,
  beforePing: response => {
    response.version = { name: '1.21.11', protocol: 9999 };
  },
});

Promise.all([
  new Promise(r => healthyServer.once('listening', r)),
  new Promise(r => unsupportedServer.once('listening', r)),
]).then(async () => {
  let worker;
  let exited = false;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.on('exit', () => { exited = true; });
    worker.stderr.on('data', b => process.stderr.write(b));

    // Connect HealthyBot first
    worker.send({
      action: 'connect',
      bot: { username: 'HealthyBot', host: '127.0.0.1', port: healthyServer.socketServer.address().port, version: '1.16.5' },
      plugins: {},
    });
    await wait(() => messages.some(m => m.username === 'HealthyBot' && m.type === 'status' && m.state === 'connected'), 'HealthyBot connected');

    // Connect AutoBot (no version) to unsupported server
    worker.send({
      action: 'connect',
      bot: { username: 'AutoBot', host: '127.0.0.1', port: unsupportedServer.socketServer.address().port },
      plugins: {},
    });

    await wait(
      () => messages.some(m => m.username === 'AutoBot' && m.type === 'log' && m.message.includes('desteklenmiyor') && m.message.includes('ViaVersion')),
      'unsupported version log'
    );

    assert.equal(exited, false, 'Worker must NOT crash on unsupported server version');

    // HealthyBot must still be alive and able to chat
    worker.send({ action: 'chat', username: 'HealthyBot', message: 'ping-ok' });
    await wait(() => messages.some(m => m.username === 'HealthyBot' && m.type === 'chat' && m.text === 'echo:ping-ok'), 'HealthyBot chat after unsupported connect');

    worker.send({ action: 'disconnect', username: 'HealthyBot' });
    worker.send({ action: 'disconnect', username: 'AutoBot' });
    console.log('PASS: unsupported server version does not crash worker and keeps other bots alive');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    healthyServer.close();
    unsupportedServer.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
