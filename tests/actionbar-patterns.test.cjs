const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
const messages = [];
const clientChats = [];
let actionbarTimer = null;

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

  client.on('chat', ({ message }) => clientChats.push(message));

  let tick = 0;
  actionbarTimer = setInterval(() => {
    if (client.state !== 'play') return;
    tick++;
    // position: 2 is game_info (actionbar) in 1.16.5
    client.write('chat', {
      message: JSON.stringify({ text: `HP: 20 | Ping: ${tick}ms` }),
      position: 2,
      sender: '00000000-0000-0000-0000-000000000000',
    });
  }, 150);

  setTimeout(() => {
    client.write('chat', { message: JSON.stringify({ text: 'Hoş geldin!' }), position: 0, sender: '00000000-0000-0000-0000-000000000000' });
    setTimeout(() => {
      client.write('chat', { message: JSON.stringify({ text: 'Giriş için /login yaz' }), position: 0, sender: '00000000-0000-0000-0000-000000000000' });
    }, 220);
  }, 300);

  setTimeout(() => {
    client.write('chat', { message: JSON.stringify({ text: '=== YENİ PM ===' }), position: 0, sender: '00000000-0000-0000-0000-000000000000' });
    setTimeout(() => {
      client.write('chat', { message: JSON.stringify({ text: 'Alice > selam bot' }), position: 0, sender: '00000000-0000-0000-0000-000000000000' });
    }, 220);
  }, 900);
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
      plugins: {
        chatPatterns: [
          {
            id: 'pm-2line',
            name: 'PM 2-line',
            type: 'pm',
            lineCount: 2,
            regexLines: ['^=== YENİ PM ===$', '^(?<sender>\\w+) > (?<message>.+)$'],
          },
        ],
        autoLogin: {
          enabled: true,
          password: 'secret123',
          loginCommand: '/login {password}',
          registerCommand: '/register {password} {password}',
          cooldownSeconds: 2,
          patterns: [
            {
              id: 'login-2line',
              name: 'Login 2-line',
              action: 'login',
              lineCount: 2,
              regexLines: ['^Hoş geldin!$', '^Giriş için /login yaz$'],
            },
          ],
        },
        autoChat: {
          enabled: true,
          cooldownSeconds: 1,
          joinMessage: '',
          rules: [
            { id: 'r1', trigger: 'selam bot', response: '/msg {sender} merhaba', scope: 'pm' },
          ],
        },
      },
    });

    await wait(() => clientChats.includes('/login secret123'), 'autoLogin under actionbar spam');
    await wait(() => clientChats.includes('/msg Alice merhaba'), '2-line PM pattern under actionbar spam');

    const chatTexts = messages.filter(m => m.type === 'chat').map(m => m.text);
    assert.equal(chatTexts.some(t => t.includes('HP: 20 | Ping:')), false, 'Actionbar spam must NOT appear in chat list');

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: actionbar spam does not pollute chat or break 2-line chat/login patterns');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (actionbarTimer) clearInterval(actionbarTimer);
    worker?.kill();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
