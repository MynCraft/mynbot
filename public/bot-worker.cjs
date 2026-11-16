'use strict';
const path = require('node:path');
const mineflayer = require('mineflayer');
const mc = require('minecraft-protocol');
const mcData = require('minecraft-data');
const Vec3 = require('vec3');
const { createAutomation } = require('./builtin-automation.cjs');

const bots = new Map();
const queues = new Map();
const pluginStates = new Map();
const connectTokens = new Map();
const TESTED_VERSION_SET = new Set(mineflayer.testedVersions || []);
const PLUGIN_NAME_RE = /^[a-zA-Z0-9._-]+\.(cjs|js)$/;

const MC_LEGACY_COLORS = {
  '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa',
  '4': '#aa0000', '5': '#aa00aa', '6': '#ffaa00', '7': '#aaaaaa',
  '8': '#555555', '9': '#5555ff', 'a': '#55ff55', 'b': '#55ffff',
  'c': '#ff5555', 'd': '#ff55ff', 'e': '#ffff55', 'f': '#ffffff',
};

const MC_NAMED_COLORS = {
  black: '#000000', dark_blue: '#0000aa', dark_green: '#00aa00', dark_aqua: '#00aaaa',
  dark_red: '#aa0000', dark_purple: '#aa00aa', gold: '#ffaa00', gray: '#aaaaaa',
  dark_gray: '#555555', blue: '#5555ff', green: '#55ff55', aqua: '#55ffff',
  red: '#ff5555', light_purple: '#ff55ff', yellow: '#ffff55', white: '#ffffff',
};

const PUA_RE = /[\uE000-\uF8FF\u{F0000}-\u{10FFFD}]/gu;

function stripPua(text) {
  return String(text || '').replace(PUA_RE, '').replace(/\s{2,}/g, ' ').trimStart();
}

function extractReasonText(node) {
  if (node == null) return '';
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed !== node) return extractReasonText(parsed);
      } catch {}
    }
    return node;
  }
  if (Array.isArray(node)) return node.map(extractReasonText).join('');
  if (typeof node === 'object') {
    if (node.type === 'compound' && node.value) return extractReasonText(node.value);
    if (node.type === 'list' && node.value?.value) return extractReasonText(node.value.value);
    if (node.type === 'string' && typeof node.value === 'string') return extractReasonText(node.value);
    if (node.value !== undefined && Object.keys(node).length <= 2 && node.type) return extractReasonText(node.value);

    const head = node.text !== undefined ? extractReasonText(node.text) : (node.translate !== undefined ? extractReasonText(node.translate) : '');
    const withPart = node.with ? extractReasonText(node.with) : '';
    const tail = node.extra ? extractReasonText(node.extra) : '';
    if (head || withPart || tail) return `${head}${withPart}${tail}`;
    return '';
  }
  return '';
}

function cleanChatText(text) {
  if (text == null) return '';
  if (typeof text === 'string') {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      text = extractReasonText(text);
    }
  } else {
    text = extractReasonText(text);
  }
  return stripPua(String(text || '').replace(/§#[0-9a-fA-F]{6}/g, '').replace(/§[0-9a-fk-orA-FK-OR]/g, '')).trim();
}

function formatReason(reason) {
  if (reason == null) return '';
  const extracted = cleanChatText(extractReasonText(reason));
  if (extracted) return extracted;
  return typeof reason === 'string' ? cleanChatText(reason) : JSON.stringify(reason);
}

function parseMotdSegments(motd, baseStyle = {}) {
  const segments = [];
  let style = { ...baseStyle };
  let buffer = '';
  const flush = () => {
    const clean = buffer.replace(PUA_RE, '');
    buffer = '';
    if (!clean) return;
    segments.push({ text: clean, ...style });
  };

  for (let i = 0; i < motd.length; i++) {
    if (motd[i] === '§' && i + 1 < motd.length) {
      if (motd[i + 1] === '#' && /^#[0-9a-fA-F]{6}/.test(motd.slice(i + 1, i + 8))) {
        flush();
        style = { ...style, color: motd.slice(i + 1, i + 8) };
        i += 7;
        continue;
      }
      const code = motd[i + 1].toLowerCase();
      if (MC_LEGACY_COLORS[code]) {
        flush();
        style = { ...style, color: MC_LEGACY_COLORS[code] };
        i++;
        continue;
      }
      if (code === 'l') { flush(); style = { ...style, bold: true }; i++; continue; }
      if (code === 'o') { flush(); style = { ...style, italic: true }; i++; continue; }
      if (code === 'n') { flush(); style = { ...style, underlined: true }; i++; continue; }
      if (code === 'm') { flush(); style = { ...style, strikethrough: true }; i++; continue; }
      if (code === 'r') { flush(); style = { ...baseStyle }; i++; continue; }
      if (code === 'k') { i++; continue; }
    }
    buffer += motd[i];
  }
  flush();
  return segments;
}

function parseChatToSegments(val, inheritedStyle = {}) {
  if (val == null) return [];
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        const parsed = JSON.parse(val);
        return parseChatToSegments(parsed, inheritedStyle);
      } catch {}
    }
    return parseMotdSegments(val, inheritedStyle);
  }
  if (Array.isArray(val)) {
    return val.flatMap(child => parseChatToSegments(child, inheritedStyle));
  }
  if (typeof val === 'object') {
    if (val.type === 'compound' && val.value) return parseChatToSegments(val.value, inheritedStyle);
    if (val.type === 'list' && val.value?.value) return parseChatToSegments(val.value.value, inheritedStyle);
    if (val.type === 'string' && typeof val.value === 'string') return parseChatToSegments(val.value, inheritedStyle);

    const style = { ...inheritedStyle };
    const rawColor = typeof val.color === 'object' && val.color?.value ? val.color.value : val.color;
    if (rawColor) {
      const c = String(rawColor).toLowerCase();
      style.color = MC_NAMED_COLORS[c] || (c.startsWith('#') ? c : style.color);
    }
    const rawBold = typeof val.bold === 'object' && val.bold?.value !== undefined ? val.bold.value : val.bold;
    if (typeof rawBold === 'boolean') style.bold = rawBold;
    const rawItalic = typeof val.italic === 'object' && val.italic?.value !== undefined ? val.italic.value : val.italic;
    if (typeof rawItalic === 'boolean') style.italic = rawItalic;
    const rawUnderlined = typeof val.underlined === 'object' && val.underlined?.value !== undefined ? val.underlined.value : val.underlined;
    if (typeof rawUnderlined === 'boolean') style.underlined = rawUnderlined;
    const rawStrikethrough = typeof val.strikethrough === 'object' && val.strikethrough?.value !== undefined ? val.strikethrough.value : val.strikethrough;
    if (typeof rawStrikethrough === 'boolean') style.strikethrough = rawStrikethrough;

    let segments = [];
    const rawTextVal = val.text != null ? val.text : (val.translate != null ? val.translate : '');
    const textVal = typeof rawTextVal === 'object' && rawTextVal?.type === 'string' && typeof rawTextVal.value === 'string' ? rawTextVal.value : rawTextVal;
    if (typeof textVal === 'string' && textVal) {
      segments = parseMotdSegments(textVal, style);
    } else if (textVal && typeof textVal === 'object') {
      segments = parseChatToSegments(textVal, style);
    }
    const extraVal = val.extra?.value || val.extra;
    if (Array.isArray(extraVal)) {
      for (const extraChild of extraVal) {
        segments = segments.concat(parseChatToSegments(extraChild, style));
      }
    }
    return segments;
  }
  return [];
}

function findTextureBase64(node) {
  if (!node) return null;
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed.length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(trimmed)) {
      try {
        const stdB64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(stdB64, 'base64').toString('utf8');
        if (decoded.includes('textures') || decoded.includes('SKIN') || decoded.includes('http')) return trimmed;
      } catch {}
    }
    return null;
  }
  if (node instanceof Map) {
    for (const val of node.values()) {
      const res = findTextureBase64(val);
      if (res) return res;
    }
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const res = findTextureBase64(item);
      if (res) return res;
    }
    return null;
  }
  if (typeof node === 'object') {
    if (node.properties) {
      const res = findTextureBase64(node.properties);
      if (res) return res;
    }
    if (node.data) {
      const res = findTextureBase64(node.data);
      if (res) return res;
    }
    if (node.Value) {
      const res = findTextureBase64(node.Value);
      if (res) return res;
    }
    if (node.value) {
      const res = findTextureBase64(node.value);
      if (res) return res;
    }
    for (const key of Object.keys(node)) {
      if (key === 'properties' || key === 'data' || key === 'Value' || key === 'value') continue;
      const res = findTextureBase64(node[key]);
      if (res) return res;
    }
  }
  return null;
}

function getItemComponent(item, ...names) {
  if (!item) return undefined;
  const allNames = [];
  for (const n of names) {
    if (!n) continue;
    allNames.push(n);
    if (!n.startsWith('minecraft:')) allNames.push(`minecraft:${n}`);
    else allNames.push(n.replace(/^minecraft:/, ''));
  }
  const uniqueNames = [...new Set(allNames)];

  // 1. Check componentMap (Map in 1.20.5+ prismarine-item)
  if (item.componentMap instanceof Map) {
    for (const name of uniqueNames) {
      if (item.componentMap.has(name)) {
        const comp = item.componentMap.get(name);
        const val = comp?.data !== undefined ? comp.data : comp;
        if (val !== undefined) return val;
      }
    }
  }

  // 2. Check components (Array of { type, data })
  if (Array.isArray(item.components)) {
    for (const name of uniqueNames) {
      const found = item.components.find(c => c?.type === name);
      if (found !== undefined) {
        const val = found?.data !== undefined ? found.data : found;
        if (val !== undefined) return val;
      }
    }
  }

  // 3. Plain object lookup on item.componentMap, item.components, or item
  const compObjs = [item.componentMap, item.components].filter(o => o && typeof o === 'object' && !(o instanceof Map) && !Array.isArray(o));
  for (const compObj of compObjs) {
    for (const name of uniqueNames) {
      if (compObj[name] !== undefined) {
        const val = compObj[name]?.data !== undefined ? compObj[name].data : compObj[name];
        if (val !== undefined) return val;
      }
    }
  }

  return undefined;
}

function extractHeadTextureUrl(item) {
  if (!item || !item.name) return undefined;
  if (!item.name.includes('head') && !item.name.includes('skull')) return undefined;
  const profileComp = getItemComponent(item, 'profile', 'minecraft:profile');
  const b64 = findTextureBase64(profileComp) || findTextureBase64(item.nbt) || findTextureBase64(item.components) || findTextureBase64(item.componentMap);
  if (!b64) return undefined;
  try {
    const stdB64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(stdB64, 'base64').toString('utf8'));
    const url = json?.textures?.SKIN?.url || json?.textures?.skin?.url;
    if (typeof url === 'string' && url) {
      return url.replace(/^http:\/\//i, 'https://');
    }
  } catch {}
  return undefined;
}

function extractRawCustomName(item) {
  if (!item) return null;
  if (item.customName) return item.customName;
  if (item.nbt?.value?.display?.value?.Name?.value != null) return item.nbt.value.display.value.Name.value;
  const compName = getItemComponent(item, 'custom_name', 'item_name');
  if (compName != null) return compName;
  return null;
}

function extractLoreSegments(item) {
  if (!item) return undefined;
  let rawLore = null;
  if (item.customLore) rawLore = item.customLore;
  else if (item.nbt?.value?.display?.value?.Lore?.value?.value) {
    const val = item.nbt.value.display.value.Lore.value.value;
    rawLore = Array.isArray(val) ? val.map(e => (typeof e === 'object' && e?.value !== undefined ? e.value : e)) : val;
  } else {
    const compLore = getItemComponent(item, 'lore', 'minecraft:lore');
    if (compLore != null) rawLore = compLore;
  }
  if (!rawLore) return undefined;
  const lines = Array.isArray(rawLore) ? rawLore : [rawLore];
  const parsed = [];
  for (const line of lines.slice(0, 20)) {
    const segs = parseChatToSegments(line);
    if (segs.length > 0) {
      parsed.push(segs);
    } else {
      const clean = cleanChatText(line);
      if (clean) parsed.push([{ text: clean, color: '#aaaaaa' }]);
    }
  }
  return parsed.length > 0 ? parsed : undefined;
}

function extractCustomModelData(item) {
  if (!item) return undefined;

  // 1. Direct NBT: CustomModelData
  const nbtCmd = item.nbt?.value?.CustomModelData?.value;
  if (typeof nbtCmd === 'number') return Math.round(nbtCmd);
  if (typeof nbtCmd === 'string' && /^-?\d+$/.test(nbtCmd)) return parseInt(nbtCmd, 10);

  // 2. Component: custom_model_data (1.20.5+)
  const compCmd = getItemComponent(item, 'custom_model_data', 'minecraft:custom_model_data');
  if (typeof compCmd === 'number') return Math.round(compCmd);
  if (typeof compCmd === 'string' && /^-?\d+$/.test(compCmd)) return parseInt(compCmd, 10);
  if (compCmd && typeof compCmd === 'object') {
    if (typeof compCmd.value === 'number') return Math.round(compCmd.value);
    if (typeof compCmd.value === 'string' && /^-?\d+$/.test(compCmd.value)) return parseInt(compCmd.value, 10);
    // 1.21.4+ floats format: { floats: [10001, ...] }
    if (Array.isArray(compCmd.floats) && typeof compCmd.floats[0] === 'number') {
      return Math.round(compCmd.floats[0]);
    }
  }

  // 3. Custom data / PublicBukkitValues (nested custom data)
  const customData = getItemComponent(item, 'custom_data', 'minecraft:custom_data');
  if (customData && typeof customData === 'object') {
    const nested = customData.CustomModelData ?? customData['minecraft:custom_model_data'] ?? customData.custom_model_data;
    if (typeof nested === 'number') return Math.round(nested);
    if (nested && typeof nested.value === 'number') return Math.round(nested.value);
  }

  const pbv = item.nbt?.value?.PublicBukkitValues?.value;
  if (pbv && typeof pbv === 'object') {
    for (const key of Object.keys(pbv)) {
      if (key.toLowerCase().includes('custommodeldata') || key.toLowerCase().includes('custom_model_data')) {
        const val = pbv[key]?.value !== undefined ? pbv[key].value : pbv[key];
        if (typeof val === 'number') return Math.round(val);
      }
    }
  }

  return undefined;
}

function serialize(item) {
  if (!item) return null;
  const rawCustom = extractRawCustomName(item);
  let customName;
  let nameSegments;
  if (rawCustom != null) {
    const segs = parseChatToSegments(rawCustom);
    const meaningfulSegs = segs.filter(s => s && s.text && stripPua(s.text).trim().length > 0);
    const plainFromSegs = cleanChatText(segs.map(s => s.text).join(''));
    const plainFromRaw = cleanChatText(rawCustom);
    const plain = plainFromSegs || plainFromRaw;
    if (plain && meaningfulSegs.length > 0) {
      nameSegments = meaningfulSegs;
      customName = plain;
    } else if (plain) {
      customName = plain;
    }
  }
  const lore = extractLoreSegments(item);
  const headTextureUrl = extractHeadTextureUrl(item);
  const enchanted = Boolean((item.enchants && item.enchants.length) || item.nbt?.value?.Enchantments || item.nbt?.value?.StoredEnchantments);
  const customModelData = extractCustomModelData(item);

  let defaultDisplayName = item.displayName || item.name;
  if (typeof defaultDisplayName === 'string' && (defaultDisplayName.startsWith('{') || defaultDisplayName.startsWith('['))) {
    const cleaned = cleanChatText(defaultDisplayName);
    defaultDisplayName = cleaned || item.name;
  }
  const displayName = customName || defaultDisplayName || item.name;

  return {
    name: item.name,
    displayName,
    count: item.count,
    ...(customName ? { customName } : {}),
    ...(nameSegments && nameSegments.length ? { nameSegments } : {}),
    ...(lore && lore.length ? { lore } : {}),
    ...(headTextureUrl ? { headTextureUrl } : {}),
    ...(enchanted ? { enchanted: true } : {}),
    ...(customModelData != null ? { customModelData } : {}),
  };
}

const send = value => { if (process.connected) process.send(value); };
const status = (username, state, message) => send({ type: 'status', username, state, message });
const logLine = (username, message) => send({ type: 'log', username, message: String(message).slice(0, 500) });

function clearCursor(instance) {
  if (!instance) return;
  if (instance.inventory) instance.inventory.selectedItem = null;
  if (instance.currentWindow) instance.currentWindow.selectedItem = null;
}

function isChunkLoadedAt(bot, pos) {
  if (!bot || !pos || typeof bot.blockAt !== 'function') return false;
  const floored = pos.floored ? pos.floored() : new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  return bot.blockAt(floored) !== null;
}

function serializeWindow(bot, username) {
  if (!bot || !bot.currentWindow) return null;
  const win = bot.currentWindow;
  if (!win._mynbotBound) {
    win._mynbotBound = true;
    win.on('updateSlot', () => scheduleInventory(username, bot));
  }
  const totalSlots = Array.isArray(win.slots) ? win.slots.length : 0;
  const containerSlotCount = typeof win.inventoryStart === 'number' ? win.inventoryStart : Math.max(0, totalSlots - 36);
  const titleSegments = parseChatToSegments(win.title);
  const rawTitle = formatReason(win.title) || cleanChatText(titleSegments.map(s => s.text).join(''));
  const type = String(win.type || '');
  return {
    id: win.id,
    type,
    title: stripPua(rawTitle || type || 'Konteyner'),
    containerSlotCount,
    totalSlots,
    slots: win.slots.map((item, slot) => item && ({ slot, ...serialize(item) })).filter(Boolean),
    ...(titleSegments.length ? { titleSegments } : {}),
  };
}

function inventory(username, bot) {
  if (bots.get(username) !== bot) return;
  const st = getState(username);
  if (st.invTimer) {
    clearTimeout(st.invTimer);
    st.invTimer = null;
  }
  if (!bot.currentWindow && (bot.inventory?.slots || []).every(s => !s)) {
    clearCursor(bot);
  }
  const activeWin = bot.currentWindow || bot.inventory;
  const totalSlots = activeWin && Array.isArray(activeWin.slots) ? activeWin.slots.length : (bot.inventory?.slots?.length || 0);
  const cursorItem = activeWin ? activeWin.selectedItem : bot.inventory?.selectedItem;
  send({
    type: 'inventory',
    username,
    selectedSlot: bot.quickBarSlot || 0,
    slotCount: totalSlots,
    cursor: serialize(cursorItem),
    inventory: (bot.inventory?.slots || []).map((item, slot) => item && ({ slot, ...serialize(item) })).filter(Boolean),
    openWindow: serializeWindow(bot, username),
  });
}

function scheduleInventory(username, instance, delayMs = 20) {
  if (bots.get(username) !== instance) return;
  const st = getState(username);
  if (st.invTimer) clearTimeout(st.invTimer);
  st.invTimer = setTimeout(() => {
    st.invTimer = null;
    if (bots.get(username) === instance) {
      inventory(username, instance);
    }
  }, delayMs);
}

function classifyInteractable(name) {
  if (!name || typeof name !== 'string') return undefined;
  if (/chest|barrel|shulker_box/.test(name)) return 'chest';
  if (/anvil/.test(name)) return 'anvil';
  if (name === 'crafting_table') return 'crafting';
  if (/furnace|smoker|blast_furnace/.test(name)) return 'furnace';
  if (/hopper|dispenser|dropper|brewing_stand|enchanting_table/.test(name)) return 'container';
  return undefined;
}

function sendPose(username, bot) {
  if (bots.get(username) !== bot || !bot.entity || !bot.entity.position) return;
  const pos = bot.entity.position;
  const chunkLoaded = isChunkLoadedAt(bot, pos);
  send({
    type: 'pose',
    username,
    pose: {
      x: Number(pos.x.toFixed(2)),
      y: Number(pos.y.toFixed(2)),
      z: Number(pos.z.toFixed(2)),
      yaw: Number(bot.entity.yaw.toFixed(2)),
      pitch: Number(bot.entity.pitch.toFixed(2)),
      health: Math.round(bot.health ?? 20),
      food: Math.round(bot.food ?? 20),
      physicsEnabled: Boolean(bot.physicsEnabled),
      onGround: Boolean(bot.entity.onGround),
      chunkLoaded,
    },
  });
}

function sendWorld(username, bot) {
  if (bots.get(username) !== bot || !bot.entity || !bot.entity.position || typeof bot.blockAt !== 'function') return;
  const pos = bot.entity.position;
  const cx = Math.floor(pos.x);
  const cy = Math.floor(pos.y);
  const cz = Math.floor(pos.z);
  const blocks = [];
  for (let dx = -4; dx <= 4; dx++) {
    for (let dy = -2; dy <= 3; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        const b = bot.blockAt(new Vec3(cx + dx, cy + dy, cz + dz));
        if (!b || b.name === 'air' || b.name === 'cave_air' || b.name === 'void_air') continue;
        const blockCenter = new Vec3(cx + dx + 0.5, cy + dy + 0.5, cz + dz + 0.5);
        const distance = Number(pos.distanceTo(blockCenter).toFixed(2));
        const interactable = classifyInteractable(b.name);
        blocks.push({
          dx,
          dy,
          dz,
          x: cx + dx,
          y: cy + dy,
          z: cz + dz,
          name: b.name,
          displayName: b.displayName || b.name,
          ...(interactable ? { interactable } : {}),
          distance,
        });
      }
    }
  }

  const entities = [];
  if (bot.entities) {
    for (const id in bot.entities) {
      const e = bot.entities[id];
      if (!e || e === bot.entity || !e.position) continue;
      const dist = Number(pos.distanceTo(e.position).toFixed(2));
      if (dist > 8) continue;
      const rawName = e.name || e.username || e.type || 'entity';
      const rawDisplay = e.username || e.displayName || e.customName || e.name || 'Varlık';
      const cleanDisplay = cleanChatText(typeof rawDisplay === 'string' ? rawDisplay : extractReasonText(rawDisplay)) || rawName;
      const isPlayer = e.type === 'player';
      const isNpc = !isPlayer && Boolean(e.username || e.customName || ['armor_stand', 'villager', 'npc', 'allay', 'interaction'].includes(e.name));
      const entType = isPlayer ? 'player' : (isNpc ? 'npc' : (e.type === 'mob' || e.type === 'hostile' || e.type === 'passive' ? 'mob' : 'object'));
      entities.push({
        id: Number(e.id),
        name: String(rawName),
        displayName: cleanDisplay,
        type: entType,
        x: Number(e.position.x.toFixed(1)),
        y: Number(e.position.y.toFixed(1)),
        z: Number(e.position.z.toFixed(1)),
        distance: dist,
      });
    }
    entities.sort((a, b) => a.distance - b.distance);
  }

  send({
    type: 'world',
    username,
    world: {
      center: { x: cx, y: cy, z: cz },
      blocks,
      entities: entities.slice(0, 16),
    },
  });
}

function getState(username) {
  let state = pluginStates.get(username);
  if (!state) {
    state = {
      plugins: null,
      pluginsDir: '',
      afkTimer: null,
      joinTimer: null,
      moveTimer: null,
      lobbyTimer: null,
      schedulerTimer: null,
      cleanups: [],
      parsedChatListeners: [],
      recentLines: [],
      recentLoginLines: [],
      lastAutoReplyAt: 0,
      lastAutoLoginAt: 0,
      lastAutoAcceptAt: 0,
      recentSentMessages: [],
      loginCommandSent: false,
      pendingJoinChat: false,
      lastPoseSentAt: 0,
      lastWorldSentAt: 0,
      lastWorldCenter: null,
      invTimer: null,
      automation: null,
      automationStatuses: {},
      workerStatuses: {},
      schedulerLastRun: {},
      lobbyCompleted: false,
      lobbyPendingWindow: false,
      manualControls: new Set(),
    };
    pluginStates.set(username, state);
  }
  return state;
}

function sendCombinedAutomation(username) {
  const state = pluginStates.get(username);
  if (!state) return;
  send({
    type: 'automation',
    username,
    automation: {
      ...(state.automationStatuses || {}),
      ...(state.workerStatuses || {}),
    },
  });
}

function reportWorkerAutomation(username, key, statusState, message, finished = false) {
  const state = getState(username);
  const old = state.workerStatuses[key];
  const next = {
    state: statusState,
    ...(message ? { message } : {}),
    ...(finished ? { lastRunAt: Date.now() } : old?.lastRunAt ? { lastRunAt: old.lastRunAt } : {}),
  };
  if (JSON.stringify(old) !== JSON.stringify(next)) {
    state.workerStatuses[key] = next;
    sendCombinedAutomation(username);
  }
}

function stopAfk(username, bot) {
  const state = pluginStates.get(username);
  if (!state) return;
  if (state.afkTimer) {
    clearInterval(state.afkTimer);
    state.afkTimer = null;
  }
  if (bot && bots.get(username) === bot && typeof bot.setControlState === 'function') {
    try { bot.setControlState('jump', false); } catch { /* ignore */ }
  }
}

function applyAntiAfk(username, bot) {
  stopAfk(username, bot);
  const state = getState(username);
  const afk = state.plugins?.antiAfk;
  if (!afk?.enabled || bots.get(username) !== bot || !bot.entity) return;
  const intervalMs = Math.max(5, Number(afk.intervalSeconds) || 30) * 1000;
  state.afkTimer = setInterval(() => {
    if (bots.get(username) !== bot || !bot.entity) { stopAfk(username, bot); return; }
    try {
      if (afk.rotate && typeof bot.look === 'function') {
        const yaw = bot.entity.yaw + (Math.random() - 0.5) * 0.8;
        const pitch = Math.max(-1.2, Math.min(1.2, (Math.random() - 0.5) * 0.4));
        void bot.look(yaw, pitch, false);
      }
      if (afk.jump && typeof bot.setControlState === 'function') {
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bots.get(username) === bot) {
            try { bot.setControlState('jump', false); } catch { /* ignore */ }
          }
        }, 250);
      }
    } catch (error) {
      logLine(username, `Anti-AFK hatası: ${String(error)}`);
    }
  }, intervalMs);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recordSentMessage(username, text) {
  const state = getState(username);
  const clean = String(text || '').trim();
  if (!clean) return;
  const now = Date.now();
  state.recentSentMessages = state.recentSentMessages
    .filter(item => now - item.at <= 5000)
    .slice(-9);
  state.recentSentMessages.push({ text: clean, at: now });
}

function isSelfMessage(username, raw, parsed) {
  if (parsed?.sender && parsed.sender.toLowerCase() === username.toLowerCase()) return true;
  const text = String(raw || '').trim();
  if (!text) return false;
  if (text.startsWith(`<${username}>`) || text.startsWith(`[${username}]`)) return true;
  if (!parsed) {
    const escapedUser = escapeRegExp(username);
    const senderPrefixRe = new RegExp(`(?:^|\\b)${escapedUser}\\s*[»:\\]>]`, 'i');
    if (senderPrefixRe.test(text)) return true;
  }
  const state = getState(username);
  const now = Date.now();
  state.recentSentMessages = state.recentSentMessages.filter(item => now - item.at <= 5000);
  const lowerText = text.toLowerCase();
  return state.recentSentMessages.some(item => {
    const lowerSent = item.text.toLowerCase();
    return lowerText === lowerSent || lowerText.endsWith(lowerSent);
  });
}

function sendJoinChatNow(username, bot) {
  const state = getState(username);
  state.pendingJoinChat = false;
  if (state.joinTimer) { clearTimeout(state.joinTimer); state.joinTimer = null; }
  const chatCfg = state.plugins?.autoChat;
  const joinMsg = chatCfg?.joinMessage?.trim();
  if (!chatCfg?.enabled || !joinMsg || bots.get(username) !== bot) return;
  try {
    const text = joinMsg.slice(0, 256);
    recordSentMessage(username, text);
    state.lastAutoReplyAt = Date.now();
    bot.chat(text);
    logLine(username, `Otomatik giriş mesajı gönderildi.`);
  } catch (error) {
    send({ type: 'operation-error', username, message: `Otomatik giriş mesajı hatası: ${String(error)}` });
  }
}

function triggerJoinChat(username, bot) {
  const state = getState(username);
  if (state.joinTimer) { clearTimeout(state.joinTimer); state.joinTimer = null; }
  state.pendingJoinChat = false;
  const chatCfg = state.plugins?.autoChat;
  const joinMsg = chatCfg?.joinMessage?.trim();
  if (!chatCfg?.enabled || !joinMsg) return;

  const loginCfg = state.plugins?.autoLogin;
  const waitForAutoLogin = Boolean(
    loginCfg?.enabled &&
    loginCfg.password &&
    Array.isArray(loginCfg.patterns) &&
    loginCfg.patterns.length &&
    !state.loginCommandSent
  );

  if (waitForAutoLogin) {
    state.pendingJoinChat = true;
    state.joinTimer = setTimeout(() => sendJoinChatNow(username, bot), 10000);
    return;
  }

  state.joinTimer = setTimeout(() => sendJoinChatNow(username, bot), 800);
}

function tryParseChat(username, text) {
  const state = getState(username);
  const now = Date.now();
  state.recentLines.push({ text, at: now });
  if (state.recentLines.length > 20) state.recentLines = state.recentLines.slice(-20);

  const patterns = Array.isArray(state.plugins?.chatPatterns) ? [...state.plugins.chatPatterns] : [];
  if (!patterns.length) return null;
  patterns.sort((a, b) => (b.lineCount || 1) - (a.lineCount || 1));

  for (const rule of patterns) {
    const count = Array.isArray(rule.regexLines) ? rule.regexLines.length : 0;
    if (!count || state.recentLines.length < count) continue;
    const slice = state.recentLines.slice(-count);
    if (now - slice[0].at > 3000) continue;

    let sender = '';
    let message = '';
    let matched = true;
    for (let i = 0; i < count; i++) {
      let re;
      try { re = new RegExp(rule.regexLines[i], 'i'); } catch { matched = false; break; }
      const m = re.exec(slice[i].text);
      if (!m) { matched = false; break; }
      if (m.groups?.sender) sender = m.groups.sender;
      if (m.groups?.message) message = m.groups.message.trim();
    }
    if (matched && message) {
      state.recentLines.splice(state.recentLines.length - count, count);
      return {
        type: rule.type === 'pm' ? 'pm' : 'chat',
        ruleName: rule.name || '',
        sender,
        message,
        rawLines: slice.map(item => item.text),
      };
    }
  }
  return null;
}

function handleAutoChat(username, bot, text, parsed) {
  const state = getState(username);
  const chatCfg = state.plugins?.autoChat;
  if (!chatCfg?.enabled || !Array.isArray(chatCfg.rules) || !chatCfg.rules.length) return;
  const raw = String(text || '');
  if (isSelfMessage(username, raw, parsed)) return;
  const cooldownMs = Math.max(1, Number(chatCfg.cooldownSeconds) || 3) * 1000;
  if (Date.now() - state.lastAutoReplyAt < cooldownMs) return;

  const targetText = (parsed ? parsed.message : raw).toLowerCase();

  for (const rule of chatCfg.rules) {
    const scope = rule.scope === 'pm' || rule.scope === 'chat' ? rule.scope : 'all';
    if (scope !== 'all' && (!parsed || parsed.type !== scope)) continue;
    const trigger = typeof rule.trigger === 'string' ? rule.trigger.trim() : '';
    const response = typeof rule.response === 'string' ? rule.response.trim() : '';
    if (!trigger || !response) continue;
    if (targetText.includes(trigger.toLowerCase())) {
      const reply = response
        .replace(/\{username\}/gi, username)
        .replace(/\{sender\}/gi, parsed?.sender || '')
        .replace(/\{message\}/gi, parsed?.message || raw)
        .slice(0, 256);
      state.lastAutoReplyAt = Date.now();
      recordSentMessage(username, reply);
      try {
        bot.chat(reply);
      } catch (error) {
        send({ type: 'operation-error', username, message: `Otomatik sohbet yanıt hatası: ${String(error)}` });
      }
      break;
    }
  }
}

function handleAutoLogin(username, bot, text, source = 'chat') {
  const state = getState(username);
  const now = Date.now();
  const raw = String(text || '');
  if (!raw) return;

  if (source === 'chat') {
    state.recentLoginLines.push({ text: raw, at: now });
    if (state.recentLoginLines.length > 20) state.recentLoginLines = state.recentLoginLines.slice(-20);
  }

  const loginCfg = state.plugins?.autoLogin;
  if (!loginCfg?.enabled || !loginCfg.password || !Array.isArray(loginCfg.patterns) || !loginCfg.patterns.length) return;
  if (source !== 'chat' && loginCfg.listenTitleActionbar === false) return;
  if (isSelfMessage(username, raw, null)) return;

  const cooldownMs = Math.max(1, Number(loginCfg.cooldownSeconds) || 5) * 1000;
  if (now - state.lastAutoLoginAt < cooldownMs) return;

  const patterns = [...loginCfg.patterns].sort((a, b) => (b.lineCount || 1) - (a.lineCount || 1));

  for (const rule of patterns) {
    const count = Array.isArray(rule.regexLines) ? rule.regexLines.length : 0;
    if (!count) continue;
    let slice;
    if (source === 'chat') {
      if (state.recentLoginLines.length < count) continue;
      slice = state.recentLoginLines.slice(-count);
      if (now - slice[0].at > 3000) continue;
    } else {
      if (count !== 1) continue;
      slice = [{ text: raw, at: now }];
    }

    let matched = true;
    for (let i = 0; i < count; i++) {
      let re;
      try { re = new RegExp(rule.regexLines[i], 'i'); } catch { matched = false; break; }
      if (!re.test(slice[i].text)) { matched = false; break; }
    }
    if (!matched) continue;

    if (source === 'chat') {
      state.recentLoginLines.splice(state.recentLoginLines.length - count, count);
    }
    const isRegister = rule.action === 'register';
    const template = isRegister
      ? (loginCfg.registerCommand || '/register {password} {password}')
      : (loginCfg.loginCommand || '/login {password}');
    const command = template
      .replace(/\{password\}/gi, () => loginCfg.password)
      .replace(/\{username\}/gi, () => username)
      .slice(0, 256);

    state.lastAutoLoginAt = now;
    state.loginCommandSent = true;
    recordSentMessage(username, command);
    try {
      bot.chat(command);
      const maskedTemplate = template.replace(/\{password\}/gi, '***').replace(/\{username\}/gi, () => username);
      logLine(username, `Otomatik ${isRegister ? 'kayıt' : 'giriş'} komutu gönderildi: ${maskedTemplate}`);
      if (state.pendingJoinChat) {
        if (state.joinTimer) { clearTimeout(state.joinTimer); state.joinTimer = null; }
        state.joinTimer = setTimeout(() => sendJoinChatNow(username, bot), 800);
      }
      if (state.plugins?.autoLobby?.enabled && !state.lobbyCompleted) {
        scheduleAutoLobby(username, bot);
      }
    } catch (error) {
      const safeErr = String(error).split(loginCfg.password).join('***');
      send({ type: 'operation-error', username, message: `Otomatik giriş hatası: ${safeErr}` });
    }
    break;
  }
}

function handleAutoAccept(username, bot, text, parsed) {
  const state = getState(username);
  const acceptCfg = state.plugins?.autoAccept;
  if (!acceptCfg?.enabled) return;
  const raw = String(text || '');
  if (!raw) return;
  if (isSelfMessage(username, raw, parsed)) return;

  const cooldownMs = Math.max(1, Number(acceptCfg.cooldownSeconds) || 3) * 1000;
  if (Date.now() - state.lastAutoAcceptAt < cooldownMs) return;

  const triggers = Array.isArray(acceptCfg.triggers) ? acceptCfg.triggers : [];
  const lowerRaw = raw.toLowerCase();
  const matchedTrigger = triggers.some(tr => typeof tr === 'string' && tr.trim() && lowerRaw.includes(tr.trim().toLowerCase()));
  if (!matchedTrigger) return;

  if (acceptCfg.onlyWhitelist) {
    const whitelist = Array.isArray(acceptCfg.whitelist) ? acceptCfg.whitelist.map(w => String(w).trim().toLowerCase()).filter(Boolean) : [];
    const senderLower = parsed?.sender ? parsed.sender.toLowerCase() : '';
    const allowed = whitelist.some(name => (senderLower && senderLower === name) || lowerRaw.includes(name));
    if (!allowed) {
      reportWorkerAutomation(username, 'autoAccept', 'waiting', 'Beyaz liste dışı istek yoksayıldı.');
      return;
    }
  }

  const cmd = (typeof acceptCfg.acceptCommand === 'string' && acceptCfg.acceptCommand.trim() ? acceptCfg.acceptCommand.trim() : '/tpaccept').slice(0, 128);
  state.lastAutoAcceptAt = Date.now();
  recordSentMessage(username, cmd);
  try {
    bot.chat(cmd);
    logLine(username, `Otomatik istek kabul edildi: ${cmd}`);
    reportWorkerAutomation(username, 'autoAccept', 'idle', 'İstek kabul edildi.', true);
  } catch (error) {
    send({ type: 'operation-error', username, message: `Otomatik kabul hatası: ${String(error)}` });
  }
}

function stopCommandScheduler(username) {
  const state = pluginStates.get(username);
  if (!state) return;
  if (state.schedulerTimer) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
  }
}

function applyCommandScheduler(username, bot) {
  stopCommandScheduler(username);
  const state = getState(username);
  const cfg = state.plugins?.commandScheduler;
  const tasks = Array.isArray(cfg?.tasks) ? cfg.tasks.filter(t => t && t.enabled && typeof t.command === 'string' && t.command.trim()) : [];
  if (!cfg?.enabled || !tasks.length || bots.get(username) !== bot) {
    reportWorkerAutomation(username, 'commandScheduler', 'idle');
    return;
  }
  const nowInit = Date.now();
  for (const task of tasks) {
    if (!state.schedulerLastRun[task.id]) {
      state.schedulerLastRun[task.id] = nowInit;
    }
  }
  reportWorkerAutomation(username, 'commandScheduler', 'waiting', `${tasks.length} görev zamanlandı.`);
  state.schedulerTimer = setInterval(() => {
    if (bots.get(username) !== bot || !state.plugins?.commandScheduler?.enabled) {
      stopCommandScheduler(username);
      return;
    }
    const now = Date.now();
    const activeTasks = (state.plugins.commandScheduler.tasks || []).filter(t => t && t.enabled && typeof t.command === 'string' && t.command.trim());
    for (const task of activeTasks) {
      const intervalMs = Math.max(5, Number(task.intervalSeconds) || 300) * 1000;
      const last = state.schedulerLastRun[task.id] || 0;
      if (now - last >= intervalMs) {
        state.schedulerLastRun[task.id] = now;
        const cmd = task.command.trim().slice(0, 256);
        recordSentMessage(username, cmd);
        try {
          bot.chat(cmd);
          logLine(username, `Zamanlanmış komut gönderildi: ${cmd}`);
          reportWorkerAutomation(username, 'commandScheduler', 'idle', cmd, true);
        } catch (error) {
          reportWorkerAutomation(username, 'commandScheduler', 'error', String(error));
        }
      }
    }
  }, 1000);
}

function sendLobbyPostCommand(username, bot) {
  const state = getState(username);
  const postCmd = state.plugins?.autoLobby?.postCommand?.trim();
  if (!postCmd || bots.get(username) !== bot) {
    reportWorkerAutomation(username, 'autoLobby', 'idle', 'Tamamlandı.', true);
    return;
  }
  setTimeout(() => {
    if (bots.get(username) !== bot) return;
    try {
      const cmd = postCmd.slice(0, 128);
      recordSentMessage(username, cmd);
      bot.chat(cmd);
      logLine(username, `Otomatik lobi komutu gönderildi: ${cmd}`);
      reportWorkerAutomation(username, 'autoLobby', 'idle', 'Tamamlandı.', true);
    } catch (error) {
      reportWorkerAutomation(username, 'autoLobby', 'error', String(error));
    }
  }, 600);
}

async function handleLobbyWindowOpen(username, bot, win) {
  const state = getState(username);
  if (!state.lobbyPendingWindow || !win || bots.get(username) !== bot) return;
  const cfg = state.plugins?.autoLobby;
  if (!cfg?.enabled) { state.lobbyPendingWindow = false; return; }
  state.lobbyPendingWindow = false;
  let targetSlot = -1;
  if (Number.isInteger(cfg.clickSlot) && cfg.clickSlot >= 0 && cfg.clickSlot < (win.slots?.length || 0)) {
    targetSlot = cfg.clickSlot;
  } else if (cfg.itemKeyword?.trim() && Array.isArray(win.slots)) {
    const kw = cfg.itemKeyword.trim().toLowerCase();
    targetSlot = win.slots.findIndex(item => {
      if (!item) return false;
      const serialized = serialize(item);
      const hay = `${item.name || ''} ${serialized?.displayName || ''} ${serialized?.customName || ''}`.toLowerCase();
      return hay.includes(kw);
    });
  }
  if (targetSlot >= 0) {
    try {
      await bot.clickWindow(targetSlot, 0, 0);
      logLine(username, `Lobi menüsünde slot ${targetSlot} tıklandı.`);
    } catch (error) {
      reportWorkerAutomation(username, 'autoLobby', 'error', String(error));
    }
  } else {
    logLine(username, 'Lobi menüsünde hedef eşya/slot bulunamadı.');
  }
  sendLobbyPostCommand(username, bot);
}

function scheduleAutoLobby(username, bot) {
  const state = getState(username);
  if (state.lobbyTimer) { clearTimeout(state.lobbyTimer); state.lobbyTimer = null; }
  const cfg = state.plugins?.autoLobby;
  if (!cfg?.enabled) {
    reportWorkerAutomation(username, 'autoLobby', 'idle');
    return;
  }
  if (state.lobbyCompleted || bots.get(username) !== bot) return;
  const delaySec = Math.max(1, Number(cfg.delaySeconds) || 4);
  reportWorkerAutomation(username, 'autoLobby', 'waiting', `${delaySec} sn bekleniyor...`);
  state.lobbyTimer = setTimeout(() => {
    state.lobbyTimer = null;
    if (bots.get(username) !== bot || !state.plugins?.autoLobby?.enabled || state.lobbyCompleted) return;
    state.lobbyCompleted = true;
    reportWorkerAutomation(username, 'autoLobby', 'running', 'Lobi yönlendirmesi çalışıyor...');
    const needsWindow = cfg.clickSlot >= 0 || Boolean(cfg.itemKeyword?.trim());
    if (cfg.hotbarSlot > 0) {
      try {
        if (typeof bot.setQuickBarSlot === 'function') bot.setQuickBarSlot(cfg.hotbarSlot - 1);
        state.lobbyPendingWindow = needsWindow;
        if (typeof bot.activateItem === 'function') bot.activateItem();
        if (!needsWindow) {
          sendLobbyPostCommand(username, bot);
        } else {
          setTimeout(() => {
            if (state.lobbyPendingWindow && bots.get(username) === bot) {
              state.lobbyPendingWindow = false;
              sendLobbyPostCommand(username, bot);
            }
          }, 5000);
        }
      } catch (error) {
        state.lobbyPendingWindow = false;
        reportWorkerAutomation(username, 'autoLobby', 'error', String(error));
      }
    } else {
      sendLobbyPostCommand(username, bot);
    }
  }, delaySec * 1000);
}

function loadExternalPlugins(username, bot) {
  const state = getState(username);
  const scripts = Array.isArray(state.plugins?.enabledScripts) ? state.plugins.enabledScripts : [];
  const dir = state.pluginsDir;
  if (!dir || !scripts.length) return;
  const resolvedDir = path.resolve(dir);

  for (const filename of scripts) {
    if (typeof filename !== 'string' || !PLUGIN_NAME_RE.test(filename) || filename.startsWith('.')) continue;
    const target = path.resolve(resolvedDir, filename);
    if (path.dirname(target) !== resolvedDir) continue;
    try {
      const resolvedModule = require.resolve(target);
      delete require.cache[resolvedModule];
      const loaded = require(resolvedModule);
      const entry = typeof loaded === 'function'
        ? loaded
        : typeof loaded?.setup === 'function'
          ? loaded.setup
          : typeof loaded?.default === 'function'
            ? loaded.default
            : null;
      if (!entry) throw new Error('Eklenti bir fonksiyon veya setup(bot, ctx) dışa aktarmalı.');
      const ctx = {
        username,
        log: msg => logLine(username, `[${filename}] ${String(msg)}`),
        registerCleanup: fn => { if (typeof fn === 'function') state.cleanups.push(fn); },
        onParsedChat: fn => { if (typeof fn === 'function') state.parsedChatListeners.push(fn); },
      };
      const maybeCleanup = entry(bot, ctx);
      if (typeof maybeCleanup === 'function') state.cleanups.push(maybeCleanup);
      logLine(username, `Eklenti yüklendi: ${filename}`);
    } catch (error) {
      send({ type: 'operation-error', username, message: `Eklenti hatası (${filename}): ${String(error)}` });
    }
  }
}

function cleanupPlugins(username, bot) {
  const state = pluginStates.get(username);
  if (!state) return;
  stopAfk(username, bot);
  stopCommandScheduler(username);
  state.automation?.stop();
  state.automation = null;
  state.automationStatuses = {};
  state.workerStatuses = {};
  state.schedulerLastRun = {};
  state.lobbyCompleted = false;
  state.lobbyPendingWindow = false;
  state.loginCommandSent = false;
  state.pendingJoinChat = false;
  state.recentSentMessages = [];
  state.recentLines = [];
  state.recentLoginLines = [];
  state.manualControls.clear();
  if (state.joinTimer) { clearTimeout(state.joinTimer); state.joinTimer = null; }
  if (state.lobbyTimer) { clearTimeout(state.lobbyTimer); state.lobbyTimer = null; }
  if (state.moveTimer) { clearInterval(state.moveTimer); state.moveTimer = null; }
  if (state.invTimer) { clearTimeout(state.invTimer); state.invTimer = null; }
  state.parsedChatListeners = [];
  state.recentLines = [];
  state.recentLoginLines = [];
  state.lastAutoLoginAt = 0;
  state.lastAutoAcceptAt = 0;
  state.lastWorldCenter = null;
  state.lastPoseSentAt = 0;
  state.lastWorldSentAt = 0;
  while (state.cleanups.length) {
    const fn = state.cleanups.pop();
    try { fn(); } catch (error) { logLine(username, `Eklenti temizleme hatası: ${String(error)}`); }
  }
}

function broadcastWorkerError(prefix, error) {
  const detail = error?.stack || error?.message || String(error);
  const text = `${prefix}: ${detail}`;
  for (const uname of bots.keys()) {
    logLine(uname, text);
  }
}

process.on('uncaughtException', error => {
  broadcastWorkerError('Worker yakalanmamış hata', error);
});

process.on('unhandledRejection', error => {
  broadcastWorkerError('Worker işlenmemiş promise hatası', error);
});

async function resolveAutoVersion(username, host, port) {
  let timer;
  const response = await Promise.race([
    mc.ping({ host, port }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Ping zaman aşımı (5 sn)')), 5000);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  const proto = response?.version?.protocol;
  const serverName = response?.version?.name || String(proto ?? 'bilinmiyor');
  const candidates = proto != null ? (mcData.postNettyVersionsByProtocolVersion?.pc?.[proto] || []) : [];
  const matched = candidates.find(v => TESTED_VERSION_SET.has(v.minecraftVersion));
  if (matched) return matched.minecraftVersion;
  const fallback = mineflayer.latestSupportedVersion || '1.21.8';
  logLine(username, `Sunucu sürümü ${serverName} desteklenmiyor, ${fallback} ile deneniyor (ViaVersion gerektirir)`);
  return fallback;
}

process.on('message', payload => {
  if (!payload || typeof payload !== 'object') return;
  let { action, bot, username, message, slot, requestId, click, plugins, pluginsDir, pos, name, control, state, yaw, pitch, durationMs, entityId, enabled } = payload;
  try {
  if (action === 'connect') {
    if (!bot || typeof bot.username !== 'string' || !bot.username.trim()) {
      if (username) status(username, 'error', 'Geçersiz bot yapılandırması.');
      return;
    }
    username = bot.username;
    const token = (connectTokens.get(username) || 0) + 1;
    connectTokens.set(username, token);
    if (bots.has(username)) {
      const oldInstance = bots.get(username);
      logLine(username, 'Önceki bot örneği temizlenip yeniden bağlanılıyor.');
      cleanupPlugins(username, oldInstance);
      bots.delete(username);
      try { oldInstance?.quit?.(); } catch { /* ignore */ }
    }
    const pluginState = getState(username);
    pluginState.plugins = plugins || null;
    pluginState.pluginsDir = pluginsDir || '';
    status(username, 'connecting');

    const startBotInstance = (resolvedBot) => {
    try {
      let failure;
      let failureReported = false;
      let loggedIn = false;
      let spawnedOnce = false;
      let pluginsInitialized = false;
      let inventoryBound = false;
      const instance = mineflayer.createBot({ ...resolvedBot, auth: 'offline' });
      bots.set(username, instance);
      const current = () => bots.get(username) === instance;
      const bindInventory = () => {
        if (inventoryBound || !instance.inventory) return;
        inventoryBound = true;
        instance.inventory.on('updateSlot', () => scheduleInventory(username, instance));
        inventory(username, instance);
      };
      const initPluginsOnce = () => {
        if (pluginsInitialized) return;
        pluginsInitialized = true;
        loadExternalPlugins(username, instance);
      };
      const seenResourcePacks = new Set();
      const registerResourcePack = (url, uuid) => {
        if (!current()) return;
        const key = uuid || url;
        if (key && seenResourcePacks.has(key)) return;
        if (key) seenResourcePacks.add(key);
        if (url && typeof url === 'string') {
          send({ type: 'resource-pack', username, url });
          logLine(username, `Resource pack bulundu: ${url}`);
        }
        try {
          if (typeof instance.acceptResourcePack === 'function') {
            instance.acceptResourcePack();
          }
        } catch (error) {
          logLine(username, `Resource pack kabul hatası: ${String(error?.message || error)}`);
        }
      };

      instance.once('login', () => {
        if (!current()) return;
        loggedIn = true;
        status(username, 'connecting', 'Dünya yükleniyor...');
        bindInventory();
        initPluginsOnce();
        if (instance._client) {
          instance._client.on('set_slot', packet => {
            if (!current()) return;
            const st = getState(username);
            if (packet.windowId === -1 || packet.windowId === 255 || packet.slot === -1) {
              if (!packet.item || packet.item.present === false || packet.item.itemId === 0 || packet.item.blockId === -1) {
                clearCursor(instance);
                scheduleInventory(username, instance);
              }
            } else if (
              st.lastClickedSlot === packet.slot &&
              Date.now() - (st.lastClickAt || 0) < 1500 &&
              packet.item &&
              packet.item.present !== false &&
              packet.item.itemId !== 0 &&
              packet.item.blockId !== -1
            ) {
              // Server restored the item back into the clicked slot (cancelled pickup!)
              clearCursor(instance);
              scheduleInventory(username, instance);
            }
          });
          instance._client.on('window_items', packet => {
            if (!current()) return;
            if (packet.carriedItem === undefined || !packet.carriedItem || packet.carriedItem.present === false || packet.carriedItem.itemId === 0 || packet.carriedItem.blockId === -1) {
              clearCursor(instance);
            }
            scheduleInventory(username, instance, 20);
          });
        }
      });
      instance.on('forcedMove', () => {
        if (!current()) return;
        sendPose(username, instance);
      });
      instance.on('spawn', () => {
        if (!current()) return;
        clearCursor(instance);
        if (!spawnedOnce) {
          spawnedOnce = true;
          status(username, 'connected');
          triggerJoinChat(username, instance);
        } else {
          logLine(username, 'Yeniden doğuldu / boyut değişti.');
        }
        bindInventory();
        applyAntiAfk(username, instance);
        applyCommandScheduler(username, instance);
        if (!pluginState.automation) {
          pluginState.automation = createAutomation(instance, {
            current,
            isManual: () => pluginState.manualControls.size > 0 || Boolean(pluginState.moveTimer),
            report: automation => {
              if (current()) {
                pluginState.automationStatuses = automation || {};
                sendCombinedAutomation(username);
              }
            },
            onPanicDisconnect: (reason, disableReconnect) => {
              logLine(username, `Acil panik çıkışı: ${reason}`);
              if (disableReconnect) send({ type: 'panic-disconnect', username, reason });
              cleanupPlugins(username, instance);
              bots.delete(username);
              try { instance.quit(); } catch {}
              status(username, 'disconnected', reason);
            },
            enqueue: fn => {
              const operation = (queues.get(username) || Promise.resolve()).catch(() => {}).then(fn);
              queues.set(username, operation);
              operation.finally(() => { if (queues.get(username) === operation) queues.delete(username); }).catch(() => {});
              return operation;
            },
          });
        }
        pluginState.automation.update(pluginState.plugins);
        initPluginsOnce();
        if (!pluginState.lobbyCompleted && !pluginState.lobbyTimer) {
          scheduleAutoLobby(username, instance);
        }
        sendPose(username, instance);
        sendWorld(username, instance);
      });
      instance.on('move', () => {
        if (!current() || !instance.entity?.position) return;
        const st = getState(username);
        const now = Date.now();
        if (now - st.lastPoseSentAt >= 150) {
          st.lastPoseSentAt = now;
          sendPose(username, instance);
        }
        const cx = Math.floor(instance.entity.position.x);
        const cy = Math.floor(instance.entity.position.y);
        const cz = Math.floor(instance.entity.position.z);
        const centerChanged = !st.lastWorldCenter ||
          st.lastWorldCenter.x !== cx ||
          st.lastWorldCenter.y !== cy ||
          st.lastWorldCenter.z !== cz;
        if (centerChanged && now - st.lastWorldSentAt >= 500) {
          st.lastWorldSentAt = now;
          st.lastWorldCenter = { x: cx, y: cy, z: cz };
          sendWorld(username, instance);
        }
      });
      instance.on('health', () => {
        if (!current()) return;
        sendPose(username, instance);
      });
      instance.on('windowOpen', win => {
        if (!current()) return;
        clearCursor(instance);
        inventory(username, instance);
        void handleLobbyWindowOpen(username, instance, win);
      });
      instance.on('windowClose', () => {
        if (!current()) return;
        clearCursor(instance);
        inventory(username, instance);
      });
      instance.on('title', text => {
        if (!current()) return;
        const cleanTitle = stripPua(formatReason(text));
        if (cleanTitle) handleAutoLogin(username, instance, cleanTitle, 'title');
      });
      instance.on('message', (jsonMsg, position) => {
        if (!current()) return;
        const rawText = String(typeof jsonMsg?.toString === 'function' ? jsonMsg.toString() : jsonMsg || '').slice(0, 2000);
        const msg = stripPua(rawText);
        if (position === 'game_info') {
          if (msg) {
            send({ type: 'actionbar', username, text: msg });
            handleAutoLogin(username, instance, msg, 'actionbar');
          }
          return;
        }
        const motd = typeof jsonMsg?.toMotd === 'function' ? String(jsonMsg.toMotd()).slice(0, 4000) : '';
        const segments = motd ? parseMotdSegments(motd) : undefined;
        if (segments?.length && /^\s+$/.test(segments[0].text)) segments.shift();
        send({ type: 'chat', username, text: msg, ...(segments?.length ? { segments } : {}) });
        const parsed = tryParseChat(username, msg);
        if (parsed) {
          const st = getState(username);
          for (const listener of st.parsedChatListeners) {
            try { listener(parsed); } catch (error) { logLine(username, `Eklenti parsedChat hatası: ${String(error)}`); }
          }
          instance.emit('mynbot:chat', parsed);
        }
        handleAutoLogin(username, instance, msg, 'chat');
        handleAutoAccept(username, instance, msg, parsed);
        handleAutoChat(username, instance, msg, parsed);
      });
      instance.on('resourcePack', (arg1, arg2, arg3) => {
        if (!current()) return;
        const args = [arg1, arg2, arg3].filter(v => v != null);
        const url = args.find(v => typeof v === 'string' && /^https?:\/\//i.test(v));
        const uuid = args.map(v => String(v)).find(s => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s));
        registerResourcePack(url, uuid);
      });
      instance.on('heldItemChanged', () => inventory(username, instance));
      instance.on('error', error => {
        if (!current()) return;
        const msg = error?.message || String(error);
        logLine(username, `Protokol/bağlantı hatası: ${msg}`);
        if (!loggedIn) {
          failure = msg;
          failureReported = true;
          status(username, 'error', failure);
        } else {
          send({ type: 'operation-error', username, message: msg });
        }
      });
      instance.on('kicked', reason => {
        if (!current()) return;
        failure = `Sunucudan atıldı: ${formatReason(reason)}`;
        logLine(username, failure);
      });
      instance.once('end', reason => {
        if (!current()) return;
        seenResourcePacks.clear();
        cleanupPlugins(username, instance);
        bots.delete(username);
        if (!failureReported) status(username, failure ? 'error' : 'disconnected', failure || (reason ? formatReason(reason) : undefined));
      });
    } catch (error) {
      cleanupPlugins(username, null);
      bots.delete(username);
      status(username, 'error', String(error));
    }
    }; // end startBotInstance

    const explicitVersion = typeof bot.version === 'string' && bot.version.trim() ? bot.version.trim() : '';
    if (explicitVersion) {
      startBotInstance({ ...bot, version: explicitVersion });
    } else {
      resolveAutoVersion(username, bot.host, bot.port).then(resolvedVersion => {
        if (connectTokens.get(username) !== token) return;
        startBotInstance({ ...bot, version: resolvedVersion });
      }).catch(error => {
        if (connectTokens.get(username) !== token) return;
        cleanupPlugins(username, null);
        bots.delete(username);
        status(username, 'error', `Sunucuya erişilemedi: ${error?.message || String(error)}`);
      });
    }
  } else if (action === 'disconnect') {
    connectTokens.set(username, (connectTokens.get(username) || 0) + 1);
    const instance = bots.get(username);
    cleanupPlugins(username, instance);
    if (instance) { bots.delete(username); instance.quit(); }
    status(username, 'disconnected');
  } else if (action === 'update-plugins') {
    const state = getState(username);
    state.plugins = plugins || null;
    if (pluginsDir) state.pluginsDir = pluginsDir;
    const instance = bots.get(username);
    if (instance) {
      applyAntiAfk(username, instance);
      applyCommandScheduler(username, instance);
      if (!state.plugins?.autoAccept?.enabled) reportWorkerAutomation(username, 'autoAccept', 'idle');
      if (!state.plugins?.autoLobby?.enabled) {
        if (state.lobbyTimer) { clearTimeout(state.lobbyTimer); state.lobbyTimer = null; }
        state.lobbyPendingWindow = false;
        reportWorkerAutomation(username, 'autoLobby', 'idle');
      }
      state.automation?.update(state.plugins);
    }
  } else if (action === 'inventory-click') {
    const instance = bots.get(username);
    getState(username).automation?.manual();
    const previous = queues.get(username) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      if (!instance || bots.get(username) !== instance || !instance.inventory) throw new Error('Bot bağlı değil.');
      const activeWin = instance.currentWindow || instance.inventory;
      const { slot: targetSlot, button, mode } = click || {};
      const validSlot = targetSlot === -999 ? mode === 0 : (targetSlot >= 0 && targetSlot < activeWin.slots.length);
      if (!Number.isInteger(targetSlot) || !Number.isInteger(button) || !Number.isInteger(mode) || ![0, 1, 4].includes(mode) || ![0, 1].includes(button) || !validSlot) {
        throw new Error('Geçersiz envanter işlemi.');
      }
      const st = getState(username);
      st.lastClickedSlot = targetSlot;
      st.lastClickAt = Date.now();
      let timeoutId;
      let timedOut = false;
      try {
        const clickPromise = Promise.resolve(instance.clickWindow(targetSlot, button, mode));
        clickPromise.catch(() => {});
        const timeoutPromise = new Promise(resolve => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            resolve();
          }, 900);
        });
        await Promise.race([clickPromise, timeoutPromise]);
        if (timedOut) {
          clearCursor(instance);
        }
      } catch (clickErr) {
        // Server menu clicks might cancel or close window; swallow error gracefully
        clearCursor(instance);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (targetSlot === -999) {
        clearCursor(instance);
      }
      inventory(username, instance);
    });
    queues.set(username, operation);
    operation.then(() => send({ type: 'result', requestId }), error => send({ type: 'result', requestId, message: String(error?.message || error) })).finally(() => { if (queues.get(username) === operation) queues.delete(username); });
  } else if (action === 'open-block') {
    const instance = bots.get(username);
    getState(username).automation?.manual();
    const previous = queues.get(username) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      if (!instance || bots.get(username) !== instance || !instance.entity?.position) throw new Error('Bot bağlı değil.');
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
        throw new Error('Geçersiz blok konumu.');
      }
      const targetPos = new Vec3(pos.x, pos.y, pos.z);
      const block = typeof instance.blockAt === 'function' ? instance.blockAt(targetPos) : null;
      if (!block || block.name === 'air') throw new Error('Blok bulunamadı.');
      const center = new Vec3(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
      const distance = instance.entity.position.distanceTo(center);
      if (distance > 5.5) throw new Error('Blok çok uzakta (en fazla 5.5 blok).');
      if (typeof instance.lookAt === 'function') {
        try { await instance.lookAt(center, false); } catch { /* ignore */ }
      }
      if (typeof instance.openBlock === 'function') {
        try {
          const openPromise = instance.openBlock(block);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
          await Promise.race([openPromise, timeoutPromise]);
        } catch (err) {
          if (err && err.message === 'timeout' && typeof instance.activateBlock === 'function') {
            await instance.activateBlock(block);
          } else if (typeof instance.activateBlock === 'function') {
            await instance.activateBlock(block);
          } else {
            throw err;
          }
        }
      } else if (typeof instance.activateBlock === 'function') {
        await instance.activateBlock(block);
      }
      inventory(username, instance);
    });
    queues.set(username, operation);
    operation.then(
      () => {
        if (requestId != null) send({ type: 'result', requestId });
      },
      error => {
        if (requestId != null) send({ type: 'result', requestId, message: String(error?.message || error) });
        else send({ type: 'operation-error', username, message: String(error?.message || error) });
      }
    ).finally(() => {
      if (queues.get(username) === operation) queues.delete(username);
    });
  } else if (action === 'close-container') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      clearCursor(instance);
      if (instance.currentWindow) {
        if (typeof instance.closeWindow === 'function') {
          instance.closeWindow(instance.currentWindow);
        } else {
          instance.currentWindow = null;
        }
      }
      clearCursor(instance);
      inventory(username, instance);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'rename-anvil') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      if (instance.currentWindow && instance._client) {
        const cleanName = String(name || '').slice(0, 50);
        try {
          instance._client.write('name_item', { name: cleanName });
        } catch { /* ignore */ }
        try {
          instance._client.write('rename_item', { itemName: cleanName });
        } catch { /* ignore */ }
        try {
          if (typeof instance.supportFeature === 'function' && instance.supportFeature('useMCItemName') && typeof instance._client.writeChannel === 'function') {
            instance._client.writeChannel('MC|ItemName', cleanName);
          }
        } catch { /* ignore */ }
      }
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'set-control') {
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      const manualControls = getState(username).manualControls;
      if (state) manualControls.add(control); else manualControls.delete(control);
      getState(username).automation?.manual();
      const validControls = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
      if (!validControls.includes(control)) throw new Error('Geçersiz kontrol adı.');
      if (typeof instance.setControlState === 'function') {
        instance.setControlState(control, Boolean(state));
      }
      sendPose(username, instance);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'look') {
    const instance = bots.get(username);
    getState(username).automation?.manual();
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      if (typeof instance.look === 'function') {
        void instance.look(Number(yaw), Number(pitch), false);
      }
      sendPose(username, instance);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'use-item') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      if (typeof instance.activateItem === 'function') {
        instance.activateItem();
      }
      setTimeout(() => {
        inventory(username, instance);
      }, 150);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'scan-world') {
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      sendPose(username, instance);
      sendWorld(username, instance);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'step-control') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    try {
      if (!instance || !instance.entity) throw new Error('Bot bağlı değil.');
      if (!isChunkLoadedAt(instance, instance.entity.position)) throw new Error('Dünya henüz yüklenmedi.');
      const manualControls = getState(username).manualControls;
      if (state) manualControls.add(control); else manualControls.delete(control);
      getState(username).automation?.manual();
      const validControls = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
      if (!validControls.includes(control)) throw new Error('Geçersiz kontrol adı.');
      const dur = Math.max(50, Math.min(1500, Number(durationMs) || 260));
      instance.setControlState(control, true);

      if (control === 'forward' && typeof instance.blockAt === 'function') {
        const yaw = instance.entity.yaw;
        const forwardX = Math.round(-Math.sin(yaw));
        const forwardZ = Math.round(-Math.cos(yaw));
        const feetPos = instance.entity.position.floored ? instance.entity.position.floored() : new Vec3(Math.floor(instance.entity.position.x), Math.floor(instance.entity.position.y), Math.floor(instance.entity.position.z));
        const blockInFrontFeet = instance.blockAt(feetPos.offset(forwardX, 0, forwardZ));
        const blockInFrontHead = instance.blockAt(feetPos.offset(forwardX, 1, forwardZ));
        const blockAboveHead = instance.blockAt(feetPos.offset(0, 2, 0));
        const isObstacle = blockInFrontFeet && blockInFrontFeet.boundingBox === 'block';
        const canJump = (!blockInFrontHead || blockInFrontHead.boundingBox !== 'block') && (!blockAboveHead || blockAboveHead.boundingBox !== 'block');
        if (isObstacle && canJump) {
          instance.setControlState('jump', true);
        }
      }

      setTimeout(() => {
        if (bots.get(username) === instance) {
          try {
            instance.setControlState(control, false);
            if (control === 'forward') instance.setControlState('jump', false);
          } catch {}
          sendPose(username, instance);
          sendWorld(username, instance);
        }
      }, dur);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'move-to') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    try {
      if (!instance || !instance.entity || !instance.entity.position) throw new Error('Bot bağlı değil.');
      if (!isChunkLoadedAt(instance, instance.entity.position)) throw new Error('Dünya henüz yüklenmedi.');
      const st = getState(username);
      if (st.moveTimer) {
        clearInterval(st.moveTimer);
        st.moveTimer = null;
      }

      const tx = Number(pos?.x) + 0.5;
      const tz = Number(pos?.z) + 0.5;
      let steps = 0;
      const maxSteps = 35;

      const stopMove = () => {
        if (st.moveTimer) {
          clearInterval(st.moveTimer);
          st.moveTimer = null;
        }
        if (bots.get(username) === instance) {
          try {
            instance.setControlState('forward', false);
            instance.setControlState('jump', false);
          } catch {}
          sendPose(username, instance);
          sendWorld(username, instance);
        }
      };

      st.moveTimer = setInterval(() => {
        steps++;
        if (!instance.entity || bots.get(username) !== instance || steps > maxSteps) {
          stopMove();
          return;
        }
        const bx = instance.entity.position.x;
        const bz = instance.entity.position.z;
        const dist = Math.hypot(tx - bx, tz - bz);
        if (dist < 0.65) {
          stopMove();
          return;
        }
        const dx = tx - bx;
        const dz = tz - bz;
        const targetYaw = Math.atan2(-dx, -dz);
        if (typeof instance.look === 'function') {
          void instance.look(targetYaw, 0, true);
        }
        instance.setControlState('forward', true);

        if (typeof instance.blockAt === 'function') {
          const fX = Math.round(-Math.sin(targetYaw));
          const fZ = Math.round(-Math.cos(targetYaw));
          const feetPos = instance.entity.position.floored ? instance.entity.position.floored() : new Vec3(Math.floor(bx), Math.floor(instance.entity.position.y), Math.floor(bz));
          const frontFeet = instance.blockAt(feetPos.offset(fX, 0, fZ));
          if (frontFeet && frontFeet.boundingBox === 'block') {
            instance.setControlState('jump', true);
          } else {
            instance.setControlState('jump', false);
          }
        }
      }, 100);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'interact-entity') {
    getState(username).automation?.manual();
    const instance = bots.get(username);
    (async () => {
      try {
        if (!instance || !instance.entity) throw new Error('Bot bağlı değil.');
        const entity = instance.entities ? instance.entities[entityId] : null;
        if (entity && entity.position) {
          if (typeof instance.lookAt === 'function') {
            const eyeY = entity.height ? entity.height * 0.8 : 1.2;
            try { await instance.lookAt(entity.position.offset(0, eyeY, 0), true); } catch {}
          }
          try {
            if (typeof instance.useOn === 'function') {
              instance.useOn(entity);
            } else if (typeof instance.activateEntity === 'function') {
              instance.activateEntity(entity);
            }
          } catch {
            if (typeof instance.activateEntity === 'function') {
              try { instance.activateEntity(entity); } catch {}
            }
          }
          setTimeout(() => {
            inventory(username, instance);
          }, 200);
        }
      } catch (error) {
        send({ type: 'operation-error', username, message: String(error?.message || error) });
      }
    })();
  } else if (action === 'set-physics') {
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      instance.physicsEnabled = enabled !== false;
      sendPose(username, instance);
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  } else if (action === 'chat' || action === 'slot') {
    const instance = bots.get(username);
    try {
      if (!instance) throw new Error('Bot bağlı değil.');
      if (action === 'chat') instance.chat(message);
      else { getState(username).automation?.manual(); instance.setQuickBarSlot(slot); inventory(username, instance); }
    } catch (error) {
      send({ type: 'operation-error', username, message: String(error?.message || error) });
    }
  }
  } catch (error) {
    const target = username || bot?.username;
    if (target) {
      logLine(target, `Worker mesaj işleme hatası (${action || '?'}): ${String(error?.message || error)}`);
    }
  }
});

process.on('disconnect', () => {
  for (const [username, bot] of bots.entries()) {
    cleanupPlugins(username, bot);
    bot.quit();
  }
  process.exit(0);
});

if (require.main !== module) {
  module.exports = { handleAutoLogin, handleAutoChat, handleAutoAccept, applyCommandScheduler, stopCommandScheduler, scheduleAutoLobby, getState, cleanupPlugins, pluginStates, bots };
}
