<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { defaultPluginSettings, type BotPluginSettings, type ChatPatternRule, type LoginPatternRule } from '../../types/bot';
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
import PluginIcon from './PluginIcon.vue';
import AppIcon from '../ui/AppIcon.vue';
import PluginSettingsModal from './PluginSettingsModal.vue';

interface PluginCardItem {
  id: string;
  kind: 'builtin' | 'script';
  defaultIcon: string;
  title: string;
  description: string;
  summary: string;
  status?: string;
  enabled: boolean;
  hasToggle: boolean;
  scriptFilename?: string;
  scriptSize?: number;
}

type FilterKey = 'all' | 'active' | 'builtin' | 'scripts';

const props = defineProps<{ username: string; connected: boolean }>();
const emit = defineEmits<{ error: [message: string] }>();
const api = window.electronAPI;
const store = useBotStore();
const { L, t } = useI18n();

function cloneSettings(source?: BotPluginSettings): BotPluginSettings {
  const defaults = defaultPluginSettings();
  const base = source ?? defaults;
  return {
    autoEat: { ...defaults.autoEat, ...(base.autoEat || {}) },
    autoArmor: { ...defaults.autoArmor, ...(base.autoArmor || {}) },
    autoFishing: { ...defaults.autoFishing, ...(base.autoFishing || {}) },
    autoTotem: { ...defaults.autoTotem, ...(base.autoTotem || {}) },
    autoPanic: { ...defaults.autoPanic, ...(base.autoPanic || {}), whitelist: [...(base.autoPanic?.whitelist || defaults.autoPanic.whitelist)] },
    autoDefend: { ...defaults.autoDefend, ...(base.autoDefend || {}) },
    autoLobby: { ...defaults.autoLobby, ...(base.autoLobby || {}) },
    autoAccept: {
      ...defaults.autoAccept,
      ...(base.autoAccept || {}),
      whitelist: [...(base.autoAccept?.whitelist || defaults.autoAccept.whitelist)],
      triggers: [...(base.autoAccept?.triggers ?? defaults.autoAccept.triggers)],
    },
    commandScheduler: {
      ...defaults.commandScheduler,
      ...(base.commandScheduler || {}),
      tasks: (base.commandScheduler?.tasks || []).map(task => ({ ...task })),
    },
    autoChestDump: {
      ...defaults.autoChestDump,
      ...(base.autoChestDump || {}),
      keepKeywords: [...(base.autoChestDump?.keepKeywords || defaults.autoChestDump.keepKeywords)],
    },
    autoReconnect: { ...defaults.autoReconnect, ...(base.autoReconnect || {}) },
    antiAfk: { ...defaults.antiAfk, ...(base.antiAfk || {}) },
    autoChat: { ...defaults.autoChat, ...(base.autoChat || {}), rules: (base.autoChat?.rules || []).map(r => ({ ...r })) },
    autoLogin: {
      ...defaults.autoLogin,
      ...(base.autoLogin || {}),
      patterns: (base.autoLogin?.patterns || []).map(p => ({ ...p, regexLines: [...p.regexLines], ...(p.sampleLines ? { sampleLines: [...p.sampleLines] } : {}) })),
    },
    chatPatterns: (base.chatPatterns || []).map(p => ({ ...p, regexLines: [...p.regexLines], ...(p.sampleLines ? { sampleLines: [...p.sampleLines] } : {}) })),
    enabledScripts: [...(base.enabledScripts || [])],
    moduleIcons: { ...(base.moduleIcons || {}) },
  };
}

const bot = computed(() => store.bots.find(item => item.username === props.username));
const draft = ref<BotPluginSettings>(cloneSettings(bot.value?.plugins));
const busy = ref(false);
const savedMessage = ref('');
const searchQuery = ref('');
const filterTab = ref<FilterKey>('all');
const activeModuleId = ref<string | null>(null);

watch(
  () => bot.value?.plugins,
  value => { if (!busy.value) draft.value = cloneSettings(value); },
  { deep: true }
);

const activeModulesCount = computed(() =>
  [
    draft.value.autoEat.enabled,
    draft.value.autoArmor.enabled,
    draft.value.autoFishing.enabled,
    draft.value.autoTotem.enabled,
    draft.value.autoPanic.enabled,
    draft.value.autoDefend.enabled,
    draft.value.autoLobby.enabled,
    draft.value.autoAccept.enabled,
    draft.value.commandScheduler.enabled,
    draft.value.autoChestDump.enabled,
    draft.value.autoReconnect.enabled,
    draft.value.antiAfk.enabled,
    draft.value.autoChat.enabled,
    draft.value.autoLogin.enabled,
  ].filter(Boolean).length
);

function automationHint(id: string, enabled: boolean): string {
  if (!enabled) return '';
  if (!props.connected) return t('plugins.waitingForConnection');
  const status = store.data[props.username]?.automation?.[id];
  if (!status) return '';
  return status.message?.trim() || t(`plugins.automation.${status.state}`);
}

const builtinCards = computed<PluginCardItem[]>(() => [
  {
    id: 'autoEat',
    kind: 'builtin',
    defaultIcon: 'Drumstick',
    title: t('plugins.autoEat.title'),
    description: t('plugins.autoEat.description'),
    summary: `${L('Açlık', 'Hunger')} ≤ ${draft.value.autoEat.hungerThreshold} · ${L('Can', 'Health')} ≤ ${draft.value.autoEat.healthThreshold}`,
    enabled: draft.value.autoEat.enabled,
    hasToggle: true,
    status: automationHint('autoEat', draft.value.autoEat.enabled),
  },
  {
    id: 'autoArmor',
    kind: 'builtin',
    defaultIcon: 'Shield',
    title: t('plugins.autoArmor.title'),
    description: t('plugins.autoArmor.description'),
    summary: `${draft.value.autoArmor.intervalSeconds} ${L('sn aralık', 's interval')}`,
    enabled: draft.value.autoArmor.enabled,
    hasToggle: true,
    status: automationHint('autoArmor', draft.value.autoArmor.enabled),
  },
  {
    id: 'autoFishing',
    kind: 'builtin',
    defaultIcon: 'item:fishing_rod',
    title: t('plugins.autoFishing.title'),
    description: t('plugins.autoFishing.description'),
    summary: `${draft.value.autoFishing.recastDelaySeconds} ${L('sn tekrar atış', 's recast')} · ${draft.value.autoFishing.timeoutSeconds} ${L('sn zaman aşımı', 's timeout')}`,
    enabled: draft.value.autoFishing.enabled,
    hasToggle: true,
    status: automationHint('autoFishing', draft.value.autoFishing.enabled),
  },
  {
    id: 'autoTotem',
    kind: 'builtin',
    defaultIcon: 'item:totem_of_undying',
    title: t('plugins.autoTotem.title'),
    description: t('plugins.autoTotem.description'),
    summary: `${draft.value.autoTotem.priorityItem === 'shield' ? L('Kalkan', 'Shield') : 'Totem'} · ${L('Can', 'HP')} ≤ ${draft.value.autoTotem.healthThreshold}`,
    enabled: draft.value.autoTotem.enabled,
    hasToggle: true,
    status: automationHint('autoTotem', draft.value.autoTotem.enabled),
  },
  {
    id: 'autoPanic',
    kind: 'builtin',
    defaultIcon: 'Zap',
    title: t('plugins.autoPanic.title'),
    description: t('plugins.autoPanic.description'),
    summary: `${L('Can', 'HP')} ≤ ${draft.value.autoPanic.healthThreshold} · ${draft.value.autoPanic.action === 'command' ? draft.value.autoPanic.panicCommand : L('Çıkış', 'Disconnect')}`,
    enabled: draft.value.autoPanic.enabled,
    hasToggle: true,
    status: automationHint('autoPanic', draft.value.autoPanic.enabled),
  },
  {
    id: 'autoDefend',
    kind: 'builtin',
    defaultIcon: 'Swords',
    title: t('plugins.autoDefend.title'),
    description: t('plugins.autoDefend.description'),
    summary: `${draft.value.autoDefend.radius}m · ${draft.value.autoDefend.attackIntervalMs}ms`,
    enabled: draft.value.autoDefend.enabled,
    hasToggle: true,
    status: automationHint('autoDefend', draft.value.autoDefend.enabled),
  },
  {
    id: 'autoLobby',
    kind: 'builtin',
    defaultIcon: 'Compass',
    title: t('plugins.autoLobby.title'),
    description: t('plugins.autoLobby.description'),
    summary: `${draft.value.autoLobby.delaySeconds} ${L('sn', 's')}${draft.value.autoLobby.hotbarSlot > 0 ? ` · Slot ${draft.value.autoLobby.hotbarSlot}` : ''}${draft.value.autoLobby.postCommand ? ` · ${draft.value.autoLobby.postCommand}` : ''}`,
    enabled: draft.value.autoLobby.enabled,
    hasToggle: true,
    status: automationHint('autoLobby', draft.value.autoLobby.enabled),
  },
  {
    id: 'autoAccept',
    kind: 'builtin',
    defaultIcon: 'Check',
    title: t('plugins.autoAccept.title'),
    description: t('plugins.autoAccept.description'),
    summary: `${draft.value.autoAccept.onlyWhitelist ? `${draft.value.autoAccept.whitelist.length} ${L('güvenli', 'trusted')}` : L('Herkes', 'Anyone')} · ${draft.value.autoAccept.acceptCommand}`,
    enabled: draft.value.autoAccept.enabled,
    hasToggle: true,
    status: automationHint('autoAccept', draft.value.autoAccept.enabled),
  },
  {
    id: 'commandScheduler',
    kind: 'builtin',
    defaultIcon: 'item:clock',
    title: t('plugins.commandScheduler.title'),
    description: t('plugins.commandScheduler.description'),
    summary: `${draft.value.commandScheduler.tasks.length} ${L('görev', 'tasks')}`,
    enabled: draft.value.commandScheduler.enabled,
    hasToggle: true,
    status: automationHint('commandScheduler', draft.value.commandScheduler.enabled),
  },
  {
    id: 'autoChestDump',
    kind: 'builtin',
    defaultIcon: 'Box',
    title: t('plugins.autoChestDump.title'),
    description: t('plugins.autoChestDump.description'),
    summary: `${L('Boş', 'Free')} ≤ ${draft.value.autoChestDump.freeSlotsThreshold} · ${draft.value.autoChestDump.searchRadius}m`,
    enabled: draft.value.autoChestDump.enabled,
    hasToggle: true,
    status: automationHint('autoChestDump', draft.value.autoChestDump.enabled),
  },
  {
    id: 'autoReconnect',
    kind: 'builtin',
    defaultIcon: 'RefreshCw',
    title: L('Otomatik Yeniden Bağlanma', 'Auto Reconnect'),
    description: L('Bağlantı koptuğunda veya atıldığında botu otomatik yeniden bağlar.', 'Automatically reconnects the bot when disconnected or kicked.'),
    summary: `${draft.value.autoReconnect.delaySeconds} ${L('sn', 's')} · ${draft.value.autoReconnect.maxAttempts === 0 ? L('Sınırsız', 'Unlimited') : `${draft.value.autoReconnect.maxAttempts} ${L('deneme', 'tries')}`}`,
    enabled: draft.value.autoReconnect.enabled,
    hasToggle: true,
  },
  {
    id: 'antiAfk',
    kind: 'builtin',
    defaultIcon: 'Footprints',
    title: L('Anti-AFK', 'Anti-AFK'),
    description: L('Sunucu AFK zaman aşımını önlemek için düzenli küçük hareketler yapar.', 'Performs periodic micro-movements to prevent server AFK timeout.'),
    summary: `${draft.value.antiAfk.intervalSeconds} ${L('sn', 's')}${draft.value.antiAfk.jump ? ` · ${L('Zıpla', 'Jump')}` : ''}${draft.value.antiAfk.rotate ? ` · ${L('Dön', 'Rotate')}` : ''}`,
    enabled: draft.value.antiAfk.enabled,
    hasToggle: true,
  },
  {
    id: 'autoChat',
    kind: 'builtin',
    defaultIcon: 'MessageSquare',
    title: L('Otomatik Sohbet', 'Auto Chat'),
    description: L('Sunucuya girince mesaj gönderir ve sohbet tetikleyicilerine otomatik yanıt verir.', 'Sends message upon joining and automatically responds to chat triggers.'),
    summary: `${draft.value.autoChat.rules.length} ${L('kural', 'rules')} · ${draft.value.autoChat.cooldownSeconds} ${L('sn', 's')}`,
    enabled: draft.value.autoChat.enabled,
    hasToggle: true,
  },
  {
    id: 'autoLogin',
    kind: 'builtin',
    defaultIcon: 'KeyRound',
    title: t('plugins.autoLogin.title'),
    description: t('plugins.autoLogin.description'),
    summary: `${draft.value.autoLogin.password ? L('Şifre ayarlı', 'Password set') : L('Şifre yok', 'No password')} · ${draft.value.autoLogin.patterns.length} ${L('kalıp', 'patterns')} · ${draft.value.autoLogin.cooldownSeconds} ${L('sn', 's')}`,
    enabled: draft.value.autoLogin.enabled,
    hasToggle: true,
    status: automationHint('autoLogin', draft.value.autoLogin.enabled),
  },
  {
    id: 'chatCalibrator',
    kind: 'builtin',
    defaultIcon: 'ScanLine',
    title: L('Sohbet Kalibratörü', 'Chat Calibrator'),
    description: L('Özel sunucu sohbet ve PM biçimlerini yakalayıp regex kalıbı çıkarır.', 'Captures custom server chat and PM formats to build regex patterns.'),
    summary: `${draft.value.chatPatterns.length} ${L('kalıp', 'patterns')}`,
    enabled: draft.value.chatPatterns.length > 0,
    hasToggle: false,
  },
]);

const scriptCards = computed<PluginCardItem[]>(() =>
  store.pluginScripts.map(script => ({
    id: `script:${script.filename}`,
    kind: 'script',
    defaultIcon: 'Code',
    title: script.filename,
    description: L('Yerel Mineflayer (.js / .cjs) eklentisi.', 'Local Mineflayer (.js / .cjs) plugin.'),
    summary: `${Math.max(1, Math.round(script.size / 1024))} KB`,
    enabled: draft.value.enabledScripts.includes(script.filename),
    hasToggle: true,
    scriptFilename: script.filename,
    scriptSize: script.size,
  }))
);

const allCards = computed(() => [...builtinCards.value, ...scriptCards.value]);

const filteredCards = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return allCards.value.filter(card => {
    if (filterTab.value === 'active' && !card.enabled) return false;
    if (filterTab.value === 'builtin' && card.kind !== 'builtin') return false;
    if (filterTab.value === 'scripts' && card.kind !== 'script') return false;
    if (!q) return true;
    return card.title.toLowerCase().includes(q) || card.description.toLowerCase().includes(q);
  });
});

const activeCard = computed(() => allCards.value.find(c => c.id === activeModuleId.value) ?? null);

function resolveCardIcon(card: PluginCardItem): string {
  return draft.value.moduleIcons?.[card.id] || card.defaultIcon;
}

async function persist(notice?: string) {
  if (busy.value) return;
  busy.value = true;
  savedMessage.value = '';
  emit('error', '');
  try {
    await api.updatePlugins(props.username, cloneSettings(draft.value));
    await store.refresh();
    savedMessage.value = notice || L('Eklenti ayarları kaydedildi.', 'Plugin settings saved.');
  } catch (err) {
    emit('error', String(err));
  } finally {
    busy.value = false;
  }
}

function toggleModule(id: string) {
  if (id === 'autoEat') {
    draft.value.autoEat.enabled = !draft.value.autoEat.enabled;
    void persist();
    return;
  }
  if (id === 'autoArmor') {
    draft.value.autoArmor.enabled = !draft.value.autoArmor.enabled;
    void persist();
    return;
  }
  if (id === 'autoFishing') {
    draft.value.autoFishing.enabled = !draft.value.autoFishing.enabled;
    void persist();
    return;
  }
  if (id === 'autoTotem') {
    draft.value.autoTotem.enabled = !draft.value.autoTotem.enabled;
    void persist();
    return;
  }
  if (id === 'autoPanic') {
    draft.value.autoPanic.enabled = !draft.value.autoPanic.enabled;
    void persist();
    return;
  }
  if (id === 'autoDefend') {
    draft.value.autoDefend.enabled = !draft.value.autoDefend.enabled;
    void persist();
    return;
  }
  if (id === 'autoLobby') {
    draft.value.autoLobby.enabled = !draft.value.autoLobby.enabled;
    void persist();
    return;
  }
  if (id === 'autoAccept') {
    draft.value.autoAccept.enabled = !draft.value.autoAccept.enabled;
    void persist();
    return;
  }
  if (id === 'commandScheduler') {
    draft.value.commandScheduler.enabled = !draft.value.commandScheduler.enabled;
    void persist();
    return;
  }
  if (id === 'autoChestDump') {
    draft.value.autoChestDump.enabled = !draft.value.autoChestDump.enabled;
    void persist();
    return;
  }
  if (id === 'autoReconnect') {
    draft.value.autoReconnect.enabled = !draft.value.autoReconnect.enabled;
    void persist();
    return;
  }
  if (id === 'antiAfk') {
    draft.value.antiAfk.enabled = !draft.value.antiAfk.enabled;
    void persist();
    return;
  }
  if (id === 'autoChat') {
    draft.value.autoChat.enabled = !draft.value.autoChat.enabled;
    void persist();
    return;
  }
  if (id === 'autoLogin') {
    draft.value.autoLogin.enabled = !draft.value.autoLogin.enabled;
    void persist();
    return;
  }
  if (id.startsWith('script:')) {
    toggleScript(id.slice(7));
  }
}

function setModuleIcon(id: string, icon: string | null) {
  const icons = { ...(draft.value.moduleIcons || {}) };
  if (!icon) {
    delete icons[id];
  } else {
    icons[id] = icon;
  }
  draft.value.moduleIcons = icons;
  void persist(L('Eklenti ikonu güncellendi.', 'Plugin icon updated.'));
}

function addRule() {
  if (draft.value.autoChat.rules.length >= 30) return;
  draft.value.autoChat.rules.push({
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    trigger: '',
    response: '',
    scope: 'all',
  });
}

function addPattern(rule: ChatPatternRule) {
  if (draft.value.chatPatterns.length >= 20) return;
  draft.value.chatPatterns.push(rule);
  void persist(`"${rule.name}" ${L('kalıbı kaydedildi.', 'pattern saved.')}`);
}

function removePattern(id: string) {
  draft.value.chatPatterns = draft.value.chatPatterns.filter(p => p.id !== id);
  void persist(L('Sohbet kalıbı silindi.', 'Chat pattern deleted.'));
}

function addLoginPattern(rule: LoginPatternRule) {
  if (draft.value.autoLogin.patterns.length >= 20) return;
  draft.value.autoLogin.patterns.push(rule);
  void persist(`"${rule.name}" ${L('kalıbı kaydedildi.', 'pattern saved.')}`);
}

function removeLoginPattern(id: string) {
  draft.value.autoLogin.patterns = draft.value.autoLogin.patterns.filter(p => p.id !== id);
  void persist(L('Giriş kalıbı silindi.', 'Login pattern deleted.'));
}

function removeRule(index: number) {
  draft.value.autoChat.rules.splice(index, 1);
}

function addScheduledTask() {
  if (draft.value.commandScheduler.tasks.length >= 20) return;
  draft.value.commandScheduler.tasks.push({
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    command: '',
    intervalSeconds: 300,
    enabled: true,
  });
}

function removeScheduledTask(index: number) {
  draft.value.commandScheduler.tasks.splice(index, 1);
}

function toggleScript(filename: string) {
  const list = draft.value.enabledScripts;
  const idx = list.indexOf(filename);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(filename);
  void persist(`"${filename}" ${L('güncellendi.', 'updated.')}`);
}

async function runFileAction(fn: () => Promise<unknown>, successText?: string) {
  if (busy.value) return;
  busy.value = true;
  savedMessage.value = '';
  emit('error', '');
  try {
    await fn();
    await store.refresh();
    if (successText) savedMessage.value = successText;
  } catch (err) {
    emit('error', String(err));
  } finally {
    busy.value = false;
  }
}

async function importScript() {
  await runFileAction(async () => {
    const filename = await api.importPlugin();
    if (filename) savedMessage.value = `"${filename}" ${L('eklendi.', 'added.')}`;
  });
}

async function createSample() {
  await runFileAction(async () => {
    const filename = await api.createSamplePlugin();
    savedMessage.value = `${L('Örnek dosya hazır:', 'Sample file created:')} ${filename}`;
  });
}

async function deleteScript(filename: string) {
  await runFileAction(async () => {
    await api.deletePlugin(filename);
    const idx = draft.value.enabledScripts.indexOf(filename);
    if (idx >= 0) {
      draft.value.enabledScripts.splice(idx, 1);
    }
    if (draft.value.moduleIcons?.[`script:${filename}`]) {
      const icons = { ...draft.value.moduleIcons };
      delete icons[`script:${filename}`];
      draft.value.moduleIcons = icons;
    }
    await api.updatePlugins(props.username, cloneSettings(draft.value));
    if (activeModuleId.value === `script:${filename}`) {
      activeModuleId.value = null;
    }
  }, `"${filename}" ${L('silindi.', 'deleted.')}`);
}
</script>

<template>
  <div class="plugins-page">
    <div class="panel-card plugins-header-card">
      <div class="plugins-header-top">
        <div>
          <h2>{{ L('Eklentiler', 'Plugins') }}</h2>
          <p class="plugins-subtitle">
            {{ activeModulesCount }} {{ L('yerleşik modül', 'built-in modules') }} · {{ draft.enabledScripts.length }} {{ L('yerel dosya etkin', 'local scripts active') }}
          </p>
        </div>
        <div class="plugins-toolbar">
          <button type="button" class="secondary compact" :disabled="busy" @click="runFileAction(() => api.refreshPlugins(), L('Liste yenilendi.', 'List refreshed.'))"><AppIcon name="RefreshCw" :size="15" /> {{ L('Yenile', 'Refresh') }}</button>
          <button type="button" class="secondary compact" :disabled="busy" @click="runFileAction(() => api.openPluginsFolder())"><AppIcon name="FolderOpen" :size="15" /> {{ L('Klasörü aç', 'Open folder') }}</button>
          <button type="button" class="secondary compact" :disabled="busy" @click="createSample"><AppIcon name="FileCode" :size="15" /> {{ L('Örnek oluştur', 'Create sample') }}</button>
          <button type="button" class="panel-connect compact" :disabled="busy" @click="importScript"><AppIcon name="Plus" :size="15" /> {{ L('Dosya ekle', 'Add file') }}</button>
        </div>
      </div>

      <div class="plugins-filter-bar">
        <input
          v-model="searchQuery"
          type="search"
          class="plugins-search"
          :placeholder="t('plugins.searchPlaceholder')"
        />
        <div class="plugins-filter-pills">
          <button type="button" class="filter-pill" :class="{ active: filterTab === 'all' }" @click="filterTab = 'all'">{{ t('plugins.filterAll') }}</button>
          <button type="button" class="filter-pill" :class="{ active: filterTab === 'active' }" @click="filterTab = 'active'">{{ t('plugins.filterActive') }}</button>
          <button type="button" class="filter-pill" :class="{ active: filterTab === 'builtin' }" @click="filterTab = 'builtin'">{{ t('plugins.filterBuiltin') }}</button>
          <button type="button" class="filter-pill" :class="{ active: filterTab === 'scripts' }" @click="filterTab = 'scripts'">{{ t('plugins.filterScripts') }}</button>
        </div>
      </div>

      <p v-if="store.pluginsDir" class="plugins-path">{{ L('Eklenti klasörü:', 'Plugins folder:') }} <code>{{ store.pluginsDir }}</code></p>
      <p v-if="savedMessage" class="plugins-saved">{{ savedMessage }}</p>
    </div>

    <div v-if="filteredCards.length" class="plugins-box-grid">
      <div
        v-for="card in filteredCards"
        :key="card.id"
        class="panel-card plugin-box"
        :class="{ active: card.enabled }"
        role="button"
        tabindex="0"
        @click="activeModuleId = card.id"
        @keydown.enter.prevent="activeModuleId = card.id"
      >
        <div class="plugin-box-top">
          <PluginIcon :icon="resolveCardIcon(card)" :size="44" />
          <label
            v-if="card.hasToggle"
            class="switch plugin-box-switch"
            @click.stop
          >
            <input
              type="checkbox"
              :checked="card.enabled"
              :disabled="busy"
              @change="toggleModule(card.id)"
            />
            <span>{{ card.enabled ? L('Açık', 'On') : L('Kapalı', 'Off') }}</span>
          </label>
          <span v-else class="plugin-box-badge">
            {{ card.summary }}
          </span>
        </div>

        <div class="plugin-box-body">
          <h3>{{ card.title }}</h3>
          <p class="plugin-box-desc">{{ card.description }}</p>
          <p v-if="card.status" class="plugin-box-status" :title="card.status">{{ card.status }}</p>
        </div>

        <div class="plugin-box-foot">
          <span class="plugin-box-summary">{{ card.summary }}</span>
          <span class="plugin-box-gear"><AppIcon name="Settings" :size="15" /> {{ t('plugins.settingsHint') }}</span>
        </div>
      </div>
    </div>

    <div v-else class="panel-card">
      <p class="empty-copy">{{ t('plugins.noMatch') }}</p>
    </div>

    <PluginSettingsModal
      :module-id="activeModuleId"
      :draft="draft"
      :username="username"
      :connected="connected"
      :busy="busy"
      :default-icon="activeCard?.defaultIcon || 'Plug'"
      :title="activeCard?.title || ''"
      :description="activeCard?.description || ''"
      :script-size="activeCard?.scriptSize"
      @close="activeModuleId = null"
      @save="persist()"
      @toggle="activeModuleId && toggleModule(activeModuleId)"
      @add-rule="addRule"
      @remove-rule="removeRule"
      @add-scheduled-task="addScheduledTask"
      @remove-scheduled-task="removeScheduledTask"
      @add-pattern="addPattern"
      @remove-pattern="removePattern"
      @add-login-pattern="addLoginPattern"
      @remove-login-pattern="removeLoginPattern"
      @delete-script="deleteScript"
      @set-icon="icon => activeModuleId && setModuleIcon(activeModuleId, icon)"
    />
  </div>
</template>

<style scoped>
.plugins-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}
.plugins-search {
  flex: 1;
  min-width: 190px;
}
.plugins-filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-pill {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(15, 23, 42, 0.65);
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 11px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-pill:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}
.filter-pill.active {
  background: rgba(185, 244, 119, 0.16);
  border-color: var(--accent, #b9f477);
  color: var(--accent, #b9f477);
}
.plugins-box-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}
.plugin-box {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.16s, background 0.16s;
  border: 1px solid rgba(226, 232, 240, 0.14);
  border-radius: var(--radius-card, 16px);
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(12px);
}
.plugin-box:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(30, 41, 59, 0.68);
}
.plugin-box.active {
  border-color: rgba(185, 244, 119, 0.42);
}
.plugin-box-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.plugin-box-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.28);
}
.plugin-box-body h3 {
  margin: 0 0 4px;
  font-size: 14px;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.plugin-box-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: #94a3b8;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.plugin-box-status {
  margin: 7px 0 0;
  color: #b8c5d8;
  font-size: 10px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.plugin-box-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
}
.plugin-box-summary {
  color: #cbd5e1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.plugin-box-gear {
  color: #cbd5e1;
  font-weight: 600;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.plugins-page :deep(.secondary), .plugins-page :deep(.panel-connect) { min-height: 40px; border-radius: var(--radius-control, 8px); }
.plugins-page :deep(.plugins-header-card) { border-radius: var(--radius-card, 16px); background: rgba(15, 23, 42, 0.56); backdrop-filter: blur(12px); }
</style>
