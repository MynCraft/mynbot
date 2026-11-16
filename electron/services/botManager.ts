import { fork, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { existsSync, readdirSync } from 'node:fs';
import type { BotConfig, BotStatus, BotData, BotPluginSettings, InventoryAction, ControlName } from '../../src/types/bot';

export class BotManager {
  private worker?: ChildProcess;
  private requestId = 0;
  private pending = new Map<number, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private configs = new Map<string, BotConfig>();
  private manualDisconnects = new Set<string>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private connectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectAttempts = new Map<string, number>();

  readonly statuses: Record<string, BotStatus> = {};
  readonly data: Record<string, BotData> = {};

  constructor(private workerPath: string, private pluginsDir: string, private notify: () => void) {}

  private entry(username: string): BotData {
    return this.data[username] ||= { inventory: [], cursor: null, slotCount: 0, selectedSlot: 0, chat: [], logs: [] };
  }

  private pushLog(username: string, line: string) {
    const data = this.entry(username);
    data.logs = [...data.logs, `${new Date().toLocaleTimeString()}  ${line}`].slice(-200);
  }

  private clearReconnect(username: string) {
    const timer = this.reconnectTimers.get(username);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(username);
    }
  }

  private clearConnectTimer(username: string) {
    const timer = this.connectTimers.get(username);
    if (timer) {
      clearTimeout(timer);
      this.connectTimers.delete(username);
    }
  }

  private clearBotData(username: string) {
    const data = this.entry(username);
    data.inventory = [];
    data.cursor = null;
    data.slotCount = 0;
    data.pose = undefined;
    data.world = undefined;
    data.openWindow = null;
    data.automation = undefined;
  }

  private scheduleReconnect(username: string) {
    this.clearReconnect(username);
    if (this.manualDisconnects.has(username)) return;
    const bot = this.configs.get(username);
    const ar = bot?.plugins?.autoReconnect;
    if (!bot || !ar?.enabled) return;

    const nextAttempt = (this.reconnectAttempts.get(username) || 0) + 1;
    if (ar.maxAttempts > 0 && nextAttempt > ar.maxAttempts) {
      this.pushLog(username, `Otomatik yeniden bağlanma durduruldu (${ar.maxAttempts}/${ar.maxAttempts} deneme).`);
      return;
    }

    this.reconnectAttempts.set(username, nextAttempt);
    const suffix = ar.maxAttempts > 0 ? `${nextAttempt}/${ar.maxAttempts}` : `${nextAttempt}`;
    this.pushLog(username, `Otomatik yeniden bağlanma: ${ar.delaySeconds} sn sonra denenecek (${suffix}).`);

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(username);
      if (this.manualDisconnects.has(username)) return;
      const latest = this.configs.get(username);
      const state = this.statuses[username]?.state;
      if (!latest?.plugins?.autoReconnect.enabled || state === 'connected' || state === 'connecting') return;
      try { this.connect(latest, true); } catch (error) { this.pushLog(username, `Yeniden bağlanma hatası: ${String(error)}`); this.notify(); }
    }, ar.delaySeconds * 1000);
    this.reconnectTimers.set(username, timer);
  }

  private send(value: object) {
    if (!this.worker?.connected) throw new Error('Bot işlemi çalışmıyor.');
    const worker = this.worker;
    worker.send(value, error => {
      if (!error || this.worker !== worker) return;
      const command = value as { username?: string; bot?: BotConfig; requestId?: number };
      if (command.requestId != null) {
        const request = this.pending.get(command.requestId);
        if (request) { clearTimeout(request.timer); this.pending.delete(command.requestId); request.reject(error); }
      }
      const username = command.username || command.bot?.username;
      if (!username) return;
      this.pushLog(username, error.message);
      this.notify();
    });
  }

  private runtime(): string {
    const candidates = [process.env.MYNBOT_NODE, 'node'];
    const nvm = path.join(os.homedir(), '.local/share/nvm');
    try { for (const name of readdirSync(nvm).sort().reverse()) if (/^v\d/.test(name)) candidates.push(path.join(nvm, name, 'bin/node')); } catch { /* optional runtime location */ }
    for (const candidate of candidates) {
      if (!candidate) continue;
      const result = spawnSync(candidate, ['-p', 'process.versions.node'], { encoding: 'utf8', timeout: 3000, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined } });
      if (result.status === 0 && Number(result.stdout.trim().split('.')[0]) >= 22) return candidate;
    }
    throw new Error('Node.js 22 veya üzeri bulunamadı. Node 22 kurun veya MYNBOT_NODE ortam değişkenini Node çalıştırılabilir dosyasına ayarlayın.');
  }

  private start() {
    if (this.worker?.connected) return;
    if (!existsSync(this.workerPath)) throw new Error('Bot çalışma dosyası bulunamadı.');
    const appNodeModules = path.resolve(path.dirname(this.workerPath), '..', 'node_modules');
    const nodePath = process.env.NODE_PATH ? `${appNodeModules}${path.delimiter}${process.env.NODE_PATH}` : appNodeModules;
    const worker = fork(this.workerPath, [], { execPath: this.runtime(), env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, NODE_PATH: nodePath }, silent: true });
    this.worker = worker;
    let stderr = '';
    worker.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-1200); });
    worker.on('message', (value: unknown) => {
      const msg = value as {
        requestId?: number;
        cursor?: BotData['cursor'];
        slotCount?: number;
        type: string;
        username: string;
        state: BotStatus['state'];
        reason?: string;
        message?: string;
        text?: string;
        url?: string;
        segments?: BotData['chat'][number]['segments'];
        inventory?: BotData['inventory'];
        selectedSlot?: number;
        openWindow?: BotData['openWindow'];
        pose?: BotData['pose'];
        world?: BotData['world'];
        automation?: BotData['automation'];
      };
      if (msg.type === 'result' && msg.requestId != null) {
        const request = this.pending.get(msg.requestId);
        if (request) { clearTimeout(request.timer); this.pending.delete(msg.requestId); if (msg.message) request.reject(new Error(msg.message)); else request.resolve(); }
        return;
      }
      if (typeof msg.username !== 'string') return;
      const data = this.entry(msg.username);
      if (msg.type === 'status' && ['connecting', 'connected', 'disconnected', 'error'].includes(msg.state)) {
        this.statuses[msg.username] = { state: msg.state, message: msg.message };
        this.pushLog(msg.username, msg.message || ({ connecting: 'Bağlanıyor', connected: 'Bağlantı kuruldu', disconnected: 'Bağlantı kapatıldı', error: 'Bağlantı hatası' } as const)[msg.state]);
        if (msg.state === 'connected') {
          this.clearConnectTimer(msg.username);
          this.reconnectAttempts.delete(msg.username);
          this.clearReconnect(msg.username);
        } else if (msg.state === 'disconnected' || msg.state === 'error') {
          this.clearConnectTimer(msg.username);
          this.clearBotData(msg.username);
          this.scheduleReconnect(msg.username);
        }
      } else if (msg.type === 'automation' && this.statuses[msg.username]?.state === 'connected') {
        data.automation = msg.automation;
      } else if (msg.type === 'inventory' && this.statuses[msg.username]?.state === 'connected') {
        data.inventory = msg.inventory || [];
        data.selectedSlot = msg.selectedSlot || 0;
        data.cursor = msg.cursor || null;
        data.slotCount = msg.slotCount || 0;
        data.openWindow = msg.openWindow ?? null;
      } else if (msg.type === 'pose' && this.statuses[msg.username]?.state === 'connected') {
        if (msg.pose) data.pose = msg.pose;
      } else if (msg.type === 'world' && this.statuses[msg.username]?.state === 'connected') {
        if (msg.world) data.world = msg.world;
      } else if (msg.type === 'chat' && msg.text) {
        data.chat = [...data.chat, { text: msg.text, ...(msg.segments?.length ? { segments: msg.segments } : {}) }].slice(-200);
      } else if (msg.type === 'resource-pack' && msg.url) {
        const list = data.resourcePacks || [];
        if (!list.includes(msg.url)) data.resourcePacks = [...list, msg.url];
      } else if (msg.type === 'log' && msg.message) {
        this.pushLog(msg.username, msg.message);
      } else if (msg.type === 'panic-disconnect') {
        this.manualDisconnects.add(msg.username);
        this.clearReconnect(msg.username);
        this.pushLog(msg.username, `Acil panik çıkışı (${msg.reason || 'Tetiklendi'}): Otomatik yeniden bağlanma durduruldu.`);
      } else if (msg.type === 'operation-error') {
        this.pushLog(msg.username, msg.message || 'İşlem başarısız');
        this.statuses[msg.username] = { ...this.statuses[msg.username], message: msg.message };
      }
      this.notify();
    });
    const stopped = (error?: Error) => {
      if (this.worker !== worker) return;
      this.worker = undefined;
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Bot işlemi durdu.')); }
      this.pending.clear();
      for (const [username, status] of Object.entries(this.statuses)) {
        this.clearConnectTimer(username);
        if (status.state === 'connecting' || status.state === 'connected') {
          status.state = 'error';
          status.message = error?.message || stderr || 'Bot işlemi durdu.';
          this.clearBotData(username);
          this.scheduleReconnect(username);
        }
      }
      this.notify();
    };
    worker.on('error', stopped);
    worker.on('exit', () => stopped());
  }

  connect(bot: BotConfig, keepAttemptCount = false) {
    if (['connecting', 'connected'].includes(this.statuses[bot.username]?.state)) throw new Error('Bot zaten bağlanıyor veya bağlı.');
    this.manualDisconnects.delete(bot.username);
    this.clearReconnect(bot.username);
    this.clearConnectTimer(bot.username);
    if (!keepAttemptCount) this.reconnectAttempts.delete(bot.username);
    this.configs.set(bot.username, bot);
    this.start();
    this.statuses[bot.username] = { state: 'connecting' };
    this.notify();
    const { plugins, ...connection } = bot;
    this.send({ action: 'connect', bot: connection, plugins, pluginsDir: this.pluginsDir });
    const timer = setTimeout(() => {
      this.connectTimers.delete(bot.username);
      if (this.statuses[bot.username]?.state !== 'connecting') return;
      this.statuses[bot.username] = { state: 'error', message: 'Bağlantı zaman aşımı' };
      this.pushLog(bot.username, 'Bağlantı zaman aşımı (30 sn).');
      this.clearBotData(bot.username);
      if (this.worker?.connected) {
        try { this.send({ action: 'disconnect', username: bot.username }); } catch { /* ignore */ }
      }
      this.scheduleReconnect(bot.username);
      this.notify();
    }, 30_000);
    this.connectTimers.set(bot.username, timer);
  }

  updatePlugins(username: string, plugins: BotPluginSettings) {
    const existing = this.configs.get(username);
    if (existing) this.configs.set(username, { ...existing, plugins });
    if (!plugins.autoReconnect.enabled) this.clearReconnect(username);
    if (this.worker?.connected) {
      this.send({ action: 'update-plugins', username, plugins, pluginsDir: this.pluginsDir });
    }
  }

  disconnect(username: string) {
    this.manualDisconnects.add(username);
    this.clearReconnect(username);
    this.clearConnectTimer(username);
    this.reconnectAttempts.delete(username);
    if (this.worker?.connected) this.send({ action: 'disconnect', username });
    this.clearBotData(username);
    this.statuses[username] = { state: 'disconnected' };
    this.notify();
  }

  chat(username: string, message: string) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (typeof message !== 'string' || !message.trim() || message.length > 256) throw new Error('Mesaj 1–256 karakter olmalı.');
    this.send({ action: 'chat', username, message: message.trim() });
  }

  selectSlot(username: string, slot: number) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (!Number.isInteger(slot) || slot < 0 || slot > 8) throw new Error('Geçersiz hızlı erişim yuvası.');
    this.send({ action: 'slot', username, slot });
  }

  clickInventory(username: string, click: InventoryAction): Promise<void> {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    const count = this.entry(username).slotCount;
    if (!click || !Number.isInteger(click.slot) || ![0, 1].includes(click.button) || ![0, 1, 4].includes(click.mode) || (click.slot === -999 ? click.mode !== 0 : click.slot < 0 || click.slot >= count)) throw new Error('Geçersiz envanter işlemi.');
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Envanter işlemi zaman aşımına uğradı.')); }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.send({ action: 'inventory-click', username, click, requestId }); }
      catch (error) { clearTimeout(timer); this.pending.delete(requestId); reject(error); }
    });
  }

  openBlock(username: string, pos: { x: number; y: number; z: number }): Promise<void> {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
      throw new Error('Geçersiz blok konumu.');
    }
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error('Blok açma zaman aşımına uğradı.')); }, 15000);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.send({ action: 'open-block', username, pos, requestId }); }
      catch (error) { clearTimeout(timer); this.pending.delete(requestId); reject(error); }
    });
  }

  closeContainer(username: string) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    this.send({ action: 'close-container', username });
  }

  renameAnvil(username: string, name: string) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    this.send({ action: 'rename-anvil', username, name: String(name || '').slice(0, 50) });
  }

  setControl(username: string, control: ControlName, state: boolean) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    const valid: ControlName[] = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
    if (!valid.includes(control)) throw new Error('Geçersiz kontrol.');
    this.send({ action: 'set-control', username, control, state: Boolean(state) });
  }

  lookBot(username: string, yaw: number, pitch: number) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (typeof yaw !== 'number' || typeof pitch !== 'number' || Number.isNaN(yaw) || Number.isNaN(pitch)) {
      throw new Error('Geçersiz bakış açısı.');
    }
    this.send({ action: 'look', username, yaw, pitch });
  }

  useHeldItem(username: string) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    this.send({ action: 'use-item', username });
  }

  scanWorld(username: string) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    this.send({ action: 'scan-world', username });
  }

  stepControl(username: string, control: ControlName, durationMs?: number) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    const valid: ControlName[] = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
    if (!valid.includes(control)) throw new Error('Geçersiz kontrol.');
    this.send({ action: 'step-control', username, control, durationMs });
  }

  moveTo(username: string, pos: { x: number; y?: number; z: number }) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (!pos || typeof pos.x !== 'number' || typeof pos.z !== 'number') throw new Error('Geçersiz hedef konumu.');
    this.send({ action: 'move-to', username, pos });
  }

  interactEntity(username: string, entityId: number) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    if (!Number.isInteger(entityId)) throw new Error('Geçersiz varlık kimliği.');
    this.send({ action: 'interact-entity', username, entityId });
  }

  setPhysics(username: string, enabled: boolean) {
    if (this.statuses[username]?.state !== 'connected') throw new Error('Bot bağlı değil.');
    this.send({ action: 'set-physics', username, enabled: Boolean(enabled) });
  }

  shutdown() {
    for (const username of this.reconnectTimers.keys()) {
      this.manualDisconnects.add(username);
      this.clearReconnect(username);
    }
    this.worker?.disconnect();
    this.worker = undefined;
  }
}
