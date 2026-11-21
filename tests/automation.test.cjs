'use strict';
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createAutomation, chooseFood, armorScore } = require('../public/builtin-automation.cjs');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function fake(items) {
  const bot = new EventEmitter();
  bot.food = 10; bot.health = 20; bot.inventory = { slots: Array(46).fill(null), items: () => items, selectedItem: null };
  bot.registry = { foodsByName: { apple: { foodPoints: 4, saturation: 2.4 }, cooked_beef: { foodPoints: 8, saturation: 12.8 }, rotten_flesh: { foodPoints: 4, saturation: .8 }, golden_apple: { foodPoints: 4, saturation: 9.6 } } };
  bot.heldItem = null; bot.calls = [];
  bot.equip = async (item, slot) => { bot.calls.push(['equip', item.name, slot]); if (slot === 'hand') bot.heldItem = item; else bot.inventory.slots[{ head: 5, torso: 6, legs: 7, feet: 8 }[slot]] = item; };
  bot.consume = async () => { bot.calls.push(['consume']); bot.food = 20; };
  bot.activateItem = () => bot.calls.push(['activate']); bot.deactivateItem = () => bot.calls.push(['deactivate']);
  bot.fish = () => new Promise(() => {}); bot.blockAtCursor = () => ({ name: 'water' });
  return bot;
}
(async () => {
  const apple = { name: 'apple', type: 1, metadata: 0, slot: 9 }, beef = { name: 'cooked_beef', type: 2, metadata: 0, slot: 10 }, bad = { name: 'rotten_flesh', type: 3, metadata: 0, slot: 11 }, golden = { name: 'golden_apple', type: 4, metadata: 0, slot: 12 }, sword = { name: 'iron_sword', type: 5, metadata: 0, slot: 13 };
  const bot = fake([apple, beef, bad, golden, sword]); bot.heldItem = sword;
  assert.equal(chooseFood(bot, { selection: 'saturation', allowGoldenApples: false }).name, 'cooked_beef');
  assert.equal(chooseFood(fake([bad, golden]), { selection: 'food', allowGoldenApples: false }), undefined);
  assert(armorScore({ name: 'diamond_helmet' }, 'helmet') > armorScore({ name: 'iron_helmet' }, 'helmet'));
  assert.equal(armorScore({ name: 'diamond_helmet' }, 'boots'), 0);
  assert.equal(armorScore({ name: 'golden_boots' }, 'boots'), armorScore({ name: 'leather_boots' }, 'boots'));
  assert.equal(armorScore({ name: 'golden_helmet' }, 'helmet'), armorScore({ name: 'iron_helmet' }, 'helmet'));
  assert(armorScore({ name: 'netherite_helmet' }, 'helmet') > armorScore({ name: 'diamond_helmet' }, 'helmet'));
  const options = { current: () => true, report: () => {}, enqueue: task => Promise.resolve().then(task) };
  const ctrl = createAutomation(bot, options);
  ctrl.update({ autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'saturation', allowGoldenApples: false, restoreHeldItem: true } });
  await wait(20); assert.deepEqual(bot.calls.map(x => x[0]), ['equip','consume','equip']); assert.equal(bot.heldItem.name, 'iron_sword');
  ctrl.stop();
  const armorBot = fake([{ name: 'diamond_helmet', slot: 9 }, { name: 'iron_boots', slot: 10 }]); armorBot.food = 20; armorBot.inventory.slots[5] = { name: 'diamond_helmet' };
  const armor = createAutomation(armorBot, options); armor.update({ autoArmor: { enabled: true, intervalSeconds: 2 } }); await wait(20);
  assert.deepEqual(armorBot.calls, [['equip', 'iron_boots', 'feet']]); armor.stop();
  const fishingBot = fake([{ name: 'fishing_rod', type: 8, metadata: 0, slot: 9 }]); fishingBot.food = 20;
  const fish = createAutomation(fishingBot, options); fish.update({ autoFishing: { enabled: true, recastDelaySeconds: 1, timeoutSeconds: 10 } }); await wait(20); fish.manual(); await wait(20);
  assert(fishingBot.calls.some(call => call[0] === 'activate')); fish.stop();
  const blocked = fake([beef]); blocked.currentWindow = {}; const b = createAutomation(blocked, options); b.update({ autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'food' } }); await wait(20); assert.equal(blocked.calls.length, 0); b.stop();
  const fails = fake([beef]); fails.consume = async () => { fails.calls.push(['consume']); throw Error('rejected'); }; const failed = createAutomation(fails, options); failed.update({ autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'food' } }); await wait(20); failed.tick(); await wait(20); assert.equal(fails.calls.filter(c => c[0] === 'consume').length, 1); failed.stop();
  const timeoutBot = fake([{ name: 'fishing_rod', type: 8, metadata: 0, slot: 9 }]); timeoutBot.food = 20; const reports = [];
  const timeoutController = createAutomation(timeoutBot, { ...options, report: value => reports.push(value) });
  timeoutController.update({ autoFishing: { enabled: true, recastDelaySeconds: 1, timeoutSeconds: .02 } }); await wait(60);
  assert(reports.some(value => value.autoFishing?.message?.includes('zaman aşımı'))); assert(timeoutBot.calls.some(call => call[0] === 'activate')); timeoutController.stop();
  const oldSword = { name: 'iron_sword', type: 5, metadata: 0, nbt: { id: 1 }, durabilityUsed: 1, slot: 13 }; const otherSword = { ...oldSword, nbt: { id: 2 } };
  const exactBot = fake([beef, oldSword]); exactBot.heldItem = oldSword; exactBot.consume = async () => { exactBot.inventory.items = () => [beef, otherSword]; exactBot.food = 20; };
  const exact = createAutomation(exactBot, options); exact.update({ autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'food', restoreHeldItem: true } }); await wait(30); assert.equal(exactBot.calls.filter(c => c[1] === 'iron_sword').length, 0); exact.stop();
  const protectedBot = fake([{ name: 'diamond_chestplate', slot: 9 }, { name: 'diamond_helmet', slot: 10 }]); protectedBot.food = 20; protectedBot.inventory.slots[6] = { name: 'elytra' }; protectedBot.inventory.slots[5] = { name: 'iron_helmet', nbt: { Enchantments: [{ id: 'minecraft:binding_curse' }] } };
  const protectedControl = createAutomation(protectedBot, options); protectedControl.update({ autoArmor: { enabled: true, intervalSeconds: 2 } }); await wait(20); assert.equal(protectedBot.calls.length, 0); protectedControl.stop();
  const slowBot = fake([{ name: 'diamond_boots', slot: 9 }]); slowBot.food = 20; let finishEquip; const slowReports = []; slowBot.equip = () => new Promise(resolve => { finishEquip = resolve; });
  const slow = createAutomation(slowBot, { ...options, report: value => slowReports.push(JSON.parse(JSON.stringify(value))) }); slow.update({ autoArmor: { enabled: true, intervalSeconds: 2 } }); await wait(20); slow.update({ autoArmor: { enabled: false, intervalSeconds: 2 } }); finishEquip(); await wait(20); assert.equal(slowReports.at(-1).autoArmor.state, 'idle'); assert(!slowReports.at(-1).autoArmor.lastRunAt); slow.stop();
  const raceBot = fake([{ name: 'fishing_rod', type: 8, metadata: 0, slot: 9 }]); raceBot.food = 20; const race = createAutomation(raceBot, options); race.update({ autoFishing: { enabled: true, recastDelaySeconds: 1, timeoutSeconds: 10 } }); await wait(20); race.manual(); assert.equal(raceBot.calls.filter(c => c[0] === 'activate').length, 1); raceBot.heldItem = { name: 'sword' }; await wait(20); assert.equal(raceBot.calls.filter(c => c[0] === 'activate').length, 1); race.stop();
  const priorityBot = fake([{ name: 'fishing_rod', type: 8, metadata: 0, slot: 9 }, beef]);
  priorityBot.food = 20;
  priorityBot.fish = () => { priorityBot.calls.push(['fish']); return new Promise(() => {}); };
  const priority = createAutomation(priorityBot, options);
  priority.update({ autoEat: { enabled: true, hungerThreshold: 16, healthThreshold: 10, selection: 'food', restoreHeldItem: true }, autoFishing: { enabled: true, recastDelaySeconds: 1, timeoutSeconds: 10 } });
  await wait(20); assert(priorityBot.calls.some(c => c[0] === 'fish'));
  priorityBot.food = 10; priorityBot.emit('health'); await wait(20); priority.tick(); await wait(20);
  const retractAt = priorityBot.calls.findIndex(c => c[0] === 'activate');
  const consumeAt = priorityBot.calls.findIndex(c => c[0] === 'consume');
  assert(retractAt >= 0 && consumeAt > retractAt, 'hungry bot retracts fishing before eating');
  priority.stop(); assert.equal(priorityBot.listenerCount('health'), 0);
  const missingRod = fake([]); missingRod.food = 20; const missingReports = [];
  const missing = createAutomation(missingRod, { ...options, report: v => missingReports.push(v) });
  missing.update({ autoFishing: { enabled: true, recastDelaySeconds: 1, timeoutSeconds: 10 } });
  await wait(20); assert(missingReports.some(v => v.autoFishing?.state === 'waiting')); assert.equal(missingRod.calls.length, 0); missing.stop();

  // autoTotem: shield by default, switch to totem on low health
  const totemItem = { name: 'totem_of_undying', slot: 10 };
  const shieldItem = { name: 'shield', slot: 11 };
  const totemBot = fake([totemItem, shieldItem]);
  totemBot.food = 20; totemBot.health = 20;
  totemBot.equip = async (item, slot) => { totemBot.calls.push(['equip', item.name, slot]); if (slot === 'off-hand') totemBot.inventory.slots[45] = item; };
  const totemCtrl = createAutomation(totemBot, options);
  totemCtrl.update({ autoTotem: { enabled: true, priorityItem: 'shield', healthThreshold: 12, intervalSeconds: 1 } });
  await wait(20);
  assert.equal(totemBot.inventory.slots[45].name, 'shield');
  totemBot.health = 10; totemBot.emit('health');
  await wait(20);
  assert.equal(totemBot.inventory.slots[45].name, 'totem_of_undying');
  totemCtrl.stop();

  // autoPanic: whitelist ignored, stranger or low health triggers panic
  const panicBot = fake([]);
  panicBot.food = 20; panicBot.health = 20;
  panicBot.entity = { position: { x: 0, y: 64, z: 0 } };
  panicBot.entities = {
    1: { type: 'player', username: 'TrustedFriend', position: { x: 2, y: 64, z: 0 } },
  };
  let panicEvents = [];
  const panicCtrl = createAutomation(panicBot, { ...options, onPanicDisconnect: (reason, disableReconnect) => panicEvents.push({ reason, disableReconnect }) });
  panicCtrl.update({ autoPanic: { enabled: true, healthThreshold: 6, disconnectOnPlayer: true, playerRadius: 12, whitelist: ['TrustedFriend'], action: 'disconnect', panicCommand: '/spawn', disableReconnect: true } });
  await wait(20);
  assert.equal(panicEvents.length, 0);
  panicBot.entities[2] = { type: 'player', username: 'Stranger', position: { x: 5, y: 64, z: 0 } };
  panicCtrl.tick();
  await wait(20);
  assert.equal(panicEvents.length, 1);
  assert.equal(panicEvents[0].disableReconnect, true);
  panicCtrl.stop();

  // autoDefend: equips best sword, skips creeper when attackCreepers=false
  const defendBot = fake([{ name: 'diamond_sword', slot: 9 }]);
  defendBot.food = 20; defendBot.health = 20;
  defendBot.entity = { position: { x: 0, y: 64, z: 0 } };
  const creeper = { type: 'mob', name: 'creeper', position: { x: 2, y: 64, z: 0 } };
  const zombie = { type: 'mob', name: 'zombie', position: { x: 3, y: 64, z: 0 } };
  defendBot.entities = { 1: creeper };
  defendBot.attack = target => defendBot.calls.push(['attack', target.name]);
  const defendCtrl = createAutomation(defendBot, options);
  defendCtrl.update({ autoDefend: { enabled: true, radius: 4, attackIntervalMs: 300, autoEquipWeapon: true, attackCreepers: false, restoreHeldItem: true } });
  await wait(20);
  assert.equal(defendBot.calls.filter(c => c[0] === 'attack').length, 0);
  defendBot.entities[2] = zombie;
  defendCtrl.tick();
  await wait(20);
  assert(defendBot.calls.some(c => c[0] === 'equip' && c[1] === 'diamond_sword' && c[2] === 'hand'));
  assert(defendBot.calls.some(c => c[0] === 'attack' && c[1] === 'zombie'));
  defendCtrl.stop();

  // autoChestDump: deposits cobble, keeps food/tools/keywords
  const cobble = { name: 'cobblestone', type: 4, metadata: 0, count: 64, slot: 9 };
  const keptDiamond = { name: 'diamond', type: 264, metadata: 0, count: 5, slot: 10 };
  const keptBeef = { name: 'cooked_beef', type: 364, metadata: 0, count: 16, slot: 11 };
  const keptPick = { name: 'diamond_pickaxe', type: 278, metadata: 0, count: 1, slot: 12 };
  const chestBot = fake([cobble, keptDiamond, keptBeef, keptPick]);
  chestBot.food = 20;
  for (let i = 9; i < 45; i++) chestBot.inventory.slots[i] = { name: 'dirt', slot: i };
  chestBot.inventory.slots[44] = null; // 1 free slot <= threshold 3
  const deposited = [];
  chestBot.findBlock = () => ({ name: 'chest', position: { x: 1, y: 64, z: 0 } });
  chestBot.openContainer = async () => ({
    deposit: async (type, _meta, count) => { deposited.push({ type, count }); },
    close: () => {},
  });
  const chestCtrl = createAutomation(chestBot, options);
  chestCtrl.update({ autoChestDump: { enabled: true, freeSlotsThreshold: 3, searchRadius: 4, intervalSeconds: 5, keepFoods: true, keepToolsAndArmor: true, keepKeywords: ['diamond'] } });
  await wait(20);
  assert.deepEqual(deposited, [{ type: 4, count: 64 }]);
  chestCtrl.stop();

  // autoAccept & commandScheduler & autoLobby in bot-worker
  const { handleAutoAccept, applyCommandScheduler, stopCommandScheduler, scheduleAutoLobby, getState, cleanupPlugins, bots } = require('../public/bot-worker.cjs');
  const workerBot = new EventEmitter();
  const chatLog = [];
  workerBot.chat = msg => chatLog.push(msg);
  workerBot.setQuickBarSlot = s => chatLog.push(['slot', s]);
  workerBot.activateItem = () => chatLog.push(['activate']);
  bots.set('WorkerTester', workerBot);
  const st = getState('WorkerTester');
  st.plugins = {
    autoAccept: { enabled: true, onlyWhitelist: true, whitelist: ['Alice'], triggers: ['ışınlanma isteği'], acceptCommand: '/tpaccept', cooldownSeconds: 1 },
    commandScheduler: { enabled: true, tasks: [{ id: 't1', command: '/sell all', intervalSeconds: 5, enabled: true }] },
    autoLobby: { enabled: true, delaySeconds: 1, hotbarSlot: 1, clickSlot: -1, itemKeyword: '', postCommand: '/is go' },
  };
  handleAutoAccept('WorkerTester', workerBot, 'Bob sana ışınlanma isteği gönderdi.', null);
  assert.equal(chatLog.length, 0);
  handleAutoAccept('WorkerTester', workerBot, 'Alice sana ışınlanma isteği gönderdi.', null);
  assert.equal(chatLog[0], '/tpaccept');
  applyCommandScheduler('WorkerTester', workerBot);
  stopCommandScheduler('WorkerTester');
  scheduleAutoLobby('WorkerTester', workerBot);
  cleanupPlugins('WorkerTester', workerBot);
  bots.delete('WorkerTester');

  console.log('automation food, armor protection, cancellation, timeout and manual window passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
