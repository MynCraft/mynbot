'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

async function test1165Channels() {
  const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');
  const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
  const messages = [];
  const sentCommands = [];

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
    client.on('chat', ({ message }) => sentCommands.push(message));

    // 1) title action=0 with extra JSON (Mineflayer title.js would truncate extra!)
    setTimeout(() => {
      client.write('title', {
        action: 0,
        text: JSON.stringify({ text: 'Giriş ', extra: [{ text: '/login sifre' }] }),
      });
    }, 150);

    // 2) title action=2 (actionbar in 1.11-1.16.5, ignored by Mineflayer title.js!)
    setTimeout(() => {
      client.write('title', {
        action: 2,
        text: JSON.stringify({ text: 'Actionbar: ', extra: [{ text: 'lütfen /register yapın' }] }),
      });
    }, 1300);

    // 3) Chat message mentioning bot's own username with colon ("MyBot: /login sifre")
    setTimeout(() => {
      client.write('chat', {
        message: JSON.stringify({ text: 'LocalBot: lütfen /login sifre yazın' }),
        position: 0,
        sender: '00000000-0000-0000-0000-000000000000',
      });
    }, 2500);
  });

  await new Promise(r => server.once('listening', r));
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'LocalBot', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.16.5' },
      plugins: {
        autoLogin: {
          enabled: true,
          password: 'pw123',
          loginCommand: '/login {password}',
          registerCommand: '/register {password} {password}',
          cooldownSeconds: 1,
          listenTitleActionbar: true,
          patterns: [
            { id: 't1', name: 'TitleExtra', action: 'login', lineCount: 1, regexLines: ['^Giriş\\s+/login\\s+sifre$'] },
            { id: 'a1', name: 'Actionbar116', action: 'register', lineCount: 1, regexLines: ['Actionbar:\\s+lütfen\\s+/register'] },
            { id: 'c1', name: 'SelfMention', action: 'login', lineCount: 1, regexLines: ['^LocalBot:\\s+lütfen\\s+/login'] },
          ],
        },
      },
    });

    await wait(() => sentCommands.length >= 3 && messages.some(m => m.type === 'actionbar'), '1.16.5 title+actionbar+chat triggers');

    assert.ok(messages.some(m => m.type === 'title' && m.source === 'title' && m.text.includes('/login sifre')), 'Title IPC with full extra text must be emitted');
    assert.ok(messages.some(m => m.type === 'actionbar' && m.text.includes('/register yapın')), '1.16.5 title action=2 Actionbar IPC must be emitted');
    assert.deepEqual(sentCommands, ['/login pw123', '/register pw123 pw123', '/login pw123'], 'All 3 login/register triggers must fire');

    worker.send({ action: 'disconnect', username: 'LocalBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect 1.16.5');
  } finally {
    worker?.kill();
    server.close();
  }
}

async function test1214Channels() {
  const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.21.4');
  const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.21.4', 'online-mode': false, keepAlive: false });
  const messages = [];
  const sentCommands = [];

  server.on('playerJoin', client => {
    client.write('login', { ...mcData.loginPacket, entityId: client.id });
    client.write('position', {
      teleportId: 1,
      x: 0, y: 64, z: 0, dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0,
      flags: { x: false, y: false, z: false, yRot: false, xRot: false, dx: false, dy: false, dz: false, rotateDelta: false },
    });
    client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });

    client.on('chat_command', pkt => sentCommands.push('/' + pkt.command));
    client.on('chat_command_signed', pkt => sentCommands.push('/' + pkt.command));
    client.on('chat_message', pkt => sentCommands.push(pkt.message));

    // 1) 1.21.4 set_title_text + set_title_subtitle (2-line rule!) with {"": "..."} NBT empty key
    setTimeout(() => {
      client.write('set_title_text', {
        text: { type: 'compound', value: { '': { type: 'string', value: 'Hoş Geldiniz' } } },
      });
      client.write('set_title_subtitle', {
        text: {
          type: 'compound',
          value: {
            '': { type: 'string', value: 'Lütfen ' },
            extra: { type: 'list', value: { type: 'compound', value: [{ text: { type: 'string', value: '/login <sifre>' } }] } },
          },
        },
      });
    }, 150);

    // 2) 1.21.4 dedicated action_bar packet
    setTimeout(() => {
      client.write('action_bar', {
        text: { type: 'compound', value: { '': { type: 'string', value: 'Kayıt için /register yaz' } } },
      });
    }, 1350);
  });

  await new Promise(r => server.once('listening', r));
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'ModernBot', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.21.4' },
      plugins: {
        autoLogin: {
          enabled: true,
          password: 'pw456',
          loginCommand: '/login {password}',
          registerCommand: '/register {password} {password}',
          cooldownSeconds: 1,
          listenTitleActionbar: true,
          patterns: [
            {
              id: 'ts2',
              name: 'TitleSubtitle2',
              action: 'login',
              lineCount: 2,
              regexLines: ['^Hoş Geldiniz$', '^Lütfen\\s+/login\\s+<sifre>$'],
            },
            {
              id: 'ab1',
              name: 'Actionbar1214',
              action: 'register',
              lineCount: 1,
              regexLines: ['Kayıt için /register yaz'],
            },
          ],
        },
      },
    });

    await wait(() => sentCommands.includes('/login pw456'), '1.21.4 2-line title+subtitle login');
    await wait(() => sentCommands.includes('/register pw456 pw456'), '1.21.4 dedicated action_bar register');

    assert.ok(messages.some(m => m.type === 'title' && m.source === 'title' && m.text === 'Hoş Geldiniz'), '1.21.4 title IPC');
    assert.ok(messages.some(m => m.type === 'title' && m.source === 'subtitle' && m.text === 'Lütfen /login <sifre>'), '1.21.4 subtitle IPC with {"": "..."}');
    assert.ok(messages.some(m => m.type === 'actionbar' && m.text === 'Kayıt için /register yaz'), '1.21.4 actionbar IPC');

    worker.send({ action: 'disconnect', username: 'ModernBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect 1.21.4');
  } finally {
    worker?.kill();
    server.close();
  }
}

(async () => {
  await test1165Channels();
  await test1214Channels();
  console.log('PASS: 1.16.5 & 1.21.4 title/subtitle/actionbar, NBT empty key, extra JSON, and self-mention login channels work');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 150);
});
