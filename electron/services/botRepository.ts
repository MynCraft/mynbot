import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BotConfig, BotPluginSettings } from '../../src/types/bot';
import { validatePluginSettings } from './pluginConfig';

export function validateBot(value: BotConfig): BotConfig {
  if (!value || typeof value.username !== 'string' || !/^[a-zA-Z0-9_]{3,16}$/.test(value.username)) throw new Error('Kullanıcı adı 3–16 harf, rakam veya alt çizgi içermeli.');
  if (typeof value.host !== 'string' || !value.host.trim() || value.host.length > 253 || /\s/.test(value.host)) throw new Error('Geçerli bir sunucu adresi girin.');
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) throw new Error('Port 1 ile 65535 arasında olmalı.');
  if (value.version !== undefined && (typeof value.version !== 'string' || value.version.length > 32)) throw new Error('Geçersiz sürüm.');
  return {
    username: value.username,
    host: value.host.trim(),
    port: value.port,
    ...(value.version?.trim() ? { version: value.version.trim() } : {}),
    plugins: validatePluginSettings(value.plugins),
  };
}
export class BotRepository {
  private bots: BotConfig[] = [];
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly file: string) {}
  async load() {
    try {
      const data: unknown = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (!Array.isArray(data)) throw new Error('Kayıt listesi geçersiz.');
      this.bots = data.map(validateBot);
      if (new Set(this.bots.map(bot => bot.username.toLowerCase())).size !== this.bots.length) throw new Error('Tekrarlanan kullanıcı adı.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error(`Bot kayıtları okunamadı: ${String(error)}. Dosya korunmuştur: ${this.file}`);
    }
  }
  list() { return this.bots.map(bot => ({ ...bot })); }
  find(username: string) { return this.bots.find(bot => bot.username === username); }
  private change(fn: (bots: BotConfig[]) => BotConfig[]) {
    const operation = this.queue.then(async () => {
      const next = fn(this.bots);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.tmp`;
      try { await fs.writeFile(temp, JSON.stringify(next, null, 2), 'utf8'); await fs.rename(temp, this.file); }
      catch (error) { await fs.rm(temp, { force: true }).catch(() => {}); throw error; }
      this.bots = next;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  add(input: BotConfig) { const bot = validateBot(input); return this.change(bots => { if (bots.some(b => b.username.toLowerCase() === bot.username.toLowerCase())) throw new Error('Bu kullanıcı adı zaten kayıtlı.'); return [...bots, bot]; }); }
  update(input: BotConfig) {
    const existing = this.find(input.username);
    const bot = validateBot({ ...input, plugins: input.plugins ?? existing?.plugins });
    return this.change(bots => {
      if (!bots.some(b => b.username === bot.username)) throw new Error('Bot bulunamadı.');
      return bots.map(b => b.username === bot.username ? bot : b);
    });
  }
  updatePlugins(username: string, plugins: BotPluginSettings) {
    const validated = validatePluginSettings(plugins);
    return this.change(bots => {
      if (!bots.some(b => b.username === username)) throw new Error('Bot bulunamadı.');
      return bots.map(b => b.username === username ? { ...b, plugins: validated } : b);
    });
  }
  remove(username: string, assertAllowed: () => void) { return this.change(bots => { assertAllowed(); if (!bots.some(b => b.username === username)) throw new Error('Bot bulunamadı.'); return bots.filter(b => b.username !== username); }); }
}
