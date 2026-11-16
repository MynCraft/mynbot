const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.20.4');

const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.20.4', 'online-mode': false, keepAlive: false });
const messages = [];
const receivedPackResponses = [];

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

const packUuid = '12345678-1234-4234-8234-1234567890ab';

server.on('login', client => {
  client.on('resource_pack_receive', packet => {
    receivedPackResponses.push(packet);
  });

  // In 1.20.4, mc.createServer enters configuration phase on login; send add_resource_pack in configuration state
  setTimeout(() => {
    client.write('add_resource_pack', {
      uuid: packUuid,
      url: 'https://example.com/pack.zip',
      hash: '0123456789abcdef0123456789abcdef01234567',
      forced: true,
      hasPromptMessage: false,
    });
  }, 150);
});

server.on('error', e => { console.error(e); process.exitCode = 1; });

server.on('listening', async () => {
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => {
      messages.push(m);
      if (m.type === 'status' || m.type === 'log' || m.type === 'operation-error') console.log('worker', JSON.stringify(m));
    });
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'LocalTest', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.20.4' },
      plugins: {},
    });

    await wait(() => receivedPackResponses.length >= 2, '2 resource_pack_receive packets');

    // Wait briefly to ensure no extra duplicate packets or serialization errors arrive
    await new Promise(r => setTimeout(r, 300));

    assert.equal(receivedPackResponses.length, 2, 'Must send exactly 2 resource_pack_receive packets (ACCEPTED + SUCCESSFULLY_LOADED)');
    assert.deepEqual(receivedPackResponses.map(p => p.result), [3, 0], 'Results must be [3 (ACCEPTED), 0 (SUCCESSFULLY_LOADED)]');
    assert.match(String(receivedPackResponses[0].uuid), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.match(String(receivedPackResponses[1].uuid), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const hasSerializationError = messages.some(m => (m.type === 'operation-error' || m.type === 'log' || m.type === 'status') && /serialization error/i.test(m.message || ''));
    assert.equal(hasSerializationError, false, 'Must not emit any Serialization error');

    const status = messages.filter(m => m.type === 'status').pop();
    assert.notEqual(status.state, 'error', 'Bot must not enter error state');

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect');

    console.log('PASS: 1.20.4 add_resource_pack sends exactly ACCEPTED + SUCCESSFULLY_LOADED with valid UUID and no serialization error');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    worker?.kill();
    server.close();
    setTimeout(() => process.exit(process.exitCode || 0), 150);
  }
});
