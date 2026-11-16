const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const messages = [];
Object.defineProperty(process, 'connected', { value: true, configurable: true });
process.send = m => messages.push(m);
const { bots } = require(path.join(root, 'public/bot-worker.cjs'));

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
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
    reducedDebugInfo: false,
    enableRespawnScreen: true,
    isDebug: false,
    isFlat: false,
  });
  client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
  client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
  client.on('chat', ({ message }) => {
    client.write('chat', {
      message: JSON.stringify({ text: 'echo:' + message }),
      position: 0,
      sender: '00000000-0000-0000-0000-000000000000',
    });
  });
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  try {
    process.emit('message', {
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.16.5' },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'initial connected');

    const bot = bots.get('LocalTest');
    assert(bot && bot._client, 'bot instance should exist');

    // Emit non-fatal protocol error directly on _client (H1 acceptance criterion)
    bot._client.emit('error', new Error('Parse error for play.toClient.custom'));

    await wait(() => messages.some(m => m.type === 'operation-error' && m.message.includes('Parse error')), 'operation-error emitted');

    const connectedIdx = messages.findIndex(m => m.type === 'status' && m.state === 'connected');
    const postStatuses = messages.slice(connectedIdx + 1).filter(m => m.type === 'status');
    assert.equal(postStatuses.some(m => m.state === 'error' || m.state === 'disconnected'), false, 'Bot must stay connected on non-fatal protocol error');

    process.emit('message', { action: 'chat', username: 'LocalTest', message: 'still-alive' });
    await wait(() => messages.some(m => m.type === 'chat' && m.text === 'echo:still-alive'), 'chat after non-fatal error');

    process.emit('message', { action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: non-fatal protocol error keeps bot connected and chat working');
  } catch (e) {
    console.error(e, 'messages:', messages);
    process.exitCode = 1;
  } finally {
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
