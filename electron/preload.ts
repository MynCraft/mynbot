import { contextBridge, ipcRenderer } from 'electron';
import type { BotConfig, BotPluginSettings, ControlName, ElectronAPI } from '../src/types/bot';

const api: ElectronAPI = {
  snapshot: () => ipcRenderer.invoke('snapshot'),
  addBot: (bot: BotConfig) => ipcRenderer.invoke('add-bot', bot),
  updateBot: (bot: BotConfig) => ipcRenderer.invoke('update-bot', bot),
  updatePlugins: (username: string, plugins: BotPluginSettings) => ipcRenderer.invoke('update-plugins', username, plugins),
  deleteBot: (username: string) => ipcRenderer.invoke('delete-bot', username),
  openBotWindow: (username: string) => ipcRenderer.invoke('open-bot-window', username),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  connect: (username: string) => ipcRenderer.invoke('connect-bot', username),
  disconnect: (username: string) => ipcRenderer.invoke('disconnect-bot', username),
  sendChat: (username, message) => ipcRenderer.invoke('send-chat', username, message),
  selectSlot: (username, slot) => ipcRenderer.invoke('select-slot', username, slot),
  clickInventory: (username, action) => ipcRenderer.invoke('inventory-click', username, action),
  openBlock: (username: string, pos: { x: number; y: number; z: number }) => ipcRenderer.invoke('open-block', username, pos),
  closeContainer: (username: string) => ipcRenderer.invoke('close-container', username),
  renameAnvil: (username: string, name: string) => ipcRenderer.invoke('rename-anvil', username, name),
  setControl: (username: string, control: ControlName, state: boolean) => ipcRenderer.invoke('set-control', username, control, state),
  stepControl: (username: string, control: ControlName, durationMs?: number) => ipcRenderer.invoke('step-control', username, control, durationMs),
  moveTo: (username: string, pos: { x: number; y?: number; z: number }) => ipcRenderer.invoke('move-to', username, pos),
  interactEntity: (username: string, entityId: number) => ipcRenderer.invoke('interact-entity', username, entityId),
  setPhysics: (username: string, enabled: boolean) => ipcRenderer.invoke('set-physics', username, enabled),
  lookBot: (username: string, yaw: number, pitch: number) => ipcRenderer.invoke('look-bot', username, yaw, pitch),
  useHeldItem: (username: string) => ipcRenderer.invoke('use-held-item', username),
  scanWorld: (username: string) => ipcRenderer.invoke('scan-world', username),
  importPlugin: () => ipcRenderer.invoke('import-plugin'),
  createSamplePlugin: () => ipcRenderer.invoke('create-sample-plugin'),
  deletePlugin: (filename: string) => ipcRenderer.invoke('delete-plugin', filename),
  openPluginsFolder: () => ipcRenderer.invoke('open-plugins-folder'),
  refreshPlugins: () => ipcRenderer.invoke('refresh-plugins'),
  downloadResourcePack: (url: string, suggestedName?: string) => ipcRenderer.invoke('download-resource-pack', url, suggestedName),
  resolveResourcePackTexture: (itemName: string, customModelData?: number) => ipcRenderer.invoke('resolve-resource-pack-texture', itemName, customModelData),
  getMusicState: () => ipcRenderer.invoke('music:get-state'),
  startMusicDownload: (priorityTrackId?: string) => ipcRenderer.invoke('music:start-download', priorityTrackId),
  getMusicTrackBytes: (trackId: string) => ipcRenderer.invoke('music:get-track-bytes', trackId),
  onChange: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('state-changed', listener);
    return () => ipcRenderer.removeListener('state-changed', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
