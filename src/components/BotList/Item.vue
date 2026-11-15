<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue';
import { ref } from 'vue';
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
const api = window.electronAPI;
const props = defineProps<{ username: string; isOpen: boolean; trigError?: (message: string) => void }>();
const store = useBotStore();
const { L } = useI18n();
const busy = ref(false);
async function act(action: () => Promise<void>) { if (busy.value) return; busy.value = true; try { await action(); } catch (error) { props.trigError?.(String(error)); } finally { busy.value = false; } }
</script>
<template>
  <div class="bot-item" :class="{ 'is-open': isOpen }">
    <button class="bot-open" :disabled="busy" @click="act(() => api.openBotWindow(username))">
      <span class="bot-avatar" aria-hidden="true">{{ username.slice(0, 2).toUpperCase() }}</span>
      <span class="bot-identity">
        <strong>{{ username }}</strong>
        <small>{{ isOpen ? L('Panele dön', 'Return to panel') : L('Yönetim panelini aç', 'Open control panel') }}</small>
      </span>
    </button>
    <button class="delete-bot" :disabled="isOpen || busy" :aria-label="L(`${username} botunu sil`, `Delete bot ${username}`)" :title="isOpen ? L('Silmek için önce paneli kapat', 'Close panel first to delete') : L('Botu sil', 'Delete bot')" @click="act(() => store.deleteBot(username))"><AppIcon name="Trash2" /></button>
    <span class="dot bot-indicator" :class="{ active: isOpen }" role="img" :aria-label="isOpen ? L('Aktif', 'Active') : L('Kapalı', 'Closed')" :title="isOpen ? L('Panel açık', 'Panel open') : L('Panel kapalı', 'Panel closed')"></span>
  </div>
</template>
