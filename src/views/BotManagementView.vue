<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useBotStore } from '../store/botStore';
import BotList from '../components/BotList/Container.vue';
import AppIcon from '../components/ui/AppIcon.vue';
import { useI18n } from '../i18n';

const api = window.electronAPI;
const store = useBotStore();
const { locale, toggleLocale, L } = useI18n();

const username = ref('');
const message = ref('');
const saving = ref(false);
const active = computed(() => store.openWindows.length);
let unsubscribe: (() => void) | undefined;

onMounted(() => {
  unsubscribe = api.onChange(() => { void store.refresh(); });
  void store.refresh();
});

onUnmounted(() => unsubscribe?.());

async function add() {
  if (saving.value) return;
  saving.value = true;
  try {
    message.value = '';
    await store.addBot({ username: username.value.trim(), host: 'localhost', port: 25565 });
    username.value = '';
  } catch (error) {
    message.value = String(error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="launcher">
    <header class="titlebar">
      <span class="wordmark"><span class="brand-mark">M</span> myn<span>craft</span></span>
      <div class="titlebar-actions">
        <!-- Language Switch Button -->
        <button
          type="button"
          class="lang-button titlebar-lang"
          :title="L('Dili İngilizce yap (EN)', 'Switch language to Turkish (TR)')"
          @click="toggleLocale()"
        >
          <AppIcon name="Globe" /> {{ locale.toUpperCase() }}
        </button>
        <button class="window-close" :aria-label="L('Pencereyi kapat', 'Close window')" @click="api.closeWindow()"><AppIcon name="X" :size="18" /></button>
      </div>
    </header>
    <section class="launcher-body">
      <div class="intro">
        <span class="eyebrow">{{ L('KENDİ DÜNYANI YÖNET', 'MANAGE YOUR WORLD') }}</span>
        <h1>{{ L('Dünyan burada', 'Your world begins') }}<br>{{ L('başlıyor.', 'here.') }}</h1>
        <p>{{ L('Yüksek performanslı Minecraft bot kontrol merkezi. Botlarını ekle, dünyana bağlan.', 'High-performance Minecraft bot control center. Add your bots, connect to your world.') }}</p>
      </div>
      <section class="collection">
        <div class="section-heading">
          <h2>{{ L('Bot koleksiyonu', 'Bot Collection') }} <span class="count">{{ store.bots.length }}</span></h2>
          <span class="live-label">
            <span class="dot" :class="{ active: active > 0 }"></span>
            {{ active }} {{ L('aktif', 'active') }}
          </span>
        </div>
        <form class="quick-add" @submit.prevent="add">
          <label class="sr-only" for="bot-name">{{ L('Bot adı', 'Bot name') }}</label>
          <input
            id="bot-name"
            v-model="username"
            required
            pattern="[a-zA-Z0-9_]{3,16}"
            minlength="3"
            maxlength="16"
            autocomplete="off"
            :placeholder="L('Yeni botun adı', 'New bot name')"
            :title="L('3–16 harf, rakam veya alt çizgi', '3–16 letters, numbers or underscore')"
          />
          <button type="submit" :disabled="saving" :aria-label="L('Bot ekle', 'Add bot')">
            <AppIcon name="Plus" /> {{ saving ? L('Ekleniyor...', 'Adding...') : L('Bot ekle', 'Add Bot') }}
          </button>
        </form>
        <p class="input-hint">{{ L('Bir isimle başla, sunucuyu panelinden seç.', 'Start with a name, configure server in bot panel.') }}</p>
        <BotList :trigger-error="text => message = text" />
        <p v-if="message || store.error" class="notice" role="alert">{{ message || store.error }}</p>
      </section>
      <footer class="launcher-footer">
        <span>MYNCRAFT <span class="version">/ 01</span></span>
        <span>{{ L('Senin botların. Senin dünyan.', 'Your bots. Your world.') }}</span>
      </footer>
    </section>
  </main>
</template>
