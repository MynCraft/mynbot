const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
const messages = [];
const serverPositions = [];

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
  // Intentionally do NOT send any map_chunk packets
  client.write('position', { x: 0, y: 64, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
  client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });

  client.on('position', pkt => serverPositions.push(pkt));
  client.on('position_look', pkt => serverPositions.push(pkt));
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.16.5' },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'connected');
    await new Promise(r => setTimeout(r, 600));

    const poses = messages.filter(m => m.type === 'pose').map(m => m.pose);
    assert(poses.length > 0, 'Should have at least one pose');
    const lastPose = poses[poses.length - 1];
    assert.equal(lastPose.chunkLoaded, false, 'chunkLoaded must be false when no chunks were sent');
    assert.equal(lastPose.y, 64, 'Bot must NOT fall in Y when chunks are unloaded');
    assert.equal(serverPositions.some(p => p.y < 63.9), false, 'Server must NOT receive falling position packets');

    // step-control and move-to should reject when chunk is unloaded
    worker.send({ action: 'step-control', username: 'LocalTest', control: 'forward', durationMs: 200 });
    await wait(() => messages.some(m => m.type === 'operation-error' && m.message.includes('Dünya henüz yüklenmedi')), 'step-control unloaded error');

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: bot does not fall or send movement in unloaded chunks');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
