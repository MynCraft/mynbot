export interface AutoReconnectSettings {
  enabled: boolean;
  delaySeconds: number;
  maxAttempts: number;
}

export interface AntiAfkSettings {
  enabled: boolean;
  intervalSeconds: number;
  jump: boolean;
  rotate: boolean;
}

export type ChatPatternType = 'chat' | 'pm';

export interface ChatPatternRule {
  id: string;
  name: string;
  type: ChatPatternType;
  lineCount: number;
  regexLines: string[];
  senderLineIndex: number;
  messageLineIndex: number;
  sampleLines?: string[];
}

export interface AutoChatRule {
  id: string;
  trigger: string;
  response: string;
  scope?: 'all' | 'chat' | 'pm';
}

export interface AutoChatSettings {
  enabled: boolean;
  joinMessage: string;
  cooldownSeconds: number;
  rules: AutoChatRule[];
}

export type LoginPatternAction = 'login' | 'register';

export interface LoginPatternRule {
  id: string;
  name: string;
  action: LoginPatternAction;
  lineCount: number;
  regexLines: string[];
  triggerText?: string;
  sampleLines?: string[];
}

export interface AutoLoginSettings {
  enabled: boolean;
  password: string;
  loginCommand: string;
  registerCommand: string;
  cooldownSeconds: number;
  patterns: LoginPatternRule[];
}

export interface AutoEatSettings { enabled: boolean; hungerThreshold: number; healthThreshold: number; selection: 'saturation' | 'food'; allowGoldenApples: boolean; restoreHeldItem: boolean }
export interface AutoArmorSettings { enabled: boolean; intervalSeconds: number }
export interface AutoFishingSettings { enabled: boolean; recastDelaySeconds: number; timeoutSeconds: number }

export interface AutoTotemSettings {
  enabled: boolean;
  priorityItem: 'totem' | 'shield';
  healthThreshold: number;
  intervalSeconds: number;
}

export interface AutoPanicSettings {
  enabled: boolean;
  healthThreshold: number;
  disconnectOnPlayer: boolean;
  playerRadius: number;
  whitelist: string[];
  action: 'disconnect' | 'command';
  panicCommand: string;
  disableReconnect: boolean;
}

export interface AutoDefendSettings {
  enabled: boolean;
  radius: number;
  attackIntervalMs: number;
  autoEquipWeapon: boolean;
  attackCreepers: boolean;
  restoreHeldItem: boolean;
}

export interface AutoLobbySettings {
  enabled: boolean;
  delaySeconds: number;
  hotbarSlot: number;
  clickSlot: number;
  itemKeyword: string;
  postCommand: string;
}

export interface AutoAcceptSettings {
  enabled: boolean;
  onlyWhitelist: boolean;
  whitelist: string[];
  triggers: string[];
  acceptCommand: string;
  cooldownSeconds: number;
}

export interface ScheduledCommandTask {
  id: string;
  command: string;
  intervalSeconds: number;
  enabled: boolean;
}

export interface CommandSchedulerSettings {
  enabled: boolean;
  tasks: ScheduledCommandTask[];
}

export interface AutoChestDumpSettings {
  enabled: boolean;
  freeSlotsThreshold: number;
  searchRadius: number;
  intervalSeconds: number;
  keepFoods: boolean;
  keepToolsAndArmor: boolean;
  keepKeywords: string[];
}

export interface AutomationStatus { state: 'idle' | 'waiting' | 'running' | 'error'; message?: string; lastRunAt?: number }

export interface BotPluginSettings {
  autoEat: AutoEatSettings;
  autoArmor: AutoArmorSettings;
  autoFishing: AutoFishingSettings;
  autoTotem: AutoTotemSettings;
  autoPanic: AutoPanicSettings;
  autoDefend: AutoDefendSettings;
  autoLobby: AutoLobbySettings;
  autoAccept: AutoAcceptSettings;
  commandScheduler: CommandSchedulerSettings;
  autoChestDump: AutoChestDumpSettings;
  autoReconnect: AutoReconnectSettings;
  antiAfk: AntiAfkSettings;
  autoChat: AutoChatSettings;
  autoLogin: AutoLoginSettings;
  chatPatterns: ChatPatternRule[];
  enabledScripts: string[];
  moduleIcons?: Record<string, string>;
}

export interface PluginScriptInfo {
  filename: string;
  size: number;
  updatedAt: number;
}

export function defaultPluginSettings(): BotPluginSettings {
  return {
    autoEat: { enabled: false, hungerThreshold: 16, healthThreshold: 10, selection: 'saturation', allowGoldenApples: false, restoreHeldItem: true },
    autoArmor: { enabled: false, intervalSeconds: 10 },
    autoFishing: { enabled: false, recastDelaySeconds: 2, timeoutSeconds: 60 },
    autoTotem: { enabled: false, priorityItem: 'totem', healthThreshold: 12, intervalSeconds: 1 },
    autoPanic: { enabled: false, healthThreshold: 6, disconnectOnPlayer: false, playerRadius: 12, whitelist: [], action: 'disconnect', panicCommand: '/spawn', disableReconnect: true },
    autoDefend: { enabled: false, radius: 4, attackIntervalMs: 650, autoEquipWeapon: true, attackCreepers: false, restoreHeldItem: true },
    autoLobby: { enabled: false, delaySeconds: 4, hotbarSlot: 0, clickSlot: -1, itemKeyword: '', postCommand: '' },
    autoAccept: { enabled: false, onlyWhitelist: true, whitelist: [], triggers: ['ışınlanma isteği', 'sana ışınlanmak', 'teleport request', '/tpaccept'], acceptCommand: '/tpaccept', cooldownSeconds: 3 },
    commandScheduler: { enabled: false, tasks: [] },
    autoChestDump: { enabled: false, freeSlotsThreshold: 3, searchRadius: 4, intervalSeconds: 15, keepFoods: true, keepToolsAndArmor: true, keepKeywords: [] },
    autoReconnect: { enabled: false, delaySeconds: 5, maxAttempts: 5 },
    antiAfk: { enabled: false, intervalSeconds: 30, jump: true, rotate: true },
    autoChat: { enabled: false, joinMessage: '', cooldownSeconds: 3, rules: [] },
    autoLogin: { enabled: false, password: '', loginCommand: '/login {password}', registerCommand: '/register {password} {password}', cooldownSeconds: 5, patterns: [] },
    chatPatterns: [],
    enabledScripts: [],
    moduleIcons: {},
  };
}

export interface BotConfig {
  username: string;
  host: string;
  port: number;
  version?: string;
  plugins?: BotPluginSettings;
}

export interface ChatSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
}

export interface ChatEntry {
  text: string;
  segments?: ChatSegment[];
}

export interface BotPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  food: number;
  physicsEnabled?: boolean;
  onGround?: boolean;
  chunkLoaded?: boolean;
}

export interface WorldBlock {
  dx: number;
  dy: number;
  dz: number;
  x: number;
  y: number;
  z: number;
  name: string;
  displayName: string;
  interactable?: 'chest' | 'anvil' | 'crafting' | 'furnace' | 'container';
  distance: number;
}

export interface WorldEntity {
  id: number;
  name: string;
  displayName: string;
  type: 'player' | 'npc' | 'mob' | 'object';
  x: number;
  y: number;
  z: number;
  distance: number;
}

export interface WorldSnapshot {
  center: { x: number; y: number; z: number };
  blocks: WorldBlock[];
  entities?: WorldEntity[];
}

export interface OpenWindowInfo {
  id: number;
  type: string;
  title: string;
  titleSegments?: ChatSegment[];
  containerSlotCount: number;
  totalSlots: number;
  slots: InventoryItem[];
}

export type ControlName = 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sneak' | 'sprint';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export interface BotStatus { state: ConnectionState; message?: string }
export interface CursorItem {
  name: string;
  displayName: string;
  count: number;
  customName?: string;
  nameSegments?: ChatSegment[];
  lore?: ChatSegment[][];
  headTextureUrl?: string;
  enchanted?: boolean;
  customModelData?: number;
}
export interface InventoryItem extends CursorItem {
  slot: number;
}
export type InventoryAction = { slot: number; button: 0 | 1; mode: 0 | 1 | 4 };
export interface BotData {
  automation?: Record<string, AutomationStatus>;
  inventory: InventoryItem[];
  cursor: CursorItem | null;
  slotCount: number;
  selectedSlot: number;
  chat: ChatEntry[];
  logs: string[];
  resourcePacks?: string[];
  pose?: BotPose;
  world?: WorldSnapshot;
  openWindow?: OpenWindowInfo | null;
  lastError?: string;
}

export interface Snapshot {
  bots: BotConfig[];
  openWindows: string[];
  statuses: Record<string, BotStatus>;
  data: Record<string, BotData>;
  pluginsDir: string;
  pluginScripts: PluginScriptInfo[];
}

export interface MusicTrackInfo {
  id: string;
  key: string;
  title: string;
  author: string;
  category: string;
  hash: string;
  size: number;
  downloaded: boolean;
}

export interface MusicCatalogState {
  tracks: MusicTrackInfo[];
  downloadedCount: number;
  totalCount: number;
  downloading: boolean;
  error?: string;
}

export interface ElectronAPI {
  snapshot(): Promise<Snapshot>;
  addBot(bot: BotConfig): Promise<void>;
  updateBot(bot: BotConfig): Promise<void>;
  updatePlugins(username: string, plugins: BotPluginSettings): Promise<void>;
  deleteBot(username: string): Promise<void>;
  openBotWindow(username: string): Promise<void>;
  closeWindow(): Promise<void>;
  connect(username: string): Promise<void>;
  disconnect(username: string): Promise<void>;
  sendChat(username: string, message: string): Promise<void>;
  selectSlot(username: string, slot: number): Promise<void>;
  clickInventory(username: string, action: InventoryAction): Promise<void>;
  openBlock(username: string, pos: { x: number; y: number; z: number }): Promise<void>;
  closeContainer(username: string): Promise<void>;
  renameAnvil(username: string, name: string): Promise<void>;
  setControl(username: string, control: ControlName, state: boolean): Promise<void>;
  stepControl(username: string, control: ControlName, durationMs?: number): Promise<void>;
  moveTo(username: string, pos: { x: number; y?: number; z: number }): Promise<void>;
  interactEntity(username: string, entityId: number): Promise<void>;
  setPhysics(username: string, enabled: boolean): Promise<void>;
  lookBot(username: string, yaw: number, pitch: number): Promise<void>;
  useHeldItem(username: string): Promise<void>;
  scanWorld(username: string): Promise<void>;
  importPlugin(): Promise<string | null>;
  createSamplePlugin(): Promise<string>;
  deletePlugin(filename: string): Promise<void>;
  openPluginsFolder(): Promise<void>;
  refreshPlugins(): Promise<void>;
  downloadResourcePack(url: string, suggestedName?: string): Promise<string | null>;
  resolveResourcePackTexture(itemName: string, customModelData?: number): Promise<string | null>;
  getMusicState(): Promise<MusicCatalogState>;
  startMusicDownload(priorityTrackId?: string): Promise<MusicCatalogState>;
  getMusicTrackBytes(trackId: string): Promise<Uint8Array | null>;
  onChange(callback: () => void): () => void;
}
