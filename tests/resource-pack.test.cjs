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

async function runResourcePackScenario(version, testRemoveAndReadd) {
  const server = mc.createServer({ host: '127.0.0.1', port: 0, version, 'online-mode': false, keepAlive: false });
  const messages = [];
  const receivedPackResponses = [];
  const packUuid = '12345678-1234-4234-8234-1234567890ab';

  const sendPackSequence = client => {
    client.write('add_resource_pack', {
      uuid: packUuid,
      url: 'https://example.com/pack.zip',
      hash: '0123456789abcdef0123456789abcdef01234567',
      forced: true,
      hasPromptMessage: false,
    });

    if (testRemoveAndReadd) {
      setTimeout(() => {
        client.write('remove_resource_pack', { uuid: packUuid });
        setTimeout(() => {
          client.write('add_resource_pack', {
            uuid: packUuid,
            url: 'https://example.com/pack.zip',
            hash: '0123456789abcdef0123456789abcdef01234567',
            forced: true,
            hasPromptMessage: false,
          });
        }, 120);
      }, 250);
    }
  };

  if (version === '1.20.4') {
    server.on('login', client => {
      client.on('resource_pack_receive', packet => {
        receivedPackResponses.push(packet);
      });
      setTimeout(() => sendPackSequence(client), 150);
    });
  } else {
    const mcData = require(path.join(root, 'node_modules/minecraft-data'))(version);
    server.on('playerJoin', client => {
      client.on('resource_pack_receive', packet => {
        receivedPackResponses.push(packet);
      });
      client.write('login', { ...mcData.loginPacket, entityId: client.id });
      client.write('position', {
        teleportId: 1,
        x: 0, y: 64, z: 0, dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0,
        flags: { x: false, y: false, z: false, yRot: false, xRot: false, dx: false, dy: false, dz: false, rotateDelta: false },
      });
      client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });
      setTimeout(() => sendPackSequence(client), 150);
    });
  }

  await new Promise(r => server.once('listening', r));
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
      bot: { username: 'LocalTest', host: '127.0.0.1', port: server.socketServer.address().port, version },
      plugins: {},
    });

    const expectedCount = testRemoveAndReadd ? 4 : 2;
    await wait(() => receivedPackResponses.length >= expectedCount, `${version}: ${expectedCount} resource_pack_receive packets`);
    await new Promise(r => setTimeout(r, 250));

    assert.equal(receivedPackResponses.length, expectedCount, `${version}: Must send exactly ${expectedCount} resource_pack_receive packets`);
    const expectedResults = testRemoveAndReadd ? [3, 0, 3, 0] : [3, 0];
    assert.deepEqual(receivedPackResponses.map(p => p.result), expectedResults, `${version}: Results mismatch`);
    for (let i = 0; i < receivedPackResponses.length; i++) {
      assert.equal(
        String(receivedPackResponses[i].uuid).toLowerCase(),
        packUuid.toLowerCase(),
        `${version}: response[${i}].uuid must match packUuid exactly (must not be 00000000-...)`
      );
    }

    const hasSerializationError = messages.some(m => (m.type === 'operation-error' || m.type === 'log' || m.type === 'status') && /serialization error/i.test(m.message || ''));
    assert.equal(hasSerializationError, false, `${version}: Must not emit any Serialization error`);

    const status = messages.filter(m => m.type === 'status').pop();
    assert.notEqual(status.state, 'error', `${version}: Bot must not enter error state`);

    worker.send({ action: 'disconnect', username: 'LocalTest' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), `${version}: disconnect`);
  } finally {
    worker?.kill();
    server.close();
  }
}

(async () => {
  await runResourcePackScenario('1.20.4', false);
  await runResourcePackScenario('1.21.4', true);
  await runResourcePackScenario('1.21.8', false);
  console.log('PASS: 1.20.4, 1.21.4 and 1.21.8 add_resource_pack send exact packUuid, handle remove_resource_pack re-add, and emit no serialization errors');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 150);
});
