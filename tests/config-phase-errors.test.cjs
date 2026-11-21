'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.21.4');

const messages = [];
Object.defineProperty(process, 'connected', { value: true, configurable: true });
process.send = m => messages.push(m);
const { bots } = require(path.join(root, 'public/bot-worker.cjs'));

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.21.4', 'online-mode': false, keepAlive: false });
let serverClient = null;
let holdConfigResolve = null;

server.on('login', client => {
  serverClient = client;
  // Intercept finish_configuration slightly so we can emit a Parse error while loggedIn=false in configuration phase
  const origWrite = client.write.bind(client);
  client.write = (name, params) => {
    if (name === 'finish_configuration') {
      setTimeout(() => origWrite(name, params), 250);
      return;
    }
    return origWrite(name, params);
  };
});

server.on('playerJoin', client => {
  serverClient = client;
  client.write('login', { ...mcData.loginPacket, entityId: client.id });
  client.write('position', {
    teleportId: 1,
    x: 0, y: 64, z: 0, dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0,
    flags: { x: false, y: false, z: false, yRot: false, xRot: false, dx: false, dy: false, dz: false, rotateDelta: false },
  });
  client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  try {
    process.emit('message', {
      action: 'connect',
      bot: { username: 'ConfigBot', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.21.4' },
      plugins: {
        antiAfk: { enabled: true, intervalSeconds: 5, jump: true, rotate: true },
        commandScheduler: { enabled: true, tasks: [{ id: 't1', command: '/ping', intervalSeconds: 5, enabled: true }] },
      },
    });

    await wait(() => bots.get('ConfigBot')?._client != null, 'bot._client created');
    const bot = bots.get('ConfigBot');

    // 1. Emit non-fatal Parse error while in configuration (loggedIn === false!)
    bot._client.emit('error', new Error('Parse error for configuration.toClient.custom'));
    await wait(() => messages.some(m => m.type === 'operation-error' && m.message.includes('Parse error')), 'operation-error in configuration');

    const errorStatusesBeforePlay = messages.filter(m => m.type === 'status' && m.state === 'error');
    assert.equal(errorStatusesBeforePlay.length, 0, 'Non-fatal Parse error in configuration phase must NOT set status=error');

    // 2. Wait for play transition & connected
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'connected after configuration');

    // 3. Simulate start_configuration (Bungee/Velocity sub-server switch)
    serverClient.write('start_configuration', {});
    await wait(() => messages.some(m => m.type === 'log' && m.message.includes('configuration')), 'start_configuration handled');
    assert.equal(bot.physicsEnabled, false, 'physicsEnabled must pause during start_configuration');

    await new Promise(r => setTimeout(r, 150));
    const serErrors = messages.filter(m => (m.message || '').toLowerCase().includes('serialization error'));
    assert.equal(serErrors.length, 0, 'Must not emit Serialization error after start_configuration');

    // Return to play via finish_configuration + login so cleanup/disconnect is clean
    serverClient.write('finish_configuration', {});
    await new Promise(r => setTimeout(r, 80));

    process.emit('message', { action: 'disconnect', username: 'ConfigBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: 1.21.4 configuration Parse error and start_configuration transitions stay error-free');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    void holdConfigResolve;
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
