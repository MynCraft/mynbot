<script setup lang="ts">
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
import AppIcon from '../ui/AppIcon.vue';
import BotListItem from './Item.vue';
const store = useBotStore();
const { L } = useI18n();
defineProps<{ triggerError?: (message: string) => void }>();
</script>
<template>
  <div class="bot-list">
    <div v-if="!store.bots.length" class="empty-state">
      <span class="empty-glyph"><AppIcon name="Plus" :size="22" /></span>
      <h3>{{ L('İlk botuna merhaba de.', 'Say hello to your first bot.') }}</h3>
      <p>{{ L('Yukarıya bir isim yazıp ekle.', 'Type a name above and add it.') }}<br>{{ L('Kontrol paneli bir tık uzağında.', 'The control panel is one click away.') }}</p>
    </div>
    <BotListItem v-for="bot in store.bots" :key="bot.username" :username="bot.username" :is-open="store.openWindows.includes(bot.username)" :trig-error="triggerError" />
  </div>
</template>
