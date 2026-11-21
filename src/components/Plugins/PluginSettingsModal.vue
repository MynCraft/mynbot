<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { BotPluginSettings, ChatPatternRule, LoginPatternRule } from '../../types/bot';
import { useI18n } from '../../i18n';
import ChatCalibrator from './ChatCalibrator.vue';
import LoginCalibrator from './LoginCalibrator.vue';
import PluginIcon from './PluginIcon.vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{
  moduleId: string | null;
  draft: BotPluginSettings;
  username: string;
  connected: boolean;
  busy: boolean;
  defaultIcon: string;
  title: string;
  description: string;
  scriptSize?: number;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  toggle: [];
  addRule: [];
  removeRule: [index: number];
  addScheduledTask: [];
  removeScheduledTask: [index: number];
  addPattern: [rule: ChatPatternRule];
  removePattern: [id: string];
  addLoginPattern: [rule: LoginPatternRule];
  removeLoginPattern: [id: string];
  deleteScript: [filename: string];
  setIcon: [icon: string | null];
}>();

const { L, t } = useI18n();
const showIconPicker = ref(false);
const customUrlInput = ref('');
const iconError = ref('');
const showPassword = ref(false);

const ITEM_ICON_PRESETS = [
  'item:ender_pearl',
  'item:leather_boots',
  'item:writable_book',
  'item:spyglass',
  'item:command_block',
  'item:cooked_beef',
  'item:golden_apple',
  'item:diamond_sword',
  'item:totem_of_undying',
  'item:redstone',
  'item:repeater',
  'item:compass',
  'item:clock',
  'item:nether_star',
  'item:feather',
  'item:experience_bottle',
];

const ICON_PRESETS = ['RefreshCw', 'Footprints', 'MessageSquare', 'KeyRound', 'Lock', 'Target', 'BookOpen', 'Drumstick', 'Swords', 'Shield', 'Zap', 'Bot', 'Info', 'Settings'];

watch(() => props.moduleId, () => {
  showIconPicker.value = false;
  customUrlInput.value = '';
  iconError.value = '';
  showPassword.value = false;
});

const currentIcon = computed(() => {
  if (!props.moduleId) return props.defaultIcon;
  return props.draft.moduleIcons?.[props.moduleId] || props.defaultIcon;
});

const isScript = computed(() => Boolean(props.moduleId?.startsWith('script:')));
const scriptFilename = computed(() => (isScript.value && props.moduleId ? props.moduleId.slice(7) : ''));

const isEnabled = computed(() => {
  if (!props.moduleId) return false;
  if (props.moduleId === 'autoEat') return props.draft.autoEat.enabled;
  if (props.moduleId === 'autoArmor') return props.draft.autoArmor.enabled;
  if (props.moduleId === 'autoFishing') return props.draft.autoFishing.enabled;
  if (props.moduleId === 'autoTotem') return props.draft.autoTotem.enabled;
  if (props.moduleId === 'autoPanic') return props.draft.autoPanic.enabled;
  if (props.moduleId === 'autoDefend') return props.draft.autoDefend.enabled;
  if (props.moduleId === 'autoLobby') return props.draft.autoLobby.enabled;
  if (props.moduleId === 'autoAccept') return props.draft.autoAccept.enabled;
  if (props.moduleId === 'commandScheduler') return props.draft.commandScheduler.enabled;
  if (props.moduleId === 'autoChestDump') return props.draft.autoChestDump.enabled;
  if (props.moduleId === 'autoReconnect') return props.draft.autoReconnect.enabled;
  if (props.moduleId === 'antiAfk') return props.draft.antiAfk.enabled;
  if (props.moduleId === 'autoChat') return props.draft.autoChat.enabled;
  if (props.moduleId === 'autoLogin') return props.draft.autoLogin.enabled;
  if (isScript.value) return props.draft.enabledScripts.includes(scriptFilename.value);
  return true;
});

function parseCsvList(value: string, maxItems: number, maxLen: number): string[] {
  return value.split(',').map(s => s.trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
}

const panicWhitelistText = computed({
  get: () => props.draft.autoPanic.whitelist.join(', '),
  set: (v: string) => { props.draft.autoPanic.whitelist = parseCsvList(v, 30, 32); },
});

const acceptWhitelistText = computed({
  get: () => props.draft.autoAccept.whitelist.join(', '),
  set: (v: string) => { props.draft.autoAccept.whitelist = parseCsvList(v, 30, 32); },
});

const acceptTriggersText = computed({
  get: () => props.draft.autoAccept.triggers.join(', '),
  set: (v: string) => { props.draft.autoAccept.triggers = parseCsvList(v, 20, 64); },
});

const chestKeepKeywordsText = computed({
  get: () => props.draft.autoChestDump.keepKeywords.join(', '),
  set: (v: string) => { props.draft.autoChestDump.keepKeywords = parseCsvList(v, 20, 64); },
});

const hasToggle = computed(() => props.moduleId !== 'chatCalibrator');

function applyCustomUrl() {
  iconError.value = '';
  const url = customUrlInput.value.trim();
  if (!url) return;
  if (!url.startsWith('https://') && !url.startsWith('data:image/')) {
    iconError.value = L('Yalnızca https:// veya görsel verisi kabul edilir.', 'Only https:// or image data URLs are allowed.');
    return;
  }
  emit('setIcon', url);
  customUrlInput.value = '';
}

function handleFileUpload(event: Event) {
  iconError.value = '';
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 120 * 1024) {
    iconError.value = L('Görsel 120 KB sınırını aşmamalıdır.', 'Image must be 120 KB or smaller.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
      emit('setIcon', reader.result);
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.moduleId) {
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="moduleId" class="plugin-modal-backdrop" @click.self="emit('close')">
      <div class="plugin-modal-card" role="dialog" aria-modal="true" :aria-label="title">
        <header class="plugin-modal-head">
          <div class="plugin-modal-identity">
            <button
              type="button"
              class="icon-edit-trigger"
              :title="t('plugins.changeIcon')"
              @click="showIconPicker = !showIconPicker"
            >
              <PluginIcon :icon="currentIcon" :size="48" />
              <span class="icon-edit-badge"><AppIcon name="SlidersHorizontal" :size="11" /></span>
            </button>
            <div>
              <h3>{{ title }}</h3>
              <p>{{ description }}</p>
            </div>
          </div>
          <div class="plugin-modal-head-actions">
            <label v-if="hasToggle" class="switch">
              <input
                type="checkbox"
                :checked="isEnabled"
                :disabled="busy"
                @change="emit('toggle')"
              />
              <span>{{ isEnabled ? L('Açık', 'On') : L('Kapalı', 'Off') }}</span>
            </label>
            <button
              type="button"
              class="secondary compact"
              @click="showIconPicker = !showIconPicker"
            >
              {{ t('plugins.changeIcon') }}
            </button>
            <button
              type="button"
              class="modal-close-btn"
              :aria-label="L('Kapat', 'Close')"
              @click="emit('close')"
            >
              <AppIcon name="X" :size="16" />
            </button>
          </div>
        </header>

        <!-- Icon Picker Panel -->
        <section v-if="showIconPicker" class="icon-picker-box">
          <div class="icon-picker-head">
            <span>{{ L('Minecraft Eşyası veya Simge Seç', 'Choose Minecraft Item or Icon') }}</span>
            <button
              v-if="draft.moduleIcons?.[moduleId]"
              type="button"
              class="secondary compact"
              @click="emit('setIcon', null)"
            >
              {{ t('plugins.resetIcon') }}
            </button>
          </div>
          <div class="icon-preset-grid">
            <button
              v-for="preset in ITEM_ICON_PRESETS"
              :key="preset"
              type="button"
              class="icon-preset-btn"
              :class="{ active: currentIcon === preset }"
              :title="preset.slice(5)"
              @click="emit('setIcon', preset)"
            >
              <PluginIcon :icon="preset" :size="34" />
            </button>
            <button
              v-for="icon in ICON_PRESETS"
              :key="icon"
              type="button"
              class="icon-preset-btn"
              :class="{ active: currentIcon === icon || currentIcon === `icon:${icon}` }"
              :title="icon"
              @click="emit('setIcon', `icon:${icon}`)"
            >
              <PluginIcon :icon="icon" :size="34" />
            </button>
          </div>
          <div class="icon-custom-row">
            <input
              v-model="customUrlInput"
              type="url"
              :placeholder="t('plugins.customIconUrl')"
              @keydown.enter.prevent="applyCustomUrl"
            />
            <button type="button" class="secondary compact" @click="applyCustomUrl">
              {{ L('Uygula', 'Apply') }}
            </button>
            <label class="secondary compact upload-icon-label">
              {{ t('plugins.uploadIcon') }}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                @change="handleFileUpload"
              />
            </label>
          </div>
          <p v-if="iconError" class="icon-error">{{ iconError }}</p>
        </section>

        <!-- Dynamic Module Body -->
        <div class="plugin-modal-body">
          <template v-if="moduleId === 'autoEat'">
            <p class="plugins-note">{{ t('plugins.autoEat.description') }}</p>
            <div class="fields">
              <div>
                <label for="eat-hunger">{{ t('plugins.autoEat.hungerThreshold') }}</label>
                <input id="eat-hunger" v-model.number="draft.autoEat.hungerThreshold" type="number" min="1" max="19" />
                <small>{{ t('plugins.autoEat.hungerHelp') }}</small>
              </div>
              <div>
                <label for="eat-health">{{ t('plugins.autoEat.healthThreshold') }}</label>
                <input id="eat-health" v-model.number="draft.autoEat.healthThreshold" type="number" min="1" max="20" />
                <small>{{ t('plugins.autoEat.healthHelp') }}</small>
              </div>
              <div>
                <label for="eat-selection">{{ t('plugins.autoEat.selection') }}</label>
                <select id="eat-selection" v-model="draft.autoEat.selection">
                  <option value="saturation">{{ t('plugins.autoEat.saturation') }}</option>
                  <option value="food">{{ t('plugins.autoEat.food') }}</option>
                </select>
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.autoEat.allowGoldenApples" type="checkbox" /> {{ t('plugins.autoEat.allowGoldenApples') }}</label>
                <label class="check-item"><input v-model="draft.autoEat.restoreHeldItem" type="checkbox" /> {{ t('plugins.autoEat.restoreHeldItem') }}</label>
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoArmor'">
            <p class="plugins-note">{{ t('plugins.autoArmor.description') }}</p>
            <div class="fields">
              <div>
                <label for="armor-interval">{{ t('plugins.autoArmor.interval') }}</label>
                <input id="armor-interval" v-model.number="draft.autoArmor.intervalSeconds" type="number" min="2" max="120" />
                <small>{{ t('plugins.autoArmor.intervalHelp') }}</small>
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoFishing'">
            <p class="plugins-note">{{ t('plugins.autoFishing.description') }}</p>
            <div class="fields">
              <div>
                <label for="fishing-delay">{{ t('plugins.autoFishing.recastDelay') }}</label>
                <input id="fishing-delay" v-model.number="draft.autoFishing.recastDelaySeconds" type="number" min="1" max="30" />
              </div>
              <div>
                <label for="fishing-timeout">{{ t('plugins.autoFishing.timeout') }}</label>
                <input id="fishing-timeout" v-model.number="draft.autoFishing.timeoutSeconds" type="number" min="10" max="180" />
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoTotem'">
            <p class="plugins-note">{{ t('plugins.autoTotem.description') }}</p>
            <div class="fields">
              <div>
                <label for="totem-priority">{{ t('plugins.autoTotem.priorityItem') }}</label>
                <select id="totem-priority" v-model="draft.autoTotem.priorityItem">
                  <option value="totem">{{ t('plugins.autoTotem.totem') }}</option>
                  <option value="shield">{{ t('plugins.autoTotem.shield') }}</option>
                </select>
              </div>
              <div>
                <label for="totem-health">{{ t('plugins.autoTotem.healthThreshold') }}</label>
                <input id="totem-health" v-model.number="draft.autoTotem.healthThreshold" type="number" min="1" max="20" />
              </div>
              <div>
                <label for="totem-interval">{{ t('plugins.autoTotem.interval') }}</label>
                <input id="totem-interval" v-model.number="draft.autoTotem.intervalSeconds" type="number" min="1" max="30" />
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoPanic'">
            <p class="plugins-note">{{ t('plugins.autoPanic.description') }}</p>
            <div class="fields">
              <div>
                <label for="panic-health">{{ t('plugins.autoPanic.healthThreshold') }}</label>
                <input id="panic-health" v-model.number="draft.autoPanic.healthThreshold" type="number" min="1" max="19" />
              </div>
              <div>
                <label for="panic-action">{{ t('plugins.autoPanic.action') }}</label>
                <select id="panic-action" v-model="draft.autoPanic.action">
                  <option value="disconnect">{{ t('plugins.autoPanic.actionDisconnect') }}</option>
                  <option value="command">{{ t('plugins.autoPanic.actionCommand') }}</option>
                </select>
              </div>
              <div v-if="draft.autoPanic.action === 'command'">
                <label for="panic-cmd">{{ t('plugins.autoPanic.panicCommand') }}</label>
                <input id="panic-cmd" v-model="draft.autoPanic.panicCommand" maxlength="128" placeholder="/spawn" />
              </div>
              <div>
                <label for="panic-radius">{{ t('plugins.autoPanic.playerRadius') }}</label>
                <input id="panic-radius" v-model.number="draft.autoPanic.playerRadius" type="number" min="3" max="32" />
              </div>
              <div>
                <label for="panic-whitelist">{{ t('plugins.autoPanic.whitelist') }}</label>
                <input id="panic-whitelist" v-model="panicWhitelistText" placeholder="Arkadas1, Arkadas2" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.autoPanic.disconnectOnPlayer" type="checkbox" /> {{ t('plugins.autoPanic.disconnectOnPlayer') }}</label>
                <label class="check-item"><input v-model="draft.autoPanic.disableReconnect" type="checkbox" /> {{ t('plugins.autoPanic.disableReconnect') }}</label>
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoDefend'">
            <p class="plugins-note">{{ t('plugins.autoDefend.description') }}</p>
            <div class="fields">
              <div>
                <label for="defend-radius">{{ t('plugins.autoDefend.radius') }}</label>
                <input id="defend-radius" v-model.number="draft.autoDefend.radius" type="number" min="2" max="6" />
              </div>
              <div>
                <label for="defend-interval">{{ t('plugins.autoDefend.attackInterval') }}</label>
                <input id="defend-interval" v-model.number="draft.autoDefend.attackIntervalMs" type="number" min="300" max="2000" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.autoDefend.autoEquipWeapon" type="checkbox" /> {{ t('plugins.autoDefend.autoEquipWeapon') }}</label>
                <label class="check-item"><input v-model="draft.autoDefend.attackCreepers" type="checkbox" /> {{ t('plugins.autoDefend.attackCreepers') }}</label>
                <label class="check-item"><input v-model="draft.autoDefend.restoreHeldItem" type="checkbox" /> {{ t('plugins.autoDefend.restoreHeldItem') }}</label>
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoLobby'">
            <p class="plugins-note">{{ t('plugins.autoLobby.description') }}</p>
            <div class="fields">
              <div>
                <label for="lobby-delay">{{ t('plugins.autoLobby.delay') }}</label>
                <input id="lobby-delay" v-model.number="draft.autoLobby.delaySeconds" type="number" min="1" max="30" />
              </div>
              <div>
                <label for="lobby-hotbar">{{ t('plugins.autoLobby.hotbarSlot') }}</label>
                <input id="lobby-hotbar" v-model.number="draft.autoLobby.hotbarSlot" type="number" min="0" max="9" />
              </div>
              <div>
                <label for="lobby-click">{{ t('plugins.autoLobby.clickSlot') }}</label>
                <input id="lobby-click" v-model.number="draft.autoLobby.clickSlot" type="number" min="-1" max="53" />
              </div>
              <div>
                <label for="lobby-keyword">{{ t('plugins.autoLobby.itemKeyword') }}</label>
                <input id="lobby-keyword" v-model="draft.autoLobby.itemKeyword" maxlength="64" placeholder="Skyblock" />
              </div>
              <div>
                <label for="lobby-post">{{ t('plugins.autoLobby.postCommand') }}</label>
                <input id="lobby-post" v-model="draft.autoLobby.postCommand" maxlength="128" placeholder="/is go" />
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoAccept'">
            <p class="plugins-note">{{ t('plugins.autoAccept.description') }}</p>
            <div class="fields">
              <div>
                <label for="accept-cmd">{{ t('plugins.autoAccept.acceptCommand') }}</label>
                <input id="accept-cmd" v-model="draft.autoAccept.acceptCommand" maxlength="128" placeholder="/tpaccept" />
              </div>
              <div>
                <label for="accept-cooldown">{{ t('plugins.autoAccept.cooldown') }}</label>
                <input id="accept-cooldown" v-model.number="draft.autoAccept.cooldownSeconds" type="number" min="1" max="60" />
              </div>
              <div>
                <label for="accept-whitelist">{{ t('plugins.autoAccept.whitelist') }}</label>
                <input id="accept-whitelist" v-model="acceptWhitelistText" placeholder="Arkadas1, Arkadas2" />
              </div>
              <div>
                <label for="accept-triggers">{{ t('plugins.autoAccept.triggers') }}</label>
                <input id="accept-triggers" v-model="acceptTriggersText" placeholder="ışınlanma isteği, tpa, teleport" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.autoAccept.onlyWhitelist" type="checkbox" /> {{ t('plugins.autoAccept.onlyWhitelist') }}</label>
              </div>
            </div>
          </template>

          <template v-else-if="moduleId === 'commandScheduler'">
            <p class="plugins-note">{{ t('plugins.commandScheduler.description') }}</p>
            <div class="rules-section">
              <div class="rules-head">
                <span>{{ t('plugins.commandScheduler.title') }} ({{ draft.commandScheduler.tasks.length }}/20)</span>
                <button type="button" class="secondary compact" :disabled="draft.commandScheduler.tasks.length >= 20" @click="emit('addScheduledTask')">
                  {{ t('plugins.commandScheduler.addTask') }}
                </button>
              </div>
              <div v-for="(task, index) in draft.commandScheduler.tasks" :key="task.id" class="rule-row">
                <label class="check-item"><input v-model="task.enabled" type="checkbox" /></label>
                <input v-model="task.command" maxlength="256" :placeholder="L('Örn: /sell all', 'e.g. /sell all')" />
                <input v-model.number="task.intervalSeconds" type="number" min="5" max="86400" :aria-label="L('Süre (sn)', 'Interval (sec)')" />
                <button type="button" class="delete-bot" :title="L('Görevi sil', 'Delete task')" :aria-label="L('Görevi sil', 'Delete task')" @click="emit('removeScheduledTask', index)"><AppIcon name="Trash2" :size="15" /></button>
              </div>
              <p v-if="!draft.commandScheduler.tasks.length" class="empty-copy">
                {{ t('plugins.commandScheduler.empty') }}
              </p>
            </div>
          </template>

          <template v-else-if="moduleId === 'autoChestDump'">
            <p class="plugins-note">{{ t('plugins.autoChestDump.description') }}</p>
            <div class="fields">
              <div>
                <label for="chest-free">{{ t('plugins.autoChestDump.freeSlotsThreshold') }}</label>
                <input id="chest-free" v-model.number="draft.autoChestDump.freeSlotsThreshold" type="number" min="1" max="18" />
              </div>
              <div>
                <label for="chest-radius">{{ t('plugins.autoChestDump.searchRadius') }}</label>
                <input id="chest-radius" v-model.number="draft.autoChestDump.searchRadius" type="number" min="2" max="5" />
              </div>
              <div>
                <label for="chest-interval">{{ t('plugins.autoChestDump.interval') }}</label>
                <input id="chest-interval" v-model.number="draft.autoChestDump.intervalSeconds" type="number" min="5" max="120" />
              </div>
              <div>
                <label for="chest-keywords">{{ t('plugins.autoChestDump.keepKeywords') }}</label>
                <input id="chest-keywords" v-model="chestKeepKeywordsText" placeholder="diamond, nether_star" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.autoChestDump.keepFoods" type="checkbox" /> {{ t('plugins.autoChestDump.keepFoods') }}</label>
                <label class="check-item"><input v-model="draft.autoChestDump.keepToolsAndArmor" type="checkbox" /> {{ t('plugins.autoChestDump.keepToolsAndArmor') }}</label>
              </div>
            </div>
          </template>

          <!-- Auto Reconnect -->
          <template v-if="moduleId === 'autoReconnect'">
            <div class="fields">
              <div>
                <label for="ar-delay">{{ L('Bekleme (sn)', 'Delay (sec)') }}</label>
                <input id="ar-delay" v-model.number="draft.autoReconnect.delaySeconds" type="number" min="2" max="120" />
              </div>
              <div>
                <label for="ar-max">{{ L('Maks. deneme (0 = sınırsız)', 'Max attempts (0 = unlimited)') }}</label>
                <input id="ar-max" v-model.number="draft.autoReconnect.maxAttempts" type="number" min="0" max="50" />
              </div>
            </div>
          </template>

          <!-- Anti-AFK -->
          <template v-else-if="moduleId === 'antiAfk'">
            <div class="fields">
              <div>
                <label for="afk-interval">{{ L('Aralık (sn)', 'Interval (sec)') }}</label>
                <input id="afk-interval" v-model.number="draft.antiAfk.intervalSeconds" type="number" min="5" max="300" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item"><input v-model="draft.antiAfk.jump" type="checkbox" /> {{ L('Zıpla', 'Jump') }}</label>
                <label class="check-item"><input v-model="draft.antiAfk.rotate" type="checkbox" /> {{ L('Bakışı döndür', 'Rotate camera') }}</label>
              </div>
            </div>
          </template>

          <!-- Auto Chat -->
          <template v-else-if="moduleId === 'autoChat'">
            <div class="fields">
              <div>
                <label for="chat-join">{{ L('Giriş mesajı (isteğe bağlı)', 'Join message (optional)') }}</label>
                <input id="chat-join" v-model="draft.autoChat.joinMessage" maxlength="256" :placeholder="L('Örn: /login sifre veya Merhaba!', 'e.g. /login password or Hello!')" />
              </div>
              <div>
                <label for="chat-cooldown">{{ L('Yanıt bekleme süresi (sn)', 'Cooldown (sec)') }}</label>
                <input id="chat-cooldown" v-model.number="draft.autoChat.cooldownSeconds" type="number" min="1" max="60" />
              </div>
            </div>
            <div class="rules-section">
              <div class="rules-head">
                <span>{{ L('Sohbet Kuralları', 'Chat Rules') }} ({{ draft.autoChat.rules.length }})</span>
                <button type="button" class="secondary compact" :disabled="draft.autoChat.rules.length >= 30" @click="emit('addRule')">
                  {{ L('+ Kural ekle', '+ Add rule') }}
                </button>
              </div>
              <div v-for="(rule, index) in draft.autoChat.rules" :key="rule.id" class="rule-row">
                <select v-model="rule.scope" :aria-label="L('Kapsam', 'Scope')">
                  <option value="all">{{ L('Tümü', 'All') }}</option>
                  <option value="chat">{{ L('Genel', 'Global') }}</option>
                  <option value="pm">{{ L('Özel (PM)', 'Private (PM)') }}</option>
                </select>
                <input v-model="rule.trigger" maxlength="128" :placeholder="L('Tetikleyici (örn: !ping)', 'Trigger (e.g. !ping)')" :aria-label="L('Tetikleyici', 'Trigger')" />
                <input v-model="rule.response" maxlength="256" :placeholder="L('Yanıt (örn: Selam {sender}!)', 'Response (e.g. Hello {sender}!)')" :aria-label="L('Yanıt', 'Response')" />
                <button type="button" class="delete-bot" :title="L('Kuralı sil', 'Delete rule')" :aria-label="L('Kuralı sil', 'Delete rule')" @click="emit('removeRule', index)"><AppIcon name="Trash2" :size="15" /></button>
              </div>
              <p v-if="!draft.autoChat.rules.length" class="empty-copy">
                {{ L('Henüz otomatik yanıt kuralı eklenmedi. Yanıtlarda {sender}, {message}, {username} kullanabilirsin.', 'No auto-response rules added yet. You can use {sender}, {message}, {username} in responses.') }}
              </p>
            </div>
          </template>

          <!-- Auto Login -->
          <template v-else-if="moduleId === 'autoLogin'">
            <p class="plugins-note">{{ t('plugins.autoLogin.description') }}</p>
            <div class="fields">
              <div>
                <label for="login-password">{{ t('plugins.autoLogin.password') }}</label>
                <div class="password-input-row">
                  <input
                    id="login-password"
                    v-model="draft.autoLogin.password"
                    :type="showPassword ? 'text' : 'password'"
                    maxlength="128"
                    autocomplete="off"
                    :placeholder="t('plugins.autoLogin.passwordPlaceholder')"
                  />
                  <button
                    type="button"
                    class="secondary compact password-toggle-btn"
                    :title="showPassword ? t('plugins.autoLogin.hidePassword') : t('plugins.autoLogin.showPassword')"
                    :aria-label="showPassword ? t('plugins.autoLogin.hidePassword') : t('plugins.autoLogin.showPassword')"
                    @click="showPassword = !showPassword"
                  >
                    <AppIcon :name="showPassword ? 'EyeOff' : 'Eye'" :size="15" />
                  </button>
                </div>
              </div>
              <div>
                <label for="login-cooldown">{{ t('plugins.autoLogin.cooldown') }}</label>
                <input id="login-cooldown" v-model.number="draft.autoLogin.cooldownSeconds" type="number" min="1" max="60" />
              </div>
              <div>
                <label for="login-cmd">{{ t('plugins.autoLogin.loginCommand') }}</label>
                <input id="login-cmd" v-model="draft.autoLogin.loginCommand" maxlength="256" placeholder="/login {password}" />
                <small>{{ t('plugins.autoLogin.commandHelp') }}</small>
              </div>
              <div>
                <label for="register-cmd">{{ t('plugins.autoLogin.registerCommand') }}</label>
                <input id="register-cmd" v-model="draft.autoLogin.registerCommand" maxlength="256" placeholder="/register {password} {password}" />
              </div>
              <div class="checkbox-stack">
                <label class="check-item">
                  <input v-model="draft.autoLogin.listenTitleActionbar" type="checkbox" />
                  {{ L('Title / Subtitle / Actionbar mesajlarını da dinle', 'Also listen to Title / Subtitle / Actionbar messages') }}
                </label>
              </div>
            </div>
            <div class="login-calibrator-wrap">
              <LoginCalibrator
                :username="username"
                :connected="connected"
                :patterns="draft.autoLogin.patterns"
                @add="rule => emit('addLoginPattern', rule)"
                @remove="id => emit('removeLoginPattern', id)"
              />
            </div>
          </template>

          <!-- Chat Calibrator -->
          <template v-else-if="moduleId === 'chatCalibrator'">
            <ChatCalibrator
              :username="username"
              :connected="connected"
              :patterns="draft.chatPatterns"
              @add="rule => emit('addPattern', rule)"
              @remove="id => emit('removePattern', id)"
            />
          </template>

          <!-- Local Script -->
          <template v-else-if="isScript">
            <div class="script-modal-info">
              <div class="script-meta-row">
                <span>{{ L('Dosya adı:', 'Filename:') }} <strong>{{ scriptFilename }}</strong></span>
                <span>{{ L('Boyut:', 'Size:') }} <strong>{{ Math.max(1, Math.round((scriptSize || 0) / 1024)) }} KB</strong></span>
              </div>
              <p class="plugins-note">
                {{ connected
                  ? L('Bot şu an bağlı: eklentiyi açıp kapattığınızda değişiklikler canlı uygulanır; dosya içeriğini düzenlediyseniz Yenile düğmesine basın.', 'Bot is currently connected: toggling scripts applies live; if you edited the file on disk, click Refresh.')
                  : L('Mineflayer (bot, ctx) veya { setup(bot, ctx) } biçimindeki dosyalar ayrı worker sürecinde çalışır.', 'Mineflayer (bot, ctx) or { setup(bot, ctx) } files execute in a separate worker process.') }}
              </p>
              <div class="script-danger-row">
                <button
                  type="button"
                  class="delete-script-btn"
                  :disabled="busy"
                  @click="emit('deleteScript', scriptFilename)"
                >
                  {{ L('Dosyayı klasörden sil', 'Delete file from folder') }}
                </button>
              </div>
            </div>
          </template>
        </div>

        <footer class="plugin-modal-foot">
          <button type="button" class="secondary" @click="emit('close')">
            {{ L('Kapat (Esc)', 'Close (Esc)') }}
          </button>
          <button
            v-if="moduleId !== 'chatCalibrator'"
            type="button"
            class="panel-connect"
            :disabled="busy"
            @click="emit('save')"
          >
            {{ L('Ayarları Kaydet', 'Save Settings') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.plugin-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 9, 18, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  padding: 20px;
}
.plugin-modal-card {
  width: min(760px, 100%);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.18);
  border-radius: var(--radius-card, 16px);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(18px);
  overflow: hidden;
}
.plugin-modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 17, 32, 0.65);
}
.plugin-modal-identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.plugin-modal-identity h3 {
  margin: 0 0 3px;
  font-size: 16px;
  color: #f1f5f9;
}
.plugin-modal-identity p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}
.plugin-modal-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.icon-edit-trigger {
  position: relative;
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}
.icon-edit-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent, #b9f477);
  color: #0f172a;
  font-size: 10px;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}
.modal-close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-control, 8px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(30, 41, 59, 0.65);
  color: #cbd5e1;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.modal-close-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #fff;
}
.icon-picker-box {
  padding: 14px 20px;
  background: rgba(11, 18, 33, 0.85);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.icon-picker-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 600;
}
.icon-preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.icon-preset-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  padding: 3px;
  border-radius: var(--radius-control, 8px);
  border: 1px solid rgba(226, 232, 240, 0.1);
  background: rgba(30, 41, 59, 0.38);
  cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
}
.icon-preset-btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(51, 65, 85, 0.55);
}
.icon-preset-btn.active {
  border-color: var(--accent, #b9f477);
  box-shadow: 0 0 0 1px var(--accent, #b9f477);
}
.plugin-modal-card :deep(.secondary), .plugin-modal-card :deep(.panel-connect), .plugin-modal-card :deep(.delete-bot) { min-height: 40px; border-radius: var(--radius-control, 8px); }
.icon-custom-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.icon-custom-row input[type="url"] {
  flex: 1;
}
.upload-icon-label {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}
.icon-error {
  margin: 0;
  font-size: 11px;
  color: #f87171;
}
.plugin-modal-body {
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.plugin-modal-card :deep(.fields > div > label:not(.check-item)) {
  display: block;
  margin-bottom: 6px;
  color: #cbd5e1;
  font-size: 12px;
}
.plugin-modal-card :deep(.fields select) {
  width: 100%;
  min-width: 0;
  padding: 12px 13px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-control, 8px);
  background: rgba(8, 14, 27, 0.78);
  color: #e6edf7;
  font: inherit;
  font-size: 13px;
}
.plugin-modal-card :deep(.fields select:focus-visible) {
  outline: 2px solid var(--accent, #b9f477);
  outline-offset: 2px;
  border-color: rgba(185, 244, 119, 0.55);
}
.plugin-modal-card :deep(.fields small) {
  display: block;
  margin-top: 6px;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.45;
}
.script-modal-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.script-meta-row {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #cbd5e1;
}
.script-danger-row {
  display: flex;
  justify-content: flex-start;
}
.delete-script-btn {
  background: rgba(239, 68, 68, 0.16);
  border: 1px solid rgba(239, 68, 68, 0.45);
  color: #fca5a5;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.delete-script-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
  color: #fff;
}
.password-input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.password-input-row input {
  flex: 1;
  min-width: 0;
}
.password-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 10px;
  flex-shrink: 0;
}
.login-calibrator-wrap {
  margin-top: 16px;
}
.plugin-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(11, 17, 32, 0.65);
}
</style>
