const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
const messages = [];
const clientChats = [];

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
  client.write('position', { x: 10, y: 64, z: -5, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
  client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
  client.on('chat', ({ message }) => clientChats.push(message));
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  const pluginsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mynbot-ext-plugin-'));
  fs.writeFileSync(path.join(pluginsDir, 'vec3-test.cjs'), `
    'use strict';
    const Vec3 = require('vec3');
    module.exports = {
      setup(bot, ctx) {
        const pos = bot.entity && bot.entity.position;
        if (!pos) throw new Error('bot.entity.position missing in setup');
        const v = new Vec3(pos.x, pos.y, pos.z);
        ctx.log('spawn-pos:' + v.x + ',' + v.y + ',' + v.z);
        return () => ctx.log('vec3-test-cleaned-up');
      },
    };
  `);
  fs.writeFileSync(path.join(pluginsDir, 'broken.cjs'), `
    'use strict';
    module.exports = {
      setup() { throw new Error('intentional-plugin-error'); },
    };
  `);

  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.16.5' },
      pluginsDir,
      plugins: {
        enabledScripts: ['vec3-test.cjs', 'broken.cjs'],
      },
    });

    await wait(() => messages.some(m => m.type === 'status' && m.state === 'connected'), 'connected');
    await wait(() => messages.some(m => m.type === 'log' && m.message.includes('spawn-pos:10,64,-5')), 'vec3 plugin loaded after spawn with entity.position');
    await wait(() => messages.some(m => m.type === 'automation' && m.automation?.['script:broken.cjs']?.state === 'error'), 'broken plugin reported error status');

    // Live reload via update-plugins (disable both)
    worker.send({
      action: 'update-plugins',
      username: 'LocalTest',
      pluginsDir,
      plugins: { enabledScripts: [] },
    });
    await wait(() => messages.some(m => m.type === 'log' && m.message.includes('vec3-test-cleaned-up')), 'live unload cleanup');

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: external plugin resolves vec3, runs after spawn with bot.entity, reports errors, and live-reloads');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    server.close();
    fs.rmSync(pluginsDir, { recursive: true, force: true });
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
