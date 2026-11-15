import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BotRepository } from './services/botRepository';
import { BotManager } from './services/botManager';
import { PluginDirectory } from './services/pluginDirectory';
import { ResourcePackService } from './services/resourcePackService';
import { MusicService } from './services/musicService';
import type { BotConfig, BotPluginSettings, InventoryAction, PluginScriptInfo, ControlName } from '../src/types/bot';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = process.env.VITE_DEV_SERVER_URL ? path.join(root, 'public') : path.join(root, 'dist');
const preload = path.join(root, 'dist-electron/preload.mjs');
const repository = new BotRepository(path.join(app.getPath('userData'), 'bots.json'));
const pluginDirectory = new PluginDirectory(path.join(app.getPath('userData'), 'plugins'));
const sendStateChanged = () => {
  for (const win of BrowserWindow.getAllWindows()) if (!win.isDestroyed()) win.webContents.send('state-changed');
};
const resourcePacks = new ResourcePackService(path.join(app.getPath('userData'), 'resourcepacks'), sendStateChanged);
const musicService = new MusicService(path.join(app.getPath('userData'), 'music'), sendStateChanged);
const windows = new Map<string, BrowserWindow>();
const deleting = new Set<string>();
let management: BrowserWindow | undefined;
let quitting = false;
let pluginScripts: PluginScriptInfo[] = [];

const notify = () => {
  sendStateChanged();
  const urls: string[] = [];
  for (const d of Object.values(bots.data)) {
    if (Array.isArray(d?.resourcePacks)) {
      for (const u of d.resourcePacks) if (typeof u === 'string' && u) urls.push(u);
    }
  }
  if (urls.length > 0) void resourcePacks.preloadUrls(urls);
};
const bots = new BotManager(path.join(publicDir, 'bot-worker.cjs'), pluginDirectory.dir, notify);

async function syncPluginScripts() {
  pluginScripts = await pluginDirectory.list();
  notify();
}

function requireBot(username: string) { const bot = repository.find(username); if (!bot) throw new Error('Bot bulunamadı.'); return bot; }

function createWindow(route: string, title: string) {
  const isLauncher = route === '/';
  let width = 380;
  let height = 680;
  let resizable = false;
  let minWidth = 380;
  let minHeight = 680;
  let maxWidth: number | undefined = 380;
  let maxHeight: number | undefined = 680;

  if (!isLauncher) {
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    width = Math.min(1280, workArea.width - 40);
    height = Math.min(840, workArea.height - 40);
    resizable = true;
    minWidth = Math.min(1040, width);
    minHeight = Math.min(700, height);
    maxWidth = undefined;
    maxHeight = undefined;
  }

  const win = new BrowserWindow({
    title,
    icon: path.join(publicDir, 'MynCraft.png'),
    resizable,
    maximizable: resizable,
    fullscreenable: false,
    width,
    height,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    frame: false,
    backgroundColor: '#0b1020',
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error(`[Electron] did-fail-load (${route}): ${code} ${desc} ${url}`);
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error(`[Renderer ${route}] ${message}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Electron] render-process-gone (${route}):`, details.reason, details.exitCode);
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https:')) void shell.openExternal(url); return { action: 'deny' }; });
  if (process.env.VITE_DEV_SERVER_URL) void win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${route}`);
  else void win.loadFile(path.join(root, 'dist/index.html'), { hash: route });
  return win;
}

function createManagement() { if (management && !management.isDestroyed()) { management.focus(); return; } management = createWindow('/', 'MynBot'); management.on('closed', () => { management = undefined; }); }

function openBot(username: string) {
  requireBot(username);
  if (deleting.has(username)) throw new Error('Bot siliniyor.');
  const existing = windows.get(username);
  if (existing && !existing.isDestroyed()) { if (existing.isMinimized()) existing.restore(); existing.focus(); return; }
  const win = createWindow(`/bot/${encodeURIComponent(username)}`, `MynBot — ${username}`);
  windows.set(username, win); notify();
  win.on('closed', () => { windows.delete(username); bots.disconnect(username); if (!quitting) notify(); });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  try { await repository.load(); } catch (error) { dialog.showErrorBox('MynBot — kayıt hatası', String(error)); app.quit(); return; }
  await syncPluginScripts().catch(() => {});
  void musicService.startBackgroundDownload();

  ipcMain.handle('snapshot', () => ({ bots: repository.list(), openWindows: [...windows.keys()], statuses: bots.statuses, data: bots.data, pluginsDir: pluginDirectory.dir, pluginScripts }));
  ipcMain.handle('add-bot', async (_event, bot: BotConfig) => { await repository.add(bot); notify(); });
  ipcMain.handle('update-bot', async (_event, bot: BotConfig) => {
    const state = bots.statuses[bot.username]?.state;
    if (state === 'connected' || state === 'connecting') throw new Error('Ayarları değiştirmeden önce bağlantıyı kesin.');
    await repository.update(bot); notify();
  });
  ipcMain.handle('update-plugins', async (_event, username: string, plugins: BotPluginSettings) => {
    await repository.updatePlugins(username, plugins);
    const updated = requireBot(username);
    if (updated.plugins) bots.updatePlugins(username, updated.plugins);
    notify();
  });
  ipcMain.handle('delete-bot', async (_event, username: string) => {
    if (deleting.has(username)) throw new Error('Bot zaten siliniyor.');
    deleting.add(username);
    try { await repository.remove(username, () => { if (windows.has(username)) throw new Error('Önce bot penceresini kapatın.'); }); delete bots.statuses[username]; delete bots.data[username]; notify(); }
    finally { deleting.delete(username); }
  });
  ipcMain.handle('open-bot-window', (_event, username: string) => openBot(username));
  ipcMain.handle('connect-bot', (_event, username: string) => { if (!windows.has(username)) throw new Error('Önce bot penceresini açın.'); bots.connect(requireBot(username)); });
  ipcMain.handle('disconnect-bot', (_event, username: string) => { requireBot(username); bots.disconnect(username); });
  ipcMain.handle('send-chat', (_event, username: string, message: string) => { requireBot(username); bots.chat(username, message); });
  ipcMain.handle('select-slot', (_event, username: string, slot: number) => { requireBot(username); bots.selectSlot(username, slot); });
  ipcMain.handle('inventory-click', (_event, username: string, action: InventoryAction) => { requireBot(username); return bots.clickInventory(username, action); });
  ipcMain.handle('open-block', (_event, username: string, pos: { x: number; y: number; z: number }) => { requireBot(username); return bots.openBlock(username, pos); });
  ipcMain.handle('close-container', (_event, username: string) => { requireBot(username); bots.closeContainer(username); });
  ipcMain.handle('rename-anvil', (_event, username: string, name: string) => { requireBot(username); bots.renameAnvil(username, name); });
  ipcMain.handle('set-control', (_event, username: string, control: ControlName, state: boolean) => { requireBot(username); bots.setControl(username, control, state); });
  ipcMain.handle('look-bot', (_event, username: string, yaw: number, pitch: number) => { requireBot(username); bots.lookBot(username, yaw, pitch); });
  ipcMain.handle('use-held-item', (_event, username: string) => { requireBot(username); bots.useHeldItem(username); });
  ipcMain.handle('scan-world', (_event, username: string) => { requireBot(username); bots.scanWorld(username); });
  ipcMain.handle('step-control', (_event, username: string, control: ControlName, durationMs?: number) => {
    requireBot(username);
    bots.stepControl(username, control, durationMs);
  });
  ipcMain.handle('move-to', (_event, username: string, pos: { x: number; y?: number; z: number }) => {
    requireBot(username);
    bots.moveTo(username, pos);
  });
  ipcMain.handle('interact-entity', (_event, username: string, entityId: number) => {
    requireBot(username);
    bots.interactEntity(username, entityId);
  });
  ipcMain.handle('set-physics', (_event, username: string, enabled: boolean) => {
    requireBot(username);
    bots.setPhysics(username, enabled);
  });
  ipcMain.handle('import-plugin', async event => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(parent || undefined!, {
      title: 'Eklenti dosyası seç (.js / .cjs)',
      filters: [{ name: 'JavaScript Eklentisi', extensions: ['js', 'cjs'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filename = await pluginDirectory.importFile(result.filePaths[0]);
    await syncPluginScripts();
    return filename;
  });
  ipcMain.handle('create-sample-plugin', async () => {
    const filename = await pluginDirectory.createSample();
    await syncPluginScripts();
    return filename;
  });
  ipcMain.handle('delete-plugin', async (_event, filename: string) => {
    await pluginDirectory.remove(filename);
    await syncPluginScripts();
  });
  ipcMain.handle('open-plugins-folder', async () => {
    await pluginDirectory.ensure();
    const err = await shell.openPath(pluginDirectory.dir);
    if (err) throw new Error(err);
  });
  ipcMain.handle('refresh-plugins', async () => { await syncPluginScripts(); });
  ipcMain.handle('download-resource-pack', async (event, url: string, suggestedName?: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw new Error('Geçersiz resource pack adresi.');
    const parent = BrowserWindow.fromWebContents(event.sender);
    const defaultName = (suggestedName || 'resourcepack.zip').replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = await dialog.showSaveDialog(parent || undefined!, {
      title: 'Resource Pack Kaydet',
      defaultPath: defaultName.endsWith('.zip') ? defaultName : `${defaultName}.zip`,
      filters: [{ name: 'ZIP Arşivi', extensions: ['zip'] }],
    });
    if (result.canceled || !result.filePath) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Resource pack indirilemedi (HTTP ${response.status}).`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(result.filePath, buffer);
    return result.filePath;
  });
  ipcMain.handle('resolve-resource-pack-texture', async (_event, itemName: string, customModelData?: number) => {
    const urls = new Set<string>();
    for (const d of Object.values(bots.data)) {
      if (Array.isArray(d?.resourcePacks)) {
        for (const u of d.resourcePacks) if (typeof u === 'string' && u) urls.add(u);
      }
    }
    return resourcePacks.resolveItemTexture(itemName, customModelData, [...urls]);
  });
  ipcMain.handle('music:get-state', async () => {
    await musicService.ensureCatalog();
    return musicService.getState();
  });
  ipcMain.handle('music:start-download', (_event, priorityTrackId?: string) => musicService.startBackgroundDownload(priorityTrackId));
  ipcMain.handle('music:get-track-bytes', (_event, trackId: string) => musicService.getTrackBytes(trackId));
  ipcMain.handle('close-window', event => BrowserWindow.fromWebContents(event.sender)?.close());

  createManagement();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createManagement(); });
});

app.on('before-quit', () => { quitting = true; bots.shutdown(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
