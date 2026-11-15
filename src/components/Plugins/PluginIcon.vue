<script setup lang="ts">
import { ref, watch } from 'vue';
import ItemIcon from '../Inventory/ItemIcon.vue';
import AppIcon from '../ui/AppIcon.vue';

const props = withDefaults(defineProps<{ icon?: string; size?: number }>(), {
  icon: 'Plug',
  size: 40,
});

const imgFailed = ref(false);
watch(() => props.icon, () => { imgFailed.value = false; });
const lucideName = (value: string) => value.startsWith('icon:') ? value.slice(5) : value;
const LUCIDE_NAMES = new Set(['Plug', 'Code', 'Settings', 'RefreshCw', 'Footprints', 'MessageSquare', 'Target', 'BookOpen', 'Drumstick', 'Swords', 'Shield', 'Zap', 'Bot', 'Info', 'ScanLine']);
const isLucide = (value: string) => value.startsWith('icon:') || LUCIDE_NAMES.has(value);
</script>

<template>
  <div class="plugin-icon-frame" :style="{ width: `${size}px`, height: `${size}px` }">
    <ItemIcon
      v-if="icon.startsWith('item:')"
      :item="{ name: icon.slice(5), displayName: '', count: 1 }"
    />
    <AppIcon
      v-else-if="isLucide(icon) || imgFailed || !icon"
      :name="imgFailed || !icon ? 'Plug' : lucideName(icon)"
      :size="Math.round(size * 0.56)"
      :stroke-width="1.75"
      class="plugin-svg-icon"
    />
    <img
      v-else-if="(icon.startsWith('data:image/') || icon.startsWith('https://')) && !imgFailed"
      :src="icon"
      class="plugin-custom-img"
      alt=""
      @error="imgFailed = true"
    />
    <span v-else class="plugin-emoji-icon" :style="{ fontSize: `${Math.round(size * 0.56)}px` }">
      {{ icon }}
    </span>
  </div>
</template>

<style scoped>
.plugin-icon-frame {
  display: grid;
  place-items: center;
  border-radius: var(--radius-group, 12px);
  background: rgba(30, 41, 59, 0.58);
  border: 1px solid rgba(226, 232, 240, 0.14);
  padding: 5px;
  flex-shrink: 0;
  overflow: hidden;
}
.plugin-custom-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 6px;
}
.plugin-emoji-icon {
  line-height: 1;
  user-select: none;
}
.plugin-svg-icon { color: #d7e1ee; }
</style>
