<script setup lang="ts">
import { computed } from 'vue';
import type { InventoryItem } from '../../types/bot';
import ItemIcon from './ItemIcon.vue';
import { useI18n } from '../../i18n';

const props = defineProps<{
  slot: number;
  item?: InventoryItem;
  label: string;
  placeholder?: 'helmet' | 'chestplate' | 'leggings' | 'boots' | 'shield';
  selected?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{ click: [event: MouseEvent]; hover: [slot: number]; leave: [] }>();

const { L } = useI18n();

const placeholderImage = computed(() =>
  props.placeholder ? `${import.meta.env.BASE_URL}textures/item/empty_armor_slot_${props.placeholder}.png` : ''
);
</script>

<template>
  <button
    type="button"
    class="mc-slot"
    :class="{ chosen: selected, 'has-custom-name': Boolean(item?.customName) }"
    :disabled="disabled"
    :aria-label="`${label}: ${item ? `${item.customName || item.displayName}, ${item.count}` : L('boş', 'empty')}`"
    @click="emit('click', $event)"
    @contextmenu.prevent="emit('click', $event)"
    @mouseenter="emit('hover', slot)"
    @mouseleave="emit('leave')"
    @focus="emit('hover', slot)"
    @blur="emit('leave')"
  >
    <template v-if="item">
      <ItemIcon :item="item" />
      <b v-if="item.count > 1">{{ item.count }}</b>
      <!-- Subtle indicator for items with custom names in menus -->
      <span v-if="item.customName" class="slot-name-badge" aria-hidden="true">★</span>
    </template>
    <img v-else-if="placeholderImage" class="slot-placeholder" :src="placeholderImage" alt="" />
  </button>
</template>
