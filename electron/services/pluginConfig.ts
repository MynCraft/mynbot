import { defaultPluginSettings, type AutoChatRule, type BotPluginSettings, type ChatPatternRule, type LoginPatternRule, type ScheduledCommandTask } from '../../src/types/bot';

const PLUGIN_NAME_RE = /^[a-zA-Z0-9._-]+\.(cjs|js)$/;

export function isValidPluginFilename(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 100 && PLUGIN_NAME_RE.test(name) && !name.startsWith('.');
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeStringList(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, maxLen);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeScheduledTask(raw: unknown, index: number): ScheduledCommandTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : `task-${index + 1}`;
  const command = typeof r.command === 'string' ? r.command.slice(0, 256) : '';
  const intervalSeconds = clampInt(r.intervalSeconds, 300, 5, 86400);
  const enabled = r.enabled === undefined ? true : Boolean(r.enabled);
  return { id, command, intervalSeconds, enabled };
}

function sanitizeRule(raw: unknown, index: number): AutoChatRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const trigger = typeof record.trigger === 'string' ? record.trigger.slice(0, 128) : '';
  const response = typeof record.response === 'string' ? record.response.slice(0, 256) : '';
  const id = typeof record.id === 'string' && record.id.trim() ? record.id.slice(0, 64) : `rule-${index + 1}`;
  const scope = record.scope === 'chat' || record.scope === 'pm' ? record.scope : 'all';
  return { id, trigger, response, scope };
}

function sanitizeChatPattern(raw: unknown, index: number): ChatPatternRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === 'pm' ? 'pm' : 'chat';
  const regexLinesRaw = Array.isArray(r.regexLines) ? r.regexLines.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 600).slice(0, 8) : [];
  if (!regexLinesRaw.length) return null;
  for (const pattern of regexLinesRaw) {
    try { new RegExp(pattern, 'i'); } catch { return null; }
  }
  const lineCount = regexLinesRaw.length;
  const senderLineIndex = typeof r.senderLineIndex === 'number' && Number.isInteger(r.senderLineIndex) && r.senderLineIndex >= -1 && r.senderLineIndex < lineCount ? r.senderLineIndex : -1;
  const messageLineIndex = typeof r.messageLineIndex === 'number' && Number.isInteger(r.messageLineIndex) && r.messageLineIndex >= 0 && r.messageLineIndex < lineCount ? r.messageLineIndex : lineCount - 1;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.slice(0, 64) : `pattern-${index + 1}`;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 64) : (type === 'pm' ? 'Özel Mesaj' : 'Genel Sohbet');
  const sampleLines = Array.isArray(r.sampleLines) ? r.sampleLines.filter((x): x is string => typeof x === 'string').slice(0, 8).map(s => s.slice(0, 300)) : undefined;
  return { id, name, type, lineCount, regexLines: regexLinesRaw, senderLineIndex, messageLineIndex, ...(sampleLines?.length ? { sampleLines } : {}) };
}

function sanitizeLoginPattern(raw: unknown, index: number): LoginPatternRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const action = r.action === 'register' ? 'register' : 'login';
  const regexLinesRaw = Array.isArray(r.regexLines)
    ? r.regexLines.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 600).slice(0, 8)
    : [];
  if (!regexLinesRaw.length) return null;
  for (const pattern of regexLinesRaw) {
    try { new RegExp(pattern, 'i'); } catch { return null; }
  }
  const lineCount = regexLinesRaw.length;
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : `login-pattern-${index + 1}`;
  const name = typeof r.name === 'string' && r.name.trim()
    ? r.name.trim().slice(0, 64)
    : (action === 'register' ? 'Kayıt Mesajı' : 'Giriş Mesajı');
  const triggerText = typeof r.triggerText === 'string' && r.triggerText.trim()
    ? r.triggerText.trim().slice(0, 128)
    : undefined;
  const sampleLines = Array.isArray(r.sampleLines)
    ? r.sampleLines.filter((x): x is string => typeof x === 'string').slice(0, 8).map(s => s.slice(0, 300))
    : undefined;
  return {
    id,
    name,
    action,
    lineCount,
    regexLines: regexLinesRaw,
    ...(triggerText ? { triggerText } : {}),
    ...(sampleLines?.length ? { sampleLines } : {}),
  };
}

export function validatePluginSettings(raw: unknown): BotPluginSettings {
  const defaults = defaultPluginSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const input = raw as Record<string, unknown>;

  const ar = (input.autoReconnect && typeof input.autoReconnect === 'object' ? input.autoReconnect : {}) as Record<string, unknown>;
  const afk = (input.antiAfk && typeof input.antiAfk === 'object' ? input.antiAfk : {}) as Record<string, unknown>;
  const chat = (input.autoChat && typeof input.autoChat === 'object' ? input.autoChat : {}) as Record<string, unknown>;
  const login = (input.autoLogin && typeof input.autoLogin === 'object' ? input.autoLogin : {}) as Record<string, unknown>;

  const eat = (input.autoEat && typeof input.autoEat === 'object' ? input.autoEat : {}) as Record<string, unknown>;
  const armor = (input.autoArmor && typeof input.autoArmor === 'object' ? input.autoArmor : {}) as Record<string, unknown>;
  const fishing = (input.autoFishing && typeof input.autoFishing === 'object' ? input.autoFishing : {}) as Record<string, unknown>;
  const totem = (input.autoTotem && typeof input.autoTotem === 'object' ? input.autoTotem : {}) as Record<string, unknown>;
  const panic = (input.autoPanic && typeof input.autoPanic === 'object' ? input.autoPanic : {}) as Record<string, unknown>;
  const defend = (input.autoDefend && typeof input.autoDefend === 'object' ? input.autoDefend : {}) as Record<string, unknown>;
  const lobby = (input.autoLobby && typeof input.autoLobby === 'object' ? input.autoLobby : {}) as Record<string, unknown>;
  const accept = (input.autoAccept && typeof input.autoAccept === 'object' ? input.autoAccept : {}) as Record<string, unknown>;
  const scheduler = (input.commandScheduler && typeof input.commandScheduler === 'object' ? input.commandScheduler : {}) as Record<string, unknown>;
  const chestDump = (input.autoChestDump && typeof input.autoChestDump === 'object' ? input.autoChestDump : {}) as Record<string, unknown>;

  const rulesRaw = Array.isArray(chat.rules) ? chat.rules.slice(0, 30) : [];
  const rules = rulesRaw.map(sanitizeRule).filter((item): item is AutoChatRule => item !== null);
  const patternsRaw = Array.isArray(input.chatPatterns) ? input.chatPatterns.slice(0, 20) : [];
  const chatPatterns = patternsRaw.map(sanitizeChatPattern).filter((item): item is ChatPatternRule => item !== null);
  const loginPatternsRaw = Array.isArray(login.patterns) ? login.patterns.slice(0, 20) : [];
  const loginPatterns = loginPatternsRaw.map(sanitizeLoginPattern).filter((item): item is LoginPatternRule => item !== null);
  const scheduledTasksRaw = Array.isArray(scheduler.tasks) ? scheduler.tasks.slice(0, 20) : [];
  const scheduledTasks = scheduledTasksRaw.map(sanitizeScheduledTask).filter((item): item is ScheduledCommandTask => item !== null);
  const scriptsRaw = Array.isArray(input.enabledScripts) ? input.enabledScripts : [];
  const enabledScripts = [...new Set(scriptsRaw.filter(isValidPluginFilename))];
  const moduleIcons: Record<string, string> = {};
  if (input.moduleIcons && typeof input.moduleIcons === 'object' && !Array.isArray(input.moduleIcons)) {
    for (const [k, v] of Object.entries(input.moduleIcons as Record<string, unknown>).slice(0, 64)) {
      if (typeof k !== 'string' || !k || k.length > 100 || typeof v !== 'string') continue;
      const val = v.trim();
      if (!val) continue;
      if (val.startsWith('item:') || val.startsWith('https://') || val.startsWith('data:image/')) {
        if (val.length <= 200_000) moduleIcons[k] = val;
      } else if (val.length <= 80 && (val.startsWith('icon:') ? /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(val.slice(5)) : val.length <= 16)) {
        moduleIcons[k] = val;
      }
    }
  }

  return {
    autoEat: { enabled: Boolean(eat.enabled), hungerThreshold: clampInt(eat.hungerThreshold, 16, 1, 19), healthThreshold: clampInt(eat.healthThreshold, 10, 1, 20), selection: eat.selection === 'food' ? 'food' : 'saturation', allowGoldenApples: Boolean(eat.allowGoldenApples), restoreHeldItem: eat.restoreHeldItem === undefined ? true : Boolean(eat.restoreHeldItem) },
    autoArmor: { enabled: Boolean(armor.enabled), intervalSeconds: clampInt(armor.intervalSeconds, 10, 2, 120) },
    autoFishing: { enabled: Boolean(fishing.enabled), recastDelaySeconds: clampInt(fishing.recastDelaySeconds, 2, 1, 30), timeoutSeconds: clampInt(fishing.timeoutSeconds, 60, 10, 180) },
    autoTotem: {
      enabled: Boolean(totem.enabled),
      priorityItem: totem.priorityItem === 'shield' ? 'shield' : 'totem',
      healthThreshold: clampInt(totem.healthThreshold, defaults.autoTotem.healthThreshold, 1, 20),
      intervalSeconds: clampInt(totem.intervalSeconds, defaults.autoTotem.intervalSeconds, 1, 30),
    },
    autoPanic: {
      enabled: Boolean(panic.enabled),
      healthThreshold: clampInt(panic.healthThreshold, defaults.autoPanic.healthThreshold, 1, 19),
      disconnectOnPlayer: Boolean(panic.disconnectOnPlayer),
      playerRadius: clampInt(panic.playerRadius, defaults.autoPanic.playerRadius, 3, 32),
      whitelist: sanitizeStringList(panic.whitelist, 30, 32),
      action: panic.action === 'command' ? 'command' : 'disconnect',
      panicCommand: typeof panic.panicCommand === 'string' && panic.panicCommand.trim() ? panic.panicCommand.trim().slice(0, 128) : defaults.autoPanic.panicCommand,
      disableReconnect: panic.disableReconnect === undefined ? defaults.autoPanic.disableReconnect : Boolean(panic.disableReconnect),
    },
    autoDefend: {
      enabled: Boolean(defend.enabled),
      radius: clampInt(defend.radius, defaults.autoDefend.radius, 2, 6),
      attackIntervalMs: clampInt(defend.attackIntervalMs, defaults.autoDefend.attackIntervalMs, 300, 2000),
      autoEquipWeapon: defend.autoEquipWeapon === undefined ? defaults.autoDefend.autoEquipWeapon : Boolean(defend.autoEquipWeapon),
      attackCreepers: Boolean(defend.attackCreepers),
      restoreHeldItem: defend.restoreHeldItem === undefined ? defaults.autoDefend.restoreHeldItem : Boolean(defend.restoreHeldItem),
    },
    autoLobby: {
      enabled: Boolean(lobby.enabled),
      delaySeconds: clampInt(lobby.delaySeconds, defaults.autoLobby.delaySeconds, 1, 30),
      hotbarSlot: clampInt(lobby.hotbarSlot, defaults.autoLobby.hotbarSlot, 0, 9),
      clickSlot: clampInt(lobby.clickSlot, defaults.autoLobby.clickSlot, -1, 53),
      itemKeyword: typeof lobby.itemKeyword === 'string' ? lobby.itemKeyword.trim().slice(0, 64) : '',
      postCommand: typeof lobby.postCommand === 'string' ? lobby.postCommand.trim().slice(0, 128) : '',
    },
    autoAccept: {
      enabled: Boolean(accept.enabled),
      onlyWhitelist: accept.onlyWhitelist === undefined ? defaults.autoAccept.onlyWhitelist : Boolean(accept.onlyWhitelist),
      whitelist: sanitizeStringList(accept.whitelist, 30, 32),
      triggers: Array.isArray(accept.triggers) ? sanitizeStringList(accept.triggers, 20, 64) : [...defaults.autoAccept.triggers],
      acceptCommand: typeof accept.acceptCommand === 'string' && accept.acceptCommand.trim() ? accept.acceptCommand.trim().slice(0, 128) : defaults.autoAccept.acceptCommand,
      cooldownSeconds: clampInt(accept.cooldownSeconds, defaults.autoAccept.cooldownSeconds, 1, 60),
    },
    commandScheduler: {
      enabled: Boolean(scheduler.enabled),
      tasks: scheduledTasks,
    },
    autoChestDump: {
      enabled: Boolean(chestDump.enabled),
      freeSlotsThreshold: clampInt(chestDump.freeSlotsThreshold, defaults.autoChestDump.freeSlotsThreshold, 1, 18),
      searchRadius: clampInt(chestDump.searchRadius, defaults.autoChestDump.searchRadius, 2, 5),
      intervalSeconds: clampInt(chestDump.intervalSeconds, defaults.autoChestDump.intervalSeconds, 5, 120),
      keepFoods: chestDump.keepFoods === undefined ? defaults.autoChestDump.keepFoods : Boolean(chestDump.keepFoods),
      keepToolsAndArmor: chestDump.keepToolsAndArmor === undefined ? defaults.autoChestDump.keepToolsAndArmor : Boolean(chestDump.keepToolsAndArmor),
      keepKeywords: sanitizeStringList(chestDump.keepKeywords, 20, 64),
    },
    autoReconnect: {
      enabled: Boolean(ar.enabled),
      delaySeconds: clampInt(ar.delaySeconds, defaults.autoReconnect.delaySeconds, 2, 120),
      maxAttempts: clampInt(ar.maxAttempts, defaults.autoReconnect.maxAttempts, 0, 50),
    },
    antiAfk: {
      enabled: Boolean(afk.enabled),
      intervalSeconds: clampInt(afk.intervalSeconds, defaults.antiAfk.intervalSeconds, 5, 300),
      jump: afk.jump === undefined ? defaults.antiAfk.jump : Boolean(afk.jump),
      rotate: afk.rotate === undefined ? defaults.antiAfk.rotate : Boolean(afk.rotate),
    },
    autoChat: {
      enabled: Boolean(chat.enabled),
      joinMessage: typeof chat.joinMessage === 'string' ? chat.joinMessage.slice(0, 256) : '',
      cooldownSeconds: clampInt(chat.cooldownSeconds, defaults.autoChat.cooldownSeconds, 1, 60),
      rules,
    },
    autoLogin: {
      enabled: Boolean(login.enabled),
      password: typeof login.password === 'string' ? login.password.slice(0, 128) : '',
      loginCommand: typeof login.loginCommand === 'string' && login.loginCommand.trim() ? login.loginCommand.slice(0, 256) : defaults.autoLogin.loginCommand,
      registerCommand: typeof login.registerCommand === 'string' && login.registerCommand.trim() ? login.registerCommand.slice(0, 256) : defaults.autoLogin.registerCommand,
      cooldownSeconds: clampInt(login.cooldownSeconds, defaults.autoLogin.cooldownSeconds, 1, 60),
      listenTitleActionbar: login.listenTitleActionbar === undefined ? defaults.autoLogin.listenTitleActionbar : Boolean(login.listenTitleActionbar),
      patterns: loginPatterns,
    },
    chatPatterns,
    enabledScripts,
    moduleIcons,
  };
}
