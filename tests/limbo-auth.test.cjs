'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
const messages = [];
const clientChats = [];

server.on('login', client => {
  // Limbo server: sends login + position + chat + open_window, NO update_health!
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
  client.write('chat', {
    message: JSON.stringify({ text: 'LimboAuth: Lütfen /login <şifre> yazın' }),
    position: 0,
    sender: '00000000-0000-0000-0000-000000000000',
  });
  // Also send a captcha GUI open_window + window_items
  setTimeout(() => {
    client.write('open_window', {
      windowId: 1,
      inventoryType: 2, // 9x3 generic
      windowTitle: JSON.stringify({ text: 'Captcha Doğrulama' }),
    });
    const items = Array.from({ length: 27 + 36 }, () => ({ present: false }));
    items[13] = { present: true, itemId: mcData.itemsByName.emerald.id, itemCount: 1 };
    client.write('window_items', { windowId: 1, items });
  }, 100);

  client.on('chat', ({ message }) => clientChats.push(message));
});

server.on('listening', async () => {
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'LimboBot', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.16.5' },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'limbo connected without update_health');
    await wait(() => messages.some(m => m.type === 'inventory' && m.openWindow && m.openWindow.title.includes('Captcha')), 'captcha openWindow received');

    worker.send({ action: 'chat', username: 'LimboBot', message: '/login mypass' });
    await wait(() => clientChats.includes('/login mypass'), 'chat works in limbo');

    // Verify limbo log was recorded
    assert.ok(messages.some(m => m.type === 'log' && m.message.includes('Limbo/Auth')), 'Limbo activation log expected');

    worker.send({ action: 'disconnect', username: 'LimboBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'limbo disconnect');

    console.log('PASS: Limbo server without update_health transitions to connected, forwards openWindow, and allows chat');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
