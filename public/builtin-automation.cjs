'use strict';

const BAD_FOODS = new Set(['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish', 'chicken', 'raw_chicken', 'suspicious_stew', 'chorus_fruit', 'tropical_fish', 'salmon', 'cod', 'beef', 'porkchop', 'mutton', 'rabbit', 'potato']);
const GOLDEN = new Set(['golden_apple', 'enchanted_golden_apple']);
const PROTECTION = { leather: [1,3,2,1], golden: [2,5,3,1], chainmail: [2,5,4,1], iron: [2,6,5,2], diamond: [3,8,6,3], netherite: [3,8,6,3] };
const ARMOR = [
  { suffix: 'helmet', slot: 5, destination: 'head' },
  { suffix: 'chestplate', slot: 6, destination: 'torso' },
  { suffix: 'leggings', slot: 7, destination: 'legs' },
  { suffix: 'boots', slot: 8, destination: 'feet' },
];
function armorScore(item, suffix) {
  if (!item) return 0;
  if (suffix === 'helmet' && item.name === 'turtle_helmet') return 200;
  const match = /^(leather|golden|chainmail|iron|diamond|netherite)_(helmet|chestplate|leggings|boots)$/.exec(item.name || '');
  if (!match || match[2] !== suffix) return 0;
  const toughness = match[1] === 'netherite' ? 3 : match[1] === 'diamond' ? 2 : 0;
  return PROTECTION[match[1]][['helmet','chestplate','leggings','boots'].indexOf(suffix)] * 100 + toughness;
}
function protectedArmor(item) {
  if (!item) return false;
  if (item.name === 'elytra' || (Array.isArray(item.enchants) && item.enchants.length)) return true;
  const details = JSON.stringify([item.nbt ?? null, item.components ?? null]).toLowerCase();
  return /enchant|binding_curse|bindingcurse/.test(details);
}
function chooseFood(bot, config) {
  const foods = bot.registry?.foodsByName || {};
  return (bot.inventory?.items() || []).filter(item => {
    const name = item.name;
    return foods[name] && !BAD_FOODS.has(name) && (!GOLDEN.has(name) || config.allowGoldenApples);
  }).sort((a, b) => {
    const first = foods[a.name], second = foods[b.name];
    const key = config.selection === 'food' ? 'foodPoints' : 'saturation';
    return (Number(second[key]) || 0) - (Number(first[key]) || 0) || (Number(second.foodPoints) || 0) - (Number(first.foodPoints) || 0);
  })[0];
}
function createAutomation(bot, options) {
  let config = {};
  let generation = 0;
  let disposed = false;
  let busy = false;
  let currentAction = '';
  let cancelActive;
  let fishingCast = false;
  let manualUntil = 0;
  let lastArmor = 0;
  let nextFish = 0;
  let nextEat = 0;
  const statuses = {};
  function report(key, state, message, finished = false) {
    if (!options.current() || disposed) return;
    const old = statuses[key];
    const next = { state, ...(message ? { message } : {}), ...(finished ? { lastRunAt: Date.now() } : old?.lastRunAt ? { lastRunAt: old.lastRunAt } : {}) };
    if (JSON.stringify(old) !== JSON.stringify(next)) { statuses[key] = next; options.report({ ...statuses }); }
  }
  function valid(token, key) { return !disposed && token === generation && options.current() && Boolean(config[key]?.enabled); }
  function blocked() { return Date.now() < manualUntil || options.isManual?.() || bot.currentWindow || bot.inventory?.selectedItem || !bot.inventory; }
  function interrupt() {
    generation++;
    if (fishingCast) {
      fishingCast = false;
      try { if (options.current() && bot.heldItem?.name === 'fishing_rod') bot.activateItem(); } catch {}
    }
    if (cancelActive) cancelActive();
    if (currentAction === 'autoEat') { try { bot.deactivateItem(); } catch {} }
  }
  function manual() { manualUntil = Date.now() + 2000; interrupt(); }
  function update(value) {
    interrupt();
    config = value || {};
    for (const key of ['autoEat', 'autoArmor', 'autoFishing']) if (!config[key]?.enabled) report(key, 'idle');
    tick();
  }
  function snapshotHeld() { const item = bot.heldItem; return item ? { item, type: item.type, metadata: item.metadata, name: item.name, nbt: JSON.stringify(item.nbt ?? null), durabilityUsed: item.durabilityUsed } : null; }
  async function restore(held, token, key) {
    if (!held || !valid(token, key) || blocked()) return;
    const items = bot.inventory.items();
    const item = items.includes(held.item) ? held.item : items.find(i => i.type === held.type && i.metadata === held.metadata && i.name === held.name && JSON.stringify(i.nbt ?? null) === held.nbt && i.durabilityUsed === held.durabilityUsed);
    if (item && bot.heldItem !== item) await bot.equip(item, 'hand');
  }
  async function eat(token) {
    const cfg = config.autoEat;
    const food = chooseFood(bot, cfg);
    if (!food) { report('autoEat', 'waiting', 'Uygun yiyecek bulunamadı.'); nextEat = Date.now() + 5000; return; }
    const held = snapshotHeld();
    report('autoEat', 'running');
    await bot.equip(food, 'hand');
    if (!valid(token, 'autoEat') || blocked()) return;
    let timer;
    const cancelled = new Promise(resolve => { cancelActive = () => resolve('cancel'); });
    try {
      const result = await Promise.race([Promise.resolve().then(() => bot.consume()).then(() => 'done'), cancelled, new Promise((_, reject) => { timer = setTimeout(() => { try { bot.deactivateItem(); } catch {} reject(new Error('Yemek işlemi zaman aşımına uğradı.')); }, 6000); })]);
      if (result === 'cancel') return;
    } finally { clearTimeout(timer); cancelActive = undefined; }
    if (!valid(token, 'autoEat')) return;
    report('autoEat', 'idle', undefined, true);
    if (cfg.restoreHeldItem) await restore(held, token, 'autoEat');
  }
  async function armor(token) {
    lastArmor = Date.now();
    let changed = false;
    for (const part of ARMOR) {
      if (!valid(token, 'autoArmor') || blocked()) return;
      const equipped = bot.inventory.slots[part.slot];
      if (equipped && (protectedArmor(equipped) || armorScore(equipped, part.suffix) === 0)) continue;
      const best = bot.inventory.items().filter(i => i.slot >= 9 && armorScore(i, part.suffix) > armorScore(equipped, part.suffix)).sort((a, b) => armorScore(b, part.suffix) - armorScore(a, part.suffix))[0];
      if (!best) continue;
      report('autoArmor', 'running');
      await bot.equip(best, part.destination);
      if (!valid(token, 'autoArmor') || blocked()) return;
      changed = true;
    }
    if (!valid(token, 'autoArmor')) return;
    report('autoArmor', changed ? 'idle' : 'waiting', changed ? undefined : 'Daha iyi zırh bulunamadı.', changed);
  }
  async function fish(token) {
    const cfg = config.autoFishing;
    const rod = bot.inventory.items().find(i => i.name === 'fishing_rod');
    if (!rod) { report('autoFishing', 'waiting', 'Olta bulunamadı.'); nextFish = Date.now() + 5000; return; }
    const water = typeof bot.blockAtCursor === 'function' && bot.blockAtCursor(24, block => block.name === 'water' || block.boundingBox === 'block');
    if (!water || water.name !== 'water') { report('autoFishing', 'waiting', 'Bakış yönünde su bulunamadı.'); nextFish = Date.now() + 5000; return; }
    const held = snapshotHeld();
    report('autoFishing', 'running');
    await bot.equip(rod, 'hand');
    if (!valid(token, 'autoFishing') || blocked()) return;
    let timer;
    const cancelled = new Promise(resolve => { cancelActive = () => resolve('cancel'); });
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve('timeout'), cfg.timeoutSeconds * 1000); });
    const fishing = Promise.resolve(bot.fish()).then(() => 'caught');
    fishingCast = true;
    try {
      const result = await Promise.race([fishing, cancelled, timeout]);
      if (result === 'timeout' && fishingCast) {
        fishingCast = false;
        try { if (options.current() && bot.heldItem?.name === 'fishing_rod') bot.activateItem(); } catch {}
      } else if (result === 'caught') fishingCast = false;
      if (!valid(token, 'autoFishing')) return;
      if (result === 'timeout') report('autoFishing', 'waiting', 'Balık tutma zaman aşımına uğradı.');
      else if (result === 'caught') report('autoFishing', 'idle', undefined, true);
      nextFish = Date.now() + cfg.recastDelaySeconds * 1000;
      await restore(held, token, 'autoFishing');
    } finally { clearTimeout(timer); cancelActive = undefined; fishingCast = false; }
  }
  function tick() {
    if (disposed || !options.current()) return;
    const hungry = config.autoEat?.enabled && bot.food < 20 && (bot.food <= config.autoEat.hungerThreshold || bot.health <= config.autoEat.healthThreshold);
    const needsFood = hungry && Boolean(chooseFood(bot, config.autoEat));
    if (hungry && !needsFood) report('autoEat', 'waiting', 'Uygun yiyecek bulunamadı.');
    if (busy) { if (needsFood && currentAction === 'autoFishing') interrupt(); return; }
    if (blocked()) {
      for (const key of ['autoEat', 'autoArmor', 'autoFishing']) if (config[key]?.enabled) report(key, 'waiting', 'Manuel işlem bekleniyor.');
      return;
    }
    let key, run;
    if (needsFood && Date.now() >= nextEat) { key = 'autoEat'; run = eat; }
    else if (config.autoArmor?.enabled && Date.now() - lastArmor >= config.autoArmor.intervalSeconds * 1000) { key = 'autoArmor'; run = armor; }
    else if (config.autoFishing?.enabled && Date.now() >= nextFish) { key = 'autoFishing'; run = fish; }
    else return;
    busy = true; currentAction = key;
    const token = generation;
    options.enqueue(async () => { if (valid(token, key) && !blocked()) await run(token); }).catch(error => {
      if (valid(token, key)) { report(key, 'error', String(error?.message || error)); if (key === 'autoFishing') nextFish = Date.now() + 5000; if (key === 'autoEat') nextEat = Date.now() + 5000; }
    }).finally(() => { busy = false; currentAction = ''; });
  }
  const timer = setInterval(tick, 1000);
  bot.on('health', tick);
  return { update, manual, stop() { interrupt(); disposed = true; clearInterval(timer); bot.removeListener('health', tick); }, tick };
}
module.exports = { createAutomation, chooseFood, armorScore };
