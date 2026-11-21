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
const HOSTILE_MOBS = new Set([
  'zombie', 'zombie_villager', 'husk', 'drowned', 'skeleton', 'stray', 'bogged', 'wither_skeleton',
  'creeper', 'spider', 'cave_spider', 'enderman', 'witch', 'slime', 'magma_cube', 'phantom',
  'blaze', 'ghast', 'pillager', 'vindicator', 'evoker', 'ravager', 'vex', 'guardian',
  'elder_guardian', 'shulker', 'silverfish', 'endermite', 'hoglin', 'zoglin', 'piglin_brute',
  'warden', 'breeze',
]);
const WEAPON_MATERIAL = { wooden: 1, golden: 1, stone: 2, iron: 3, diamond: 4, netherite: 5 };
const KEEP_TOOL_RE = /(_sword|_axe|_pickaxe|_shovel|_hoe|_helmet|_chestplate|_leggings|_boots)$|^(fishing_rod|bow|crossbow|trident|shield|totem_of_undying|elytra|turtle_helmet)$/;

function armorScore(item, suffix) {
  if (!item) return 0;
  if (suffix === 'helmet' && item.name === 'turtle_helmet') return 200;
  const match = /^(leather|golden|chainmail|iron|diamond|netherite)_(helmet|chestplate|leggings|boots)$/.exec(item.name || '');
  if (!match || match[2] !== suffix) return 0;
  const toughness = match[1] === 'netherite' ? 3 : match[1] === 'diamond' ? 2 : 0;
  return PROTECTION[match[1]][['helmet','chestplate','leggings','boots'].indexOf(suffix)] * 100 + toughness;
}
function weaponScore(item) {
  if (!item || !item.name) return 0;
  const match = /^(wooden|golden|stone|iron|diamond|netherite)_(sword|axe)$/.exec(item.name);
  if (!match) return 0;
  const base = match[2] === 'sword' ? 20 : 10;
  return base + (WEAPON_MATERIAL[match[1]] || 0) * 100;
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
function shouldKeepItem(item, bot, cfg) {
  if (!item || !item.name) return true;
  if (cfg.keepFoods) {
    const foods = bot.registry?.foodsByName || {};
    if (foods[item.name] && !BAD_FOODS.has(item.name)) return true;
  }
  if (cfg.keepToolsAndArmor && KEEP_TOOL_RE.test(item.name)) return true;
  if (Array.isArray(cfg.keepKeywords) && cfg.keepKeywords.length) {
    const hay = `${item.name} ${item.displayName || ''} ${item.customName || ''}`.toLowerCase();
    for (const kw of cfg.keepKeywords) {
      if (typeof kw === 'string' && kw.trim() && hay.includes(kw.trim().toLowerCase())) return true;
    }
  }
  return false;
}
function entityDistance(a, b) {
  if (!a || !b) return Infinity;
  if (typeof a.distanceTo === 'function') return a.distanceTo(b);
  const dx = (a.x || 0) - (b.x || 0);
  const dy = (a.y || 0) - (b.y || 0);
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function findPanicThreat(bot, cfg) {
  const health = bot.health ?? 20;
  if (health <= cfg.healthThreshold) {
    return `Can kritik seviyede (${Math.round(health)} <= ${cfg.healthThreshold})`;
  }
  if (cfg.disconnectOnPlayer && bot.entities && bot.entity?.position) {
    const whitelist = new Set((cfg.whitelist || []).map(n => String(n).trim().toLowerCase()).filter(Boolean));
    for (const entity of Object.values(bot.entities)) {
      if (!entity || entity === bot.entity || entity.type !== 'player' || !entity.position) continue;
      const name = String(entity.username || entity.name || '').trim().toLowerCase();
      if (name && whitelist.has(name)) continue;
      const dist = entityDistance(bot.entity.position, entity.position);
      if (dist <= cfg.playerRadius) {
        return `Yakında yabancı oyuncu algılandı: ${entity.username || 'Oyuncu'} (${dist.toFixed(1)}m)`;
      }
    }
  }
  return null;
}
function findHostileTarget(bot, cfg) {
  if (!bot.entities || !bot.entity?.position) return null;
  let best = null;
  let bestDist = Infinity;
  for (const entity of Object.values(bot.entities)) {
    if (!entity || entity === bot.entity || entity.isValid === false || !entity.position) continue;
    const isHostile = entity.type === 'hostile' || (entity.type === 'mob' && HOSTILE_MOBS.has(entity.name));
    if (!isHostile) continue;
    if (!cfg.attackCreepers && entity.name === 'creeper') continue;
    const dist = entityDistance(bot.entity.position, entity.position);
    if (dist <= cfg.radius && dist < bestDist) {
      best = entity;
      bestDist = dist;
    }
  }
  return best;
}
function countFreeMainSlots(bot) {
  const slots = bot.inventory?.slots;
  if (!Array.isArray(slots)) return 36;
  let free = 0;
  const end = Math.min(45, slots.length);
  for (let i = 9; i < end; i++) {
    if (!slots[i]) free++;
  }
  return free;
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
  let nextTotem = 0;
  let nextDefend = 0;
  let nextChestDump = 0;
  let panicCooldownUntil = 0;
  let panicDisconnecting = false;
  let defendHeld = null;
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
    panicDisconnecting = false;
    for (const key of ['autoPanic', 'autoTotem', 'autoEat', 'autoDefend', 'autoArmor', 'autoChestDump', 'autoFishing']) {
      if (!config[key]?.enabled) report(key, 'idle');
    }
    tick();
  }
  function snapshotHeld() { const item = bot.heldItem; return item ? { item, type: item.type, metadata: item.metadata, name: item.name, nbt: JSON.stringify(item.nbt ?? null), durabilityUsed: item.durabilityUsed } : null; }
  async function restore(held, token, key) {
    if (!held || !valid(token, key) || blocked()) return;
    const items = bot.inventory.items();
    const item = items.includes(held.item) ? held.item : items.find(i => i.type === held.type && i.metadata === held.metadata && i.name === held.name && JSON.stringify(i.nbt ?? null) === held.nbt && i.durabilityUsed === held.durabilityUsed);
    if (item && bot.heldItem !== item) await bot.equip(item, 'hand');
  }

  function desiredOffhandName() {
    const cfg = config.autoTotem;
    if (!cfg?.enabled || !bot.inventory) return null;
    const items = bot.inventory.items();
    const hasTotem = items.some(i => i.name === 'totem_of_undying') || bot.inventory.slots[45]?.name === 'totem_of_undying';
    const hasShield = items.some(i => i.name === 'shield') || bot.inventory.slots[45]?.name === 'shield';
    const critical = (bot.health ?? 20) <= cfg.healthThreshold;
    if (critical || cfg.priorityItem === 'totem') {
      if (hasTotem) return 'totem_of_undying';
      if (cfg.priorityItem === 'shield' && hasShield) return 'shield';
      return null;
    }
    if (hasShield) return 'shield';
    if (hasTotem) return 'totem_of_undying';
    return null;
  }

  async function totem(token) {
    const cfg = config.autoTotem;
    nextTotem = Date.now() + Math.max(1, cfg.intervalSeconds || 1) * 1000;
    const wanted = desiredOffhandName();
    if (!wanted) {
      report('autoTotem', 'waiting', 'Totem veya kalkan bulunamadı.');
      return;
    }
    if (bot.inventory.slots[45]?.name === wanted) {
      report('autoTotem', 'idle');
      return;
    }
    const item = bot.inventory.items().find(i => i.name === wanted);
    if (!item) {
      report('autoTotem', 'waiting', 'Totem veya kalkan bulunamadı.');
      return;
    }
    report('autoTotem', 'running');
    await bot.equip(item, 'off-hand');
    if (!valid(token, 'autoTotem')) return;
    report('autoTotem', 'idle', undefined, true);
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

  async function defend(token) {
    const cfg = config.autoDefend;
    const target = findHostileTarget(bot, cfg);
    if (!target) {
      if (defendHeld && cfg.restoreHeldItem) {
        const prev = defendHeld;
        defendHeld = null;
        await restore(prev, token, 'autoDefend');
      }
      report('autoDefend', 'idle');
      return;
    }
    nextDefend = Date.now() + Math.max(300, cfg.attackIntervalMs || 650);
    if (cfg.restoreHeldItem && !defendHeld) defendHeld = snapshotHeld();
    report('autoDefend', 'running', `${target.displayName || target.name || 'Mob'} saldırılıyor.`);
    if (cfg.autoEquipWeapon) {
      const currentScore = weaponScore(bot.heldItem);
      const bestWeapon = bot.inventory.items()
        .filter(i => weaponScore(i) > currentScore)
        .sort((a, b) => weaponScore(b) - weaponScore(a))[0];
      if (bestWeapon) {
        await bot.equip(bestWeapon, 'hand');
        if (!valid(token, 'autoDefend') || blocked()) return;
      }
    }
    if (typeof bot.lookAt === 'function' && target.position) {
      const aimPos = typeof target.position.offset === 'function'
        ? target.position.offset(0, (target.height || 1.6) * 0.75, 0)
        : target.position;
      try { await bot.lookAt(aimPos, true); } catch {}
      if (!valid(token, 'autoDefend') || blocked()) return;
    }
    if (typeof bot.attack === 'function') {
      bot.attack(target);
    }
    if (valid(token, 'autoDefend')) report('autoDefend', 'idle', undefined, true);
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

  async function chestDump(token) {
    const cfg = config.autoChestDump;
    nextChestDump = Date.now() + Math.max(5, cfg.intervalSeconds || 15) * 1000;
    const freeSlots = countFreeMainSlots(bot);
    if (freeSlots > cfg.freeSlotsThreshold) {
      report('autoChestDump', 'idle');
      return;
    }
    const itemsToDump = bot.inventory.items().filter(i => i.slot >= 9 && i.slot <= 44 && !shouldKeepItem(i, bot, cfg));
    if (!itemsToDump.length) {
      report('autoChestDump', 'waiting', 'Aktarılacak eşya yok.');
      return;
    }
    const chestBlock = typeof bot.findBlock === 'function'
      ? bot.findBlock({ matching: b => b && /chest|barrel|shulker_box/.test(b.name), maxDistance: cfg.searchRadius || 4 })
      : null;
    if (!chestBlock) {
      report('autoChestDump', 'waiting', 'Yakında sandık bulunamadı.');
      return;
    }
    const openFn = typeof bot.openContainer === 'function' ? bot.openContainer.bind(bot) : (typeof bot.openChest === 'function' ? bot.openChest.bind(bot) : null);
    if (!openFn) {
      report('autoChestDump', 'waiting', 'Sandık açma desteklenmiyor.');
      return;
    }
    report('autoChestDump', 'running', 'Sandığa eşya aktarılıyor...');
    let container;
    try {
      container = await openFn(chestBlock);
      if (!container) return;
      for (const item of itemsToDump) {
        if (!valid(token, 'autoChestDump') || disposed) break;
        try {
          await container.deposit(item.type, item.metadata ?? null, item.count);
        } catch {
          break;
        }
      }
    } finally {
      try { container?.close?.(); } catch {}
    }
    if (valid(token, 'autoChestDump')) report('autoChestDump', 'idle', undefined, true);
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

  function handlePanic() {
    const cfg = config.autoPanic;
    if (!cfg?.enabled || panicDisconnecting) return false;
    const reason = findPanicThreat(bot, cfg);
    if (!reason) return false;
    if (Date.now() < panicCooldownUntil) return true;
    interrupt();
    if (cfg.action === 'command') {
      panicCooldownUntil = Date.now() + 5000;
      report('autoPanic', 'running', reason);
      try {
        if (cfg.panicCommand && typeof bot.chat === 'function') bot.chat(cfg.panicCommand);
      } catch {}
      report('autoPanic', 'idle', reason, true);
      return true;
    }
    panicDisconnecting = true;
    report('autoPanic', 'running', reason);
    if (typeof options.onPanicDisconnect === 'function') {
      options.onPanicDisconnect(reason, Boolean(cfg.disableReconnect));
    } else if (typeof bot.quit === 'function') {
      try { bot.quit(); } catch {}
    }
    return true;
  }

  function tick() {
    if (disposed || !options.current()) return;
    if (handlePanic()) return;

    const wantedOffhand = desiredOffhandName();
    const needsTotem = Boolean(config.autoTotem?.enabled && bot.inventory && wantedOffhand && bot.inventory.slots[45]?.name !== wantedOffhand);
    const hungry = config.autoEat?.enabled && bot.food < 20 && (bot.food <= config.autoEat.hungerThreshold || bot.health <= config.autoEat.healthThreshold);
    const needsFood = hungry && Boolean(chooseFood(bot, config.autoEat));
    if (hungry && !needsFood) report('autoEat', 'waiting', 'Uygun yiyecek bulunamadı.');
    const hostileTarget = config.autoDefend?.enabled ? findHostileTarget(bot, config.autoDefend) : null;
    const needsDefend = Boolean(hostileTarget) || Boolean(defendHeld && config.autoDefend?.enabled && config.autoDefend.restoreHeldItem);

    if (busy) {
      if ((needsTotem || needsFood || needsDefend) && currentAction === 'autoFishing') interrupt();
      return;
    }
    if (blocked()) {
      for (const key of ['autoTotem', 'autoEat', 'autoDefend', 'autoArmor', 'autoChestDump', 'autoFishing']) {
        if (config[key]?.enabled) report(key, 'waiting', 'Manuel işlem bekleniyor.');
      }
      return;
    }

    const now = Date.now();
    let key, run;
    if (config.autoTotem?.enabled && (needsTotem || now >= nextTotem)) { key = 'autoTotem'; run = totem; }
    else if (needsFood && now >= nextEat) { key = 'autoEat'; run = eat; }
    else if (config.autoDefend?.enabled && needsDefend && now >= nextDefend) { key = 'autoDefend'; run = defend; }
    else if (config.autoArmor?.enabled && now - lastArmor >= config.autoArmor.intervalSeconds * 1000) { key = 'autoArmor'; run = armor; }
    else if (config.autoChestDump?.enabled && now >= nextChestDump) { key = 'autoChestDump'; run = chestDump; }
    else if (config.autoFishing?.enabled && now >= nextFish) { key = 'autoFishing'; run = fish; }
    else return;

    busy = true; currentAction = key;
    const token = generation;
    options.enqueue(async () => { if (valid(token, key) && !blocked()) await run(token); }).catch(error => {
      if (valid(token, key)) {
        report(key, 'error', String(error?.message || error));
        if (key === 'autoFishing') nextFish = Date.now() + 5000;
        if (key === 'autoEat') nextEat = Date.now() + 5000;
        if (key === 'autoTotem') nextTotem = Date.now() + 2000;
        if (key === 'autoDefend') nextDefend = Date.now() + 1000;
        if (key === 'autoChestDump') nextChestDump = Date.now() + 10000;
      }
    }).finally(() => { busy = false; currentAction = ''; });
  }
  const timer = setInterval(tick, 1000);
  bot.on('health', tick);
  return { update, manual, stop() { interrupt(); disposed = true; clearInterval(timer); bot.removeListener('health', tick); }, tick, report };
}
module.exports = { createAutomation, chooseFood, armorScore, weaponScore, shouldKeepItem };
