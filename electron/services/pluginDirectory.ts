import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PluginScriptInfo } from '../../src/types/bot';
import { isValidPluginFilename } from './pluginConfig';

const SAMPLE_PLUGIN = `'use strict';

/**
 * Ornek MynBot / Mineflayer eklentisi.
 * Her eklenti ya dogrudan bir fonksiyon (bot, ctx) => void
 * ya da { name, setup(bot, ctx) } nesnesi disa aktarabilir.
 *
 * Not: setup() ilk spawn sonrasinda cagirilir (bot.entity ve envanter hazirdir).
 * ctx.onParsedChat(parsed => ...): Plugins > Sohbet Kalibratoru uzerinden
 * desen tanimliysa { type, sender, message, rawLines } nesnesi ile tetiklenir.
 * Desen tanimlanmamissa parsedChat tetiklenmez; ham metin icin bot.on('messagestr', ...) kullanabilirsiniz.
 */
module.exports = {
  name: 'Ornek Selamlama',
  setup(bot, ctx) {
    ctx.log('Ornek eklenti yuklendi.');

    // Kalibre edilmis sohbet / PM desenleri icin (onerilen):
    ctx.onParsedChat(parsed => {
      if (!parsed.sender || parsed.sender === bot.username) return;
      if (parsed.message.trim().toLowerCase() === '!selam') {
        bot.chat(\`Merhaba \${parsed.sender}!\`);
      }
    });

    // Kalibrasyon yapilmamis sunucularda yedek olarak ham sohbet dinleyicisi:
    const onMessage = message => {
      const text = String(message || '').trim();
      if (text.endsWith('!selam') && !text.includes(bot.username)) {
        bot.chat('Merhaba!');
      }
    };

    bot.on('messagestr', onMessage);
    return () => {
      bot.removeListener('messagestr', onMessage);
    };
  },
};
`;

export class PluginDirectory {
  constructor(readonly dir: string) {}

  async ensure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private resolveSafe(filename: string): string {
    if (!isValidPluginFilename(filename)) {
      throw new Error('Geçersiz eklenti dosya adı. Yalnızca harf, rakam, ".", "_" ve "-" içeren .js / .cjs dosyaları desteklenir.');
    }
    const target = path.resolve(this.dir, filename);
    if (path.dirname(target) !== path.resolve(this.dir)) {
      throw new Error('Geçersiz eklenti yolu.');
    }
    return target;
  }

  async list(): Promise<PluginScriptInfo[]> {
    await this.ensure();
    const entries = await fs.readdir(this.dir, { withFileTypes: true });
    const scripts: PluginScriptInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !isValidPluginFilename(entry.name)) continue;
      const stat = await fs.stat(path.join(this.dir, entry.name));
      scripts.push({ filename: entry.name, size: stat.size, updatedAt: stat.mtimeMs });
    }
    return scripts.sort((a, b) => a.filename.localeCompare(b.filename));
  }

  async importFile(sourcePath: string): Promise<string> {
    await this.ensure();
    const rawName = path.basename(sourcePath);
    const ext = path.extname(rawName).toLowerCase();
    if (ext !== '.js' && ext !== '.cjs') {
      throw new Error('Yalnızca .js veya .cjs eklenti dosyaları eklenebilir.');
    }
    const stem = path.basename(rawName, path.extname(rawName)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'plugin';
    const filename = `${stem}${ext}`;
    const target = this.resolveSafe(filename);
    await fs.copyFile(sourcePath, target);
    return filename;
  }

  async createSample(): Promise<string> {
    await this.ensure();
    const filename = 'ornek-selamla.cjs';
    const target = this.resolveSafe(filename);
    try {
      await fs.access(target);
      return filename;
    } catch {
      await fs.writeFile(target, SAMPLE_PLUGIN, 'utf8');
      return filename;
    }
  }

  async remove(filename: string): Promise<void> {
    const target = this.resolveSafe(filename);
    await fs.rm(target, { force: true });
  }
}
