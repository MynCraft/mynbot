'use strict';
const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.21.4');
const { createAutomation } = require(path.join(root, 'public/builtin-automation.cjs'));

const wait = (predicate, label, timeout = 12000) => new Promise((resolve, reject) => {
  const start = Date.now();
  const t = setInterval(() => {
    if (predicate()) { clearInterval(t); resolve(); }
    else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error('Timeout: ' + label)); }
  }, 40);
});

const EMPTY_SLOT = { itemCount: 0, components: [], removeComponents: [] };
function makeSlot(itemId, count) {
  return { present: true, itemCount: count, itemId, addedComponentCount: 0, removedComponentCount: 0, components: [], removeComponents: [] };
}

// 1. B17: 1.21.4 { itemCount: 0 } empty slots, set_cursor_item, and last-item cursor preservation
async function test1214CursorSync() {
  const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.21.4', 'online-mode': false, keepAlive: false });
  const messages = [];
  let playClient = null;

  server.on('playerJoin', client => {
    playClient = client;
    client.write('login', { ...mcData.loginPacket, entityId: client.id });
    client.write('position', {
      teleportId: 1,
      x: 0, y: 64, z: 0, dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0,
      flags: { x: false, y: false, z: false, yRot: false, xRot: false, dx: false, dy: false, dz: false, rotateDelta: false },
    });
    client.write('update_health', { health: 20, food: 20, foodSaturation: 5 });

    // Send 1 diamond in slot 36 (the ONLY item in inventory!)
    const items = Array.from({ length: 46 }, () => EMPTY_SLOT);
    items[36] = makeSlot(mcData.itemsByName.diamond.id, 1);
    client.write('window_items', { windowId: 0, stateId: 1, items, carriedItem: EMPTY_SLOT });
  });

  await new Promise(r => server.once('listening', r));
  let worker;
  try {
    worker = fork(path.join(root, 'public/bot-worker.cjs'), [], { execPath: process.execPath, silent: true });
    worker.on('message', m => messages.push(m));
    worker.stderr.on('data', b => process.stderr.write(b));

    worker.send({
      action: 'connect',
      bot: { username: 'InvBot', host: '127.0.0.1', port: server.socketServer.address().port, version: '1.21.4' },
      plugins: {},
    });

    await wait(() => messages.some(m => m.type === 'inventory' && m.inventory?.length === 1), 'initial 1 diamond in slot 36');

    // Simulate picking up the LAST item onto cursor via set_slot(36, { itemCount: 0 }) + set_cursor_item
    const idxBefore = messages.length;
    playClient.write('set_slot', { windowId: 0, stateId: 2, slot: 36, item: EMPTY_SLOT });
    playClient.write('set_cursor_item', { contents: makeSlot(mcData.itemsByName.diamond.id, 1) });

    await wait(
      () => messages.slice(idxBefore).some(m => m.type === 'inventory' && m.inventory.length === 0 && m.cursor?.name === 'diamond'),
      'last item moved to cursor and preserved'
    );

    // Also test set_slot(windowId: -1, { itemCount: 0 }) clears cursor cleanly
    const idxClear = messages.length;
    playClient.write('set_slot', { windowId: -1, stateId: 3, slot: -1, item: EMPTY_SLOT });
    await wait(
      () => messages.slice(idxClear).some(m => m.type === 'inventory' && m.cursor === null),
      'empty set_slot(-1, itemCount: 0) clears cursor'
    );

    worker.send({ action: 'disconnect', username: 'InvBot' });
    await wait(() => messages.some(m => m.type === 'status' && m.state === 'disconnected'), 'disconnect InvBot');
  } finally {
    worker?.kill();
    server.close();
  }
}

// 2. B19: Locked/unopenable chest in autoChestDump times out in ~4s and does NOT deadlock autoEat/queues
async function testChestDumpTimeoutDoesNotDeadlock() {
  const listeners = new Map();
  const events = [];
  const slots = Array.from({ length: 45 }, () => null);
  // Fill almost all main slots (keep 1 free <= threshold 3) with dirt + 1 steak
  for (let i = 9; i <= 43; i++) {
    slots[i] = { slot: i, type: i === 9 ? 100 : 1, metadata: 0, name: i === 9 ? 'cooked_beef' : 'dirt', count: 1 };
  }
  const fakeBot = {
    food: 20,
    health: 20,
    heldItem: null,
    currentWindow: null,
    registry: { foodsByName: { cooked_beef: { foodPoints: 8, saturation: 12.8 } } },
    inventory: {
      slots,
      selectedItem: null,
      items: () => slots.filter(Boolean),
    },
    findBlock: () => ({ name: 'chest', position: { x: 1, y: 64, z: 0 } }),
    activateBlock: () => { events.push('chest-activate'); /* never emits windowOpen! */ },
    equip: async item => { fakeBot.heldItem = item; },
    consume: async () => { events.push('ate-steak'); fakeBot.food = 18; },
    deactivateItem: () => {},
    on: (ev, fn) => {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev).add(fn);
    },
    removeListener: (ev, fn) => {
      listeners.get(ev)?.delete(fn);
    },
  };

  let latestStatuses = {};
  let queue = Promise.resolve();
  const automation = createAutomation(fakeBot, {
    current: () => true,
    isManual: () => false,
    report: st => { latestStatuses = st; },
    enqueue: fn => {
      const op = queue.catch(() => {}).then(fn);
      queue = op;
      return op;
    },
  });

  // Start with both autoChestDump and autoEat enabled, food=20 so chestDump runs first
  automation.update({
    autoChestDump: { enabled: true, freeSlotsThreshold: 3, searchRadius: 4, intervalSeconds: 15, keepFoods: true, keepToolsAndArmor: true, keepKeywords: [] },
    autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'saturation', allowGoldenApples: false, restoreHeldItem: true },
  });

  await wait(() => events.includes('chest-activate'), 'chestDump attempted');
  // Now bot becomes hungry while chestDump is waiting on the unresponsive chest
  fakeBot.food = 10;

  // ChestDump should time out around 4s and release queue so autoEat succeeds well within 6.5s!
  await wait(() => events.includes('ate-steak'), 'autoEat ran after chestDump 4s timeout', 7500);
  assert.equal((listeners.get('windowOpen')?.size || 0), 0, 'windowOpen listener must be cleaned up on timeout');
  assert.equal(latestStatuses.autoChestDump?.state, 'waiting', 'autoChestDump should report waiting after timeout');
  automation.stop();
}

(async () => {
  await test1214CursorSync();
  await testChestDumpTimeoutDoesNotDeadlock();
  console.log('PASS: 1.21.4 itemCount:0/set_cursor_item/last-item cursor preservation and chestDump 4s timeout non-deadlock');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode || 0), 150);
});
