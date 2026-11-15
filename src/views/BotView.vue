<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import AppIcon from '../components/ui/AppIcon.vue';
import IsoWorldView from '../components/World/IsoWorldView.vue';
import ContainerModal from '../components/Inventory/ContainerModal.vue';
import PluginsPanel from '../components/Plugins/PluginsPanel.vue';
import type { InventoryAction, InventoryItem } from '../types/bot';
import { useBotStore } from '../store/botStore';
import { useI18n } from '../i18n';
import { useMinecraftMusic, nextMusicTrack } from '../utils/minecraftMusic';

const api = window.electronAPI;
const props = defineProps<{ username: string }>();
const store = useBotStore();
const { locale, toggleLocale, L, t } = useI18n();
const {
  musicPlaying,
  toggleMusic,
  initMusicAutoStart,
  musicCatalogState,
  currentTrackName,
} = useMinecraftMusic();

const error = ref('');
const busy = ref(false);

type TabKey = 'overview' | 'chat' | 'world' | 'plugins';
const tab = ref<TabKey>('overview');

const host = ref('');
const port = ref(25565);
const version = ref('');
const message = ref('');
const chatOutput = ref<HTMLElement | null>(null);
const followChat = ref(true);

function trackChatScroll() {
  const el = chatOutput.value;
  if (el) followChat.value = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
}

const bot = computed(() => store.bots.find(item => item.username === props.username));
const status = computed(() => store.statuses[props.username] || { state: 'disconnected' as const });
const data = computed(() => store.data[props.username] || { inventory: [], cursor: null, slotCount: 0, selectedSlot: 0, chat: [], logs: [] });
const running = computed(() => status.value.state === 'connected' || status.value.state === 'connecting');

const statusLabel = computed(() => {
  switch (status.value.state) {
    case 'connected': return L('Çevrimiçi', 'Online');
    case 'connecting': return L('Bağlanıyor', 'Connecting');
    case 'error': return L('Bağlantı hatası', 'Connection error');
    default: return L('Çevrimdışı', 'Offline');
  }
});

watch(() => data.value.chat.length, async () => {
  if (!followChat.value) return;
  await nextTick();
  if (chatOutput.value) chatOutput.value.scrollTop = chatOutput.value.scrollHeight;
});

const images = Object.keys(import.meta.glob(['/public/wallpapers/*.jpg', '/public/wallpapers/*.jpeg', '/public/wallpapers/*.png', '/public/wallpapers/*.webp', '/public/wallpapers/*.avif']))
  .filter(path => /\.(png|jpe?g|webp|avif)$/i.test(path))
  .map(path => `${import.meta.env.BASE_URL}wallpapers/${encodeURIComponent(path.split('/').pop()!)}`);
const wallpaper = ref('');
const nextWallpaper = ref('');
const wallpaperBusy = ref(false);
let imageToken = 0;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;

function changeWallpaper() {
  if (wallpaperBusy.value) return;
  const candidates = images.filter(path => path !== wallpaper.value);
  if (!candidates.length) return;
  wallpaperBusy.value = true;
  const token = ++imageToken;
  const tryNext = () => {
    if (token !== imageToken) return;
    if (!candidates.length) {
      wallpaperBusy.value = false;
      error.value = L('Arka plan görseli yüklenemedi.', 'Failed to load wallpaper.');
      return;
    }
    const index = Math.floor(Math.random() * candidates.length);
    const [url] = candidates.splice(index, 1);
    const img = new Image();
    img.onload = () => {
      if (token !== imageToken) return;
      nextWallpaper.value = url;
      fadeTimer = setTimeout(() => {
        if (token !== imageToken) return;
        wallpaper.value = url;
        nextWallpaper.value = '';
        wallpaperBusy.value = false;
      }, 650);
    };
    img.onerror = tryNext;
    img.src = url;
  };
  tryNext();
}

// Modal state
const inventoryModalOpen = ref(false);
const isModalOpen = computed(() => inventoryModalOpen.value || Boolean(data.value.openWindow));

async function closeInventoryModal() {
  inventoryModalOpen.value = false;
  if (data.value.openWindow || data.value.cursor) {
    try {
      await api.closeContainer(props.username);
    } catch (err) {
      error.value = String(err);
    }
  }
}

// Inventory actions
const hoveredSlot = ref<number | null>(null);
const heldQ = ref(false);
const heldCtrl = ref(false);
let dropTimer: ReturnType<typeof setInterval> | undefined;
let dropBusy = false;

function stopDrop() {
  heldQ.value = false;
  heldCtrl.value = false;
  if (dropTimer) clearInterval(dropTimer);
  dropTimer = undefined;
}

function getItem(slot: number): InventoryItem | undefined {
  if (data.value.openWindow) {
    return data.value.openWindow.slots.find(i => i.slot === slot);
  }
  return data.value.inventory.find(i => i.slot === slot);
}

async function inventoryAction(action: InventoryAction) {
  try {
    error.value = '';
    await api.clickInventory(props.username, action);
  } catch (err) {
    error.value = String(err);
  }
}

function clickSlot(slot: number, event: MouseEvent) {
  if (status.value.state !== 'connected') return;
  const button = event.button === 2 ? 1 : 0;
  void inventoryAction({ slot, button, mode: event.shiftKey ? 1 : 0 });
}

async function dropHovered(all: boolean) {
  const slot = hoveredSlot.value;
  if (dropBusy || slot === null || !getItem(slot) || status.value.state !== 'connected') return;
  dropBusy = true;
  try {
    await inventoryAction({ slot, button: all ? 1 : 0, mode: 4 });
  } finally {
    dropBusy = false;
  }
}

async function selectHotbar(slot: number) {
  try {
    error.value = '';
    await api.selectSlot(props.username, slot);
  } catch (err) {
    error.value = String(err);
  }
}

async function renameAnvil(name: string) {
  try {
    error.value = '';
    await api.renameAnvil(props.username, name);
  } catch (err) {
    error.value = String(err);
  }
}

function keyDown(event: KeyboardEvent) {
  heldCtrl.value = event.ctrlKey;
  const target = event.target as HTMLElement | null;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')) return;

  // Toggle inventory modal with 'E'
  if (event.key.toLowerCase() === 'e' && !event.altKey && !event.metaKey) {
    event.preventDefault();
    if (isModalOpen.value) {
      void closeInventoryModal();
    } else if (running.value) {
      inventoryModalOpen.value = true;
    }
    return;
  }

  // Close modal with 'Escape'
  if (event.key === 'Escape') {
    if (isModalOpen.value) {
      event.preventDefault();
      void closeInventoryModal();
      return;
    }
  }

  // Drop hovered item with 'Q' or 'Ctrl+Q' when modal is open
  if (isModalOpen.value && event.key.toLowerCase() === 'q' && !event.altKey && !event.metaKey) {
    event.preventDefault();
    if (heldQ.value) return;
    heldQ.value = true;
    void dropHovered(heldCtrl.value);
    dropTimer = setInterval(() => { if (heldQ.value) void dropHovered(heldCtrl.value); }, 175);
  }
}

function keyUp(event: KeyboardEvent) {
  heldCtrl.value = event.ctrlKey;
  if (event.key.toLowerCase() === 'q') stopDrop();
}

watch(tab, async value => {
  stopDrop();
  hoveredSlot.value = null;
  if (value === 'chat' && followChat.value) {
    await nextTick();
    if (chatOutput.value) chatOutput.value.scrollTop = chatOutput.value.scrollHeight;
  }
});

watch(() => status.value.state, state => { if (state !== 'connected') stopDrop(); });

onMounted(async () => {
  initMusicAutoStart();
  changeWallpaper();
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', stopDrop);
  unsubscribe = api.onChange(() => { void store.refresh(); });
  await store.refresh();
  if (bot.value) {
    host.value = bot.value.host;
    port.value = bot.value.port;
    version.value = bot.value.version || '';
  }
});

onUnmounted(() => {
  unsubscribe?.();
  stopDrop();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('blur', stopDrop);
  imageToken++;
  if (fadeTimer) clearTimeout(fadeTimer);
});

async function act(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  try {
    error.value = '';
    await action();
  } catch (err) {
    error.value = String(err);
  } finally {
    busy.value = false;
  }
}

async function save() {
  await api.updateBot({ username: props.username, host: host.value.trim(), port: Number(port.value), version: version.value.trim() || undefined });
  await store.refresh();
}

async function connect() { await save(); await api.connect(props.username); }
async function send() { const text = message.value; await api.sendChat(props.username, text); message.value = ''; }

async function downloadPack() {
  const packs = data.value.resourcePacks;
  if (!packs?.length) return;
  const saved = await api.downloadResourcePack(packs[packs.length - 1], `${props.username}-resourcepack.zip`);
  if (saved) noticeText.value = `${L('Resource pack kaydedildi:', 'Resource pack saved:')} ${saved}`;
}

const noticeText = ref('');

function logTone(line: string): 'log-error' | 'log-warn' | 'log-ok' | '' {
  const lower = line.toLowerCase();
  if (/(hata|atıldı|socketclosed|enotfound|econn|etimedout|başarısız|durduruldu|error|kicked|timed out)/i.test(lower)) return 'log-error';
  if (/(bağlanıyor|yeniden bağlanma|kapatıldı|uyarı|disconnected|timeout)/i.test(lower)) return 'log-warn';
  if (/(bağlantı kuruldu|eklenti yüklendi|gönderildi|kaydedildi|başarılı|connected)/i.test(lower)) return 'log-ok';
  return '';
}
</script>

<template>
  <main class="panel-shell">
    <div class="wallpaper" :style="{ backgroundImage: wallpaper ? `url('${wallpaper}')` : '' }"></div>
    <div class="wallpaper wallpaper-next" :class="{ visible: nextWallpaper }" :style="{ backgroundImage: nextWallpaper ? `url('${nextWallpaper}')` : '' }"></div>
    <div class="panel-shade"></div>

    <header class="titlebar">
      <span class="wordmark"><span class="brand-mark">M</span> myncraft</span>
      <span class="title-caption">{{ L('BOT KONTROL PANELİ', 'BOT CONTROL PANEL') }}</span>
      <button class="window-close" :aria-label="L('Pencereyi kapat', 'Close window')" @click="api.closeWindow()"><AppIcon name="X" :size="18" /></button>
    </header>

    <div class="panel-layout">
      <aside class="sidebar">
        <div class="side-identity">
          <span class="bot-avatar large">{{ username.slice(0, 2).toUpperCase() }}</span>
          <strong>{{ username }}</strong>
          <span class="side-status"><span class="dot active"></span> {{ L('Panel açık', 'Panel open') }}</span>
        </div>
        <nav aria-label="Bot menüsü">
          <button
            :class="{ selected: tab === 'overview' }"
            @click="tab = 'overview'"
          >
            <AppIcon name="LayoutDashboard" /> {{ L('Genel bakış', 'Overview') }}
          </button>
          <button
            :class="{ selected: tab === 'chat' }"
            @click="tab = 'chat'"
          >
            <AppIcon name="MessageSquare" /> {{ L('Canlı sohbet', 'Live Chat') }}
          </button>
          <button
            :class="{ selected: tab === 'world' }"
            @click="tab = 'world'"
          >
            <AppIcon name="Map" /> {{ L('Dünya & Envanter', 'World & Inventory') }}
          </button>
        </nav>
        <button
          class="plugins-link"
          :class="{ selected: tab === 'plugins' }"
          @click="tab = 'plugins'"
        >
          <AppIcon name="Plug" /> {{ L('Eklentiler', 'Plugins') }}
        </button>
        <button class="back-link" @click="api.closeWindow()"><AppIcon name="ArrowLeft" /> {{ L('Botlarına dön', 'Back to bots') }}</button>
        <small>{{ L('ÇEVRİMDIŞI HESAP', 'OFFLINE ACCOUNT') }}</small>
      </aside>

      <section class="panel-content">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">{{ L('BOT KONTROL PANELİ', 'BOT CONTROL PANEL') }}</span>
            <h1>{{ username }}</h1>
          </div>
          <div class="heading-actions bottom-controls-row">
            <div class="tool-group">
            <!-- 1-Click Inventory Popup Button from any tab -->
            <button
              type="button"
              class="inventory-quick-btn"
              :title="L('Envanteri aç (E)', 'Open inventory (E)')"
              :disabled="!running"
              @click="inventoryModalOpen = !inventoryModalOpen"
            >
              <AppIcon name="Backpack" /> {{ L('Envanter (E)', 'Inventory (E)') }}
            </button>
            <button
              class="wallpaper-button"
              :aria-label="L('Arka planı değiştir', 'Change wallpaper')"
              :title="L('Arka planı değiştir · Görsel kaynakları: wallpapers/CREDITS.md (MinePix)', 'Change wallpaper · Credits: wallpapers/CREDITS.md (MinePix)')"
              :disabled="wallpaperBusy"
              @click="changeWallpaper"
            >
              <AppIcon name="RefreshCw" />
            </button>
            <!-- Ambient Minecraft Music Button -->
            <button
              type="button"
              class="music-button"
              :class="{ playing: musicPlaying }"
              :aria-label="musicPlaying ? L('Müziği kapat', 'Mute music') : L('Müziği aç', 'Play music')"
              :title="musicPlaying ? L(`Çalıyor: ${currentTrackName} (Kapatmak için sol tık, parça değiştirmek için sağ tık)`, `Playing: ${currentTrackName} (Left click: mute, Right click: next track)`) : L('Minecraft müziklerini aç', 'Play Minecraft ambient music')"
              @click="toggleMusic()"
              @contextmenu.prevent="nextMusicTrack()"
            >
              <AppIcon :name="musicPlaying ? 'Volume2' : 'VolumeX'" />
              <span v-if="musicPlaying" class="music-track-tag">{{ currentTrackName }}</span>
              <span v-else>{{ L('Sessiz', 'Muted') }}</span>
              <span
                v-if="musicCatalogState.totalCount > 0 && musicCatalogState.downloadedCount < musicCatalogState.totalCount"
                class="music-dl-tag"
                :title="`${t('music.downloading')}: ${musicCatalogState.downloadedCount}/${musicCatalogState.totalCount}`"
              >
                ({{ musicCatalogState.downloadedCount }}/{{ musicCatalogState.totalCount }})
              </span>
            </button>
            <button
              type="button"
              class="bg-toggle-btn icon-only-btn"
              :title="`${t('controls.nextMusic')}: ${currentTrackName}`"
              :aria-label="t('controls.nextMusic')"
              @click="nextMusicTrack"
            >
              <AppIcon name="SkipForward" />
            </button>
            <!-- Language Switch Button -->
            <button
              type="button"
              class="lang-button"
              :title="L('Dili İngilizce yap (EN)', 'Switch language to Turkish (TR)')"
              @click="toggleLocale()"
            >
              <AppIcon name="Globe" /> {{ locale.toUpperCase() }}
            </button>
            </div>
            <div class="connection-actions">
            <!-- Connect / Disconnect Buttons -->
            <button
              v-if="running"
              class="panel-disconnect"
              :disabled="busy"
              @click="act(() => api.disconnect(username))"
            >
              <AppIcon name="LogOut" /> {{ L('Bağlantıyı kes', 'Disconnect') }}
            </button>
            <button
              v-else
              class="panel-connect"
              :disabled="busy || !bot"
              @click="act(connect)"
            >
              <AppIcon name="LogIn" /> {{ L('Bağlan', 'Connect') }}
            </button>
            </div>
          </div>
        </div>

        <p v-if="error || store.error || status.message" class="notice" role="alert">
          {{ error || store.error || status.message }}
        </p>

        <!-- Tab 1: Genel bakış / Overview -->
        <div v-if="tab === 'overview'" class="panel-page">
          <div class="summary-card">
            <div>
              <small>{{ L('BAĞLANTI', 'CONNECTION') }}</small>
              <strong :class="{ lime: status.state === 'connected' }">{{ statusLabel }}</strong>
            </div>
            <div>
              <small>{{ L('SUNUCU', 'SERVER') }}</small>
              <strong>{{ host.trim() || bot?.host || '—' }}:{{ port || bot?.port || '—' }}</strong>
            </div>
            <div>
              <small>{{ L('MINECRAFT', 'MINECRAFT') }}</small>
              <strong>{{ version.trim() || bot?.version || L('Otomatik', 'Auto') }} · Java</strong>
            </div>
          </div>
          <div class="dashboard-grid">
            <form class="panel-card overview-card" @submit.prevent="act(save)">
              <h2>{{ L('Sunucu bilgileri', 'Server Information') }}</h2>
              <p>{{ L('Adres ve portu girip doğrudan bağlanabilirsin.', 'Enter address and port to connect directly.') }}</p>
              <fieldset :disabled="running || busy">
                <label for="server-host">{{ L('Sunucu adresi', 'Server address') }}</label>
                <input id="server-host" v-model="host" required autocomplete="off" placeholder="localhost veya play.sunucu.com" />
                <div class="fields">
                  <div>
                    <label for="server-port">{{ L('Port', 'Port') }}</label>
                    <input id="server-port" v-model.number="port" type="number" min="1" max="65535" required />
                  </div>
                  <div>
                    <label for="server-version">{{ L('Sürüm', 'Version') }}</label>
                    <input id="server-version" v-model="version" :placeholder="L('Otomatik', 'Auto')" />
                  </div>
                </div>
              </fieldset>
              <p v-if="running" class="overview-hint">{{ L('Ayarları değiştirmek için önce bağlantıyı kes.', 'Disconnect first to change settings.') }}</p>
              <button class="secondary" :disabled="running || busy">{{ L('Kaydet', 'Save') }}</button>
            </form>
            <div class="panel-card console-card">
              <div class="card-title">
                <h2>{{ L('Teknik konsol', 'Technical Console') }}</h2>
                <span class="live-label">
                  <span class="dot" :class="{ active: running }"></span>
                  {{ running ? L('CANLI', 'LIVE') : L('KAPALI', 'OFFLINE') }}
                </span>
              </div>
              <div class="console-output" aria-live="polite">
                <p v-for="(line, i) in data.logs" :key="i" :class="logTone(line)">{{ line }}</p>
                <p v-if="!data.logs.length" class="empty-copy">{{ L('Henüz bağlantı kaydı yok.', 'No connection logs yet.') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Canlı sohbet / Live Chat -->
        <div v-else-if="tab === 'chat'" class="panel-card chat-card">
          <div class="card-title">
            <h2>{{ L('Canlı sohbet', 'Live Chat') }}</h2>
            <div class="chat-head-actions">
              <button
                v-if="data.resourcePacks?.length"
                type="button"
                class="secondary compact"
                :disabled="busy"
                @click="act(downloadPack)"
              >
                {{ L('Resource Pack İndir (.zip)', 'Download Resource Pack (.zip)') }}
              </button>
              <span class="live-label">
                <span class="dot" :class="{ active: status.state === 'connected' }"></span>
                {{ statusLabel }}
              </span>
            </div>
          </div>
          <p v-if="noticeText" class="plugins-saved">{{ noticeText }}</p>
          <div ref="chatOutput" class="console-output chat-output mc-chat-output" aria-live="polite" @scroll="trackChatScroll">
            <p v-for="(entry, i) in data.chat" :key="i" class="mc-chat-line">
              <template v-if="entry.segments?.length">
                <span
                  v-for="(seg, j) in entry.segments"
                  :key="j"
                  :style="{
                    color: seg.color || '#ffffff',
                    fontWeight: seg.bold ? 'bold' : undefined,
                    fontStyle: seg.italic ? 'italic' : undefined,
                    textDecoration: [seg.underlined ? 'underline' : '', seg.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined
                  }"
                >
                  {{ seg.text }}
                </span>
              </template>
              <template v-else>{{ entry.text }}</template>
            </p>
            <p v-if="!data.chat.length" class="empty-copy">{{ L('Henüz sohbet mesajı yok.', 'No chat messages yet.') }}</p>
          </div>
          <form class="chat-form" @submit.prevent="act(send)">
            <label for="chat-message" class="sr-only">{{ L('Mesaj veya komut', 'Message or command') }}</label>
            <input
              id="chat-message"
              v-model="message"
              maxlength="256"
              :placeholder="L('Mesaj veya /komut yaz...', 'Type message or /command...')"
              :disabled="status.state !== 'connected'"
            />
            <button class="panel-connect" :disabled="status.state !== 'connected' || !message.trim() || busy">
              {{ L('Gönder', 'Send') }} <AppIcon name="ArrowUpRight" />
            </button>
          </form>
        </div>

        <!-- Tab 3: Dünya & Envanter / World & Inventory -->
        <div v-else-if="tab === 'world'" class="panel-page world-page">
          <IsoWorldView
            :username="username"
            :connected="status.state === 'connected'"
            :data="data"
            :modal-open="isModalOpen"
            @open-inventory="inventoryModalOpen = true"
            @error="error = $event"
          />
        </div>

        <!-- Tab 4: Plugins Panel -->
        <PluginsPanel v-else :username="username" :connected="status.state === 'connected'" @error="error = $event" />

        <footer class="panel-footer">
          <span>{{ L('Paneli kapattığında botun bağlantısı kesilir.', 'Closing the panel will disconnect the bot.') }}</span>
          <span>MYNCRAFT / 01</span>
        </footer>
      </section>
    </div>

    <!-- Container / Chest / Anvil / Player Inventory Popup Modal -->
    <ContainerModal
      :open="isModalOpen"
      :username="username"
      :connected="status.state === 'connected'"
      :data="data"
      @close="closeInventoryModal"
      @click-slot="clickSlot"
      @hover-slot="hoveredSlot = $event"
      @select-hotbar="selectHotbar"
      @rename-anvil="renameAnvil"
    />
  </main>
</template>

<style scoped>
.bg-toggle-btn.icon-only-btn {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(20, 31, 52, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #e6edf7;
  font-size: 13px;
  padding: 8px 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s;
  cursor: pointer;
  -webkit-app-region: no-drag;
  user-select: none;
}
.bg-toggle-btn.icon-only-btn:hover {
  background: rgba(28, 44, 72, 0.85);
  border-color: rgba(255, 255, 255, 0.32);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
.bg-toggle-btn.icon-only-btn:active {
  transform: translateY(0);
}
.music-track-tag {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}
.music-dl-tag {
  font-size: 11px;
  opacity: 0.8;
  margin-left: 2px;
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}
</style>
