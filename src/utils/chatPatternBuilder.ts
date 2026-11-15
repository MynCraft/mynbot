import type { ChatPatternRule, ChatPatternType } from '../types/bot';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeFixed(value: string): string {
  return escapeRegex(value).replace(/(\\\s|\s)+/g, '\\s+');
}

function buildSenderPrefix(prefix: string): string {
  if (!prefix) return '';
  // Preserve fixed label before rank tags (e.g. "Gonderen: [VIP] ") while keeping rank tags flexible
  const firstBracket = prefix.indexOf('[');
  if (firstBracket > 0) {
    const label = prefix.slice(0, firstBracket);
    return `${escapeFixed(label)}.*?`;
  }
  if (firstBracket === 0) {
    return '(?:\\[[^\\]]+\\]\\s*)*';
  }
  return escapeFixed(prefix);
}

function buildDecorativeLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '^\\s*$';
  const escaped = escapeRegex(trimmed)
    .replace(/(?:\\-|\\=|\\~|_){3,}/g, '[-=~_]{2,}')
    .replace(/(\\\s|\s)+/g, '\\s+');
  return `^\\s*${escaped}\\s*$`;
}

function buildLineRegex(line: string, senderText: string, messageText: string): {
  regex: string;
  hasSender: boolean;
  hasMessage: boolean;
} {
  const sIdx = senderText ? line.indexOf(senderText) : -1;
  const mIdx = messageText ? line.indexOf(messageText) : -1;
  const hasSender = sIdx >= 0;
  const hasMessage = mIdx >= 0 && (!hasSender || mIdx !== sIdx);

  if (hasSender && hasMessage) {
    if (sIdx < mIdx) {
      const before = line.slice(0, sIdx);
      const between = line.slice(sIdx + senderText.length, mIdx);
      const after = line.slice(mIdx + messageText.length);
      return {
        regex: `^${buildSenderPrefix(before)}(?<sender>[a-zA-Z0-9_]{2,24})${escapeFixed(between)}(?<message>.+?)${escapeFixed(after)}$`,
        hasSender: true,
        hasMessage: true,
      };
    }
    const before = line.slice(0, mIdx);
    const between = line.slice(mIdx + messageText.length, sIdx);
    const after = line.slice(sIdx + senderText.length);
    return {
      regex: `^${escapeFixed(before)}(?<message>.+?)${escapeFixed(between)}(?<sender>[a-zA-Z0-9_]{2,24})${escapeFixed(after)}$`,
      hasSender: true,
      hasMessage: true,
    };
  }

  if (hasSender) {
    const before = line.slice(0, sIdx);
    const after = line.slice(sIdx + senderText.length);
    return {
      regex: `^${buildSenderPrefix(before)}(?<sender>[a-zA-Z0-9_]{2,24})${escapeFixed(after)}$`,
      hasSender: true,
      hasMessage: false,
    };
  }

  if (hasMessage) {
    const before = line.slice(0, mIdx);
    const after = line.slice(mIdx + messageText.length);
    return {
      regex: `^${escapeFixed(before)}(?<message>.+?)${escapeFixed(after)}$`,
      hasSender: false,
      hasMessage: true,
    };
  }

  return { regex: buildDecorativeLine(line), hasSender: false, hasMessage: false };
}

export function buildChatPattern(input: {
  lines: string[];
  senderText: string;
  messageText: string;
  type: ChatPatternType;
  name?: string;
}): { rule?: ChatPatternRule; error?: string } {
  const lines = input.lines.map(l => l.trimEnd()).filter((_, idx, arr) => idx < 8 && arr.length > 0);
  const senderText = input.senderText.trim();
  const messageText = input.messageText.trim();

  if (!lines.length) return { error: 'En az 1 sohbet satırı seçin.' };
  if (!messageText) return { error: 'Seçilen bloktaki mesaj metnini girin.' };

  const built = lines.map(line => buildLineRegex(line, senderText, messageText));
  const senderLineIndex = built.findIndex(item => item.hasSender);
  const messageLineIndex = built.findIndex(item => item.hasMessage);

  if (messageLineIndex < 0) {
    return { error: 'Girdiğiniz mesaj metni seçilen satırların hiçbirinde bulunamadı.' };
  }
  if (senderText && senderLineIndex < 0) {
    return { error: 'Girdiğiniz gönderen adı seçilen satırların hiçbirinde bulunamadı.' };
  }

  const rule: ChatPatternRule = {
    id: `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name?.trim() || `${input.type === 'pm' ? 'Özel Mesaj' : 'Genel Sohbet'}${lines.length > 1 ? ` (${lines.length} satır)` : ''}`,
    type: input.type,
    lineCount: lines.length,
    regexLines: built.map(item => item.regex),
    senderLineIndex,
    messageLineIndex,
    sampleLines: lines,
  };

  return { rule };
}

export function testChatPattern(rule: ChatPatternRule, lines: string[]): {
  matched: boolean;
  sender: string;
  message: string;
} {
  if (lines.length < rule.lineCount) return { matched: false, sender: '', message: '' };
  const slice = lines.slice(lines.length - rule.lineCount);
  let sender = '';
  let message = '';

  for (let i = 0; i < rule.lineCount; i++) {
    let re: RegExp;
    try { re = new RegExp(rule.regexLines[i], 'i'); }
    catch { return { matched: false, sender: '', message: '' }; }
    const m = re.exec(slice[i]);
    if (!m) return { matched: false, sender: '', message: '' };
    if (m.groups?.sender) sender = m.groups.sender;
    if (m.groups?.message) message = m.groups.message.trim();
  }

  return { matched: Boolean(message), sender, message };
}
