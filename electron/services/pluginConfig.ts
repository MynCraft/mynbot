import { defaultPluginSettings, type AutoChatRule, type BotPluginSettings, type ChatPatternRule } from '../../src/types/bot';

const PLUGIN_NAME_RE = /^[a-zA-Z0-9._-]+\.(cjs|js)$/;

export function isValidPluginFilename(name: unknown): name is string {
  return typeof name === 'string' && name.length <= 100 && PLUGIN_NAME_RE.test(name) && !name.startsWith('.');
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
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

export function validatePluginSettings(raw: unknown): BotPluginSettings {
  const defaults = defaultPluginSettings();
  if (!raw || typeof raw !== 'object') return defaults;
  const input = raw as Record<string, unknown>;

  const ar = (input.autoReconnect && typeof input.autoReconnect === 'object' ? input.autoReconnect : {}) as Record<string, unknown>;
  const afk = (input.antiAfk && typeof input.antiAfk === 'object' ? input.antiAfk : {}) as Record<string, unknown>;
  const chat = (input.autoChat && typeof input.autoChat === 'object' ? input.autoChat : {}) as Record<string, unknown>;

  const eat = (input.autoEat && typeof input.autoEat === 'object' ? input.autoEat : {}) as Record<string, unknown>;
  const armor = (input.autoArmor && typeof input.autoArmor === 'object' ? input.autoArmor : {}) as Record<string, unknown>;
  const fishing = (input.autoFishing && typeof input.autoFishing === 'object' ? input.autoFishing : {}) as Record<string, unknown>;

  const rulesRaw = Array.isArray(chat.rules) ? chat.rules.slice(0, 30) : [];
  const rules = rulesRaw.map(sanitizeRule).filter((item): item is AutoChatRule => item !== null);
  const patternsRaw = Array.isArray(input.chatPatterns) ? input.chatPatterns.slice(0, 20) : [];
  const chatPatterns = patternsRaw.map(sanitizeChatPattern).filter((item): item is ChatPatternRule => item !== null);
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
    chatPatterns,
    enabledScripts,
    moduleIcons,
  };
}
