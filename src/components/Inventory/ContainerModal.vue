<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BotData, InventoryItem } from '../../types/bot';
import InventorySlot from './Slot.vue';
import ItemIcon from './ItemIcon.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../i18n';

const props = defineProps<{
  username: string;
  connected: boolean;
  data: BotData;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'clickSlot', slot: number, event: MouseEvent): void;
  (e: 'hoverSlot', slot: number | null): void;
  (e: 'selectHotbar', slot: number): void;
  (e: 'renameAnvil', name: string): void;
}>();

const { L } = useI18n();

const pointer = ref({ x: 0, y: 0 });
function onMouseMove(event: MouseEvent) {
  pointer.value = { x: event.clientX, y: event.clientY };
}

const hoveredSlot = ref<number | null>(null);
function onSlotHover(slot: number) {
  hoveredSlot.value = slot;
  emit('hoverSlot', slot);
}
function onSlotLeave() {
  hoveredSlot.value = null;
  emit('hoverSlot', null);
}

function getItem(slot: number): InventoryItem | undefined {
  if (props.data.openWindow) {
    return props.data.openWindow.slots.find(item => item.slot === slot);
  }
  return props.data.inventory.find(item => item.slot === slot);
}

const hoveredItem = computed(() => {
  if (hoveredSlot.value === null) return null;
  return getItem(hoveredSlot.value) ?? null;
});

const heldItem = computed(() => {
  return props.data.inventory.find(item => item.slot === props.data.selectedSlot + 36) ?? null;
});

const isAnvil = computed(() => {
  const win = props.data.openWindow;
  if (!win) return false;
  return /anvil/i.test(win.type) || /örs/i.test(win.title) || win.containerSlotCount === 3;
});

const anvilName = ref('');
watch(
  () => props.data.openWindow?.id,
  () => {
    if (isAnvil.value) {
      const inputItem = getItem(0);
      anvilName.value = inputItem?.displayName || '';
    } else {
      anvilName.value = '';
    }
  },
  { immediate: true }
);

function applyAnvilRename() {
  emit('renameAnvil', anvilName.value);
}

function onBackdropClick(event: MouseEvent) {
  if (props.data.cursor) {
    emit('clickSlot', -999, event);
  } else {
    emit('close');
  }
}

// Tooltip position clamped to screen bounds
const tooltipStyle = computed(() => {
  if (hoveredSlot.value === null || !hoveredItem.value) return {};
  const x = Math.min(window.innerWidth - 300, Math.max(10, pointer.value.x + 16));
  const y = Math.min(window.innerHeight - 220, Math.max(10, pointer.value.y + 12));
  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});
</script>

<template>
  <div
    v-if="open"
    class="inv-modal-backdrop"
    @mousemove="onMouseMove"
    @click.self="onBackdropClick"
    @contextmenu.self.prevent="onBackdropClick"
  >
    <div class="inv-modal-card" @click.stop>
      <!-- Modal Header Bar -->
      <header class="inv-modal-head">
        <div class="inv-head-title">
          <template v-if="data.openWindow">
            <span class="inv-type-badge">{{ isAnvil ? L('ÖRS', 'ANVIL') : (data.openWindow.type || L('KONTEYNER', 'CONTAINER')).toUpperCase() }}</span>
            <h2 v-if="data.openWindow.titleSegments?.length">
              <span
                v-for="(seg, sIdx) in data.openWindow.titleSegments"
                :key="sIdx"
                :style="{
                  color: (seg.color === '#000000' || seg.color?.toLowerCase() === 'black' || seg.color === '#000') ? '#e2e8f0' : (seg.color || '#e2e8f0'),
                  fontWeight: seg.bold ? 'bold' : 'normal',
                  fontStyle: seg.italic ? 'italic' : 'normal',
                  textDecoration: [seg.underlined ? 'underline' : '', seg.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined
                }"
              >{{ seg.text }}</span>
            </h2>
            <h2 v-else>{{ data.openWindow.title || (isAnvil ? L('Örs', 'Anvil') : L('Konteyner', 'Container')) }}</h2>
            <span class="count">{{ data.openWindow.containerSlotCount }} {{ L('yuva', 'slots') }}</span>
          </template>
          <template v-else>
            <span class="inv-type-badge">{{ L('ENVANTER', 'INVENTORY') }}</span>
            <h2>{{ L('Oyuncu Envanteri', 'Player Inventory') }}</h2>
            <span v-if="hoveredItem" class="inv-head-info">
              {{ hoveredItem.customName || hoveredItem.displayName }} × {{ hoveredItem.count }}
            </span>
            <span v-else-if="heldItem" class="inv-head-info muted">
              {{ L('Eldeki:', 'Held:') }} {{ heldItem.customName || heldItem.displayName }} × {{ heldItem.count }}
            </span>
            <span v-else class="inv-head-info muted">{{ L('Eldeki: Boş', 'Held: Empty') }}</span>
          </template>
        </div>
        <button
          type="button"
          class="inv-close-btn"
          :title="L('Kapat (Esc)', 'Close (Esc)')"
          @click="emit('close')"
        >
          {{ L('Kapat (Esc)', 'Close (Esc)') }} <AppIcon name="X" :size="15" />
        </button>
      </header>

      <!-- Modal Body -->
      <div class="inv-body">
        <!-- MODE 1: Anvil / Container Open -->
        <template v-if="data.openWindow">
          <!-- 1.1 Anvil Mode -->
          <div v-if="isAnvil" class="anvil-section">
            <div class="anvil-rename-bar">
              <label for="anvil-input" class="sr-only">{{ L('Örs Eşya İsmi', 'Anvil Item Name') }}</label>
              <input
                id="anvil-input"
                v-model="anvilName"
                class="anvil-input"
                :placeholder="L('Eşyaya yeni isim ver...', 'Enter new item name...')"
                @keydown.enter.prevent="applyAnvilRename"
              />
              <button
                type="button"
                class="anvil-apply-btn"
                :disabled="!anvilName.trim()"
                @click="applyAnvilRename"
              >
                {{ L('İsmi Uygula', 'Apply Name') }}
              </button>
            </div>
            <div class="anvil-slots-row">
              <div class="anvil-slot-box">
                <span class="slot-sublabel">{{ L('Girdi', 'Input') }}</span>
                <InventorySlot
                  :slot="0"
                  :item="getItem(0)"
                  :label="L('Girdi Eşyası', 'Input Item')"
                  :disabled="!connected"
                  @click="emit('clickSlot', 0, $event)"
                  @hover="onSlotHover($event)"
                  @leave="onSlotLeave"
                />
              </div>
              <span class="anvil-symbol">+</span>
              <div class="anvil-slot-box">
                <span class="slot-sublabel">{{ L('Malzeme', 'Material') }}</span>
                <InventorySlot
                  :slot="1"
                  :item="getItem(1)"
                  :label="L('Geliştirme / Onarım', 'Material / Repair')"
                  :disabled="!connected"
                  @click="emit('clickSlot', 1, $event)"
                  @hover="onSlotHover($event)"
                  @leave="onSlotLeave"
                />
              </div>
              <span class="anvil-symbol"><AppIcon name="ArrowRight" :size="18" /></span>
              <div class="anvil-slot-box result">
                <span class="slot-sublabel">{{ L('Sonuç', 'Result') }}</span>
                <InventorySlot
                  :slot="2"
                  :item="getItem(2)"
                  :label="L('Örs Sonucu', 'Anvil Result')"
                  :disabled="!connected"
                  @click="emit('clickSlot', 2, $event)"
                  @hover="onSlotHover($event)"
                  @leave="onSlotLeave"
                />
              </div>
            </div>
          </div>

          <!-- 1.2 General Container Mode (Chest, Furnace, Hopper, etc.) -->
          <div v-else class="container-section">
            <div
              class="container-grid"
              :style="{
                gridTemplateColumns: `repeat(${data.openWindow.containerSlotCount === 5 ? 5 : (data.openWindow.containerSlotCount === 9 ? 9 : 9)}, 42px)`
              }"
            >
              <InventorySlot
                v-for="s in data.openWindow.containerSlotCount"
                :key="s - 1"
                :slot="s - 1"
                :item="getItem(s - 1)"
                :label="`${L('Konteyner', 'Container')} ${s}`"
                :disabled="!connected"
                @click="emit('clickSlot', s - 1, $event)"
                @hover="onSlotHover($event)"
                @leave="onSlotLeave"
              />
            </div>
          </div>

          <!-- Player Inventory inside Container View -->
          <div class="player-inv-section">
            <h3 class="inv-subhead">{{ L('Ana Envanter', 'Main Inventory') }}</h3>
            <div class="mc-grid">
              <InventorySlot
                v-for="idx in 27"
                :key="data.openWindow.containerSlotCount + idx - 1"
                :slot="data.openWindow.containerSlotCount + idx - 1"
                :item="getItem(data.openWindow.containerSlotCount + idx - 1)"
                :label="`${L('Envanter', 'Inventory')} ${idx}`"
                :disabled="!connected"
                @click="emit('clickSlot', data.openWindow.containerSlotCount + idx - 1, $event)"
                @hover="onSlotHover($event)"
                @leave="onSlotLeave"
              />
            </div>

            <div class="inv-hotbar-row">
              <h3 class="inv-subhead">{{ L('Hızlı Erişim', 'Hotbar') }}</h3>
              <div class="quickbar-selectors">
                <button
                  v-for="i in 9"
                  :key="i"
                  type="button"
                  class="quickbar-btn"
                  :class="{ active: data.selectedSlot === i - 1 }"
                  :title="`${L('Slot', 'Slot')} ${i} ${L('seç', 'select')}`"
                  @click="emit('selectHotbar', i - 1)"
                >
                  {{ i }}
                </button>
              </div>
            </div>
            <div class="mc-grid">
              <InventorySlot
                v-for="idx in 9"
                :key="data.openWindow.containerSlotCount + 27 + idx - 1"
                :slot="data.openWindow.containerSlotCount + 27 + idx - 1"
                :item="getItem(data.openWindow.containerSlotCount + 27 + idx - 1)"
                :label="`${L('Hızlı erişim', 'Hotbar')} ${idx}`"
                :selected="data.selectedSlot === idx - 1 && connected"
                :disabled="!connected"
                @click="emit('clickSlot', data.openWindow.containerSlotCount + 27 + idx - 1, $event)"
                @hover="onSlotHover($event)"
                @leave="onSlotLeave"
              />
            </div>
          </div>
        </template>

        <!-- MODE 2: Player Inventory Mode (46 slots) -->
        <template v-else>
          <!-- Top Row: Armor, Player Silhouette, Offhand, Crafting -->
          <div class="inventory-top">
            <!-- Armor Slots (5, 6, 7, 8) -->
            <div class="armor-column">
              <h3 class="inv-subhead">{{ L('Zırh', 'Armor') }}</h3>
              <div class="armor-grid">
                <InventorySlot
                  v-for="slot in [5, 6, 7, 8]"
                  :key="slot"
                  :slot="slot"
                  :item="getItem(slot)"
                  :label="[L('Kask', 'Helmet'), L('Göğüslük', 'Chestplate'), L('Pantolon', 'Leggings'), L('Bot', 'Boots')][slot - 5]"
                  :placeholder="(['helmet', 'chestplate', 'leggings', 'boots'] as const)[slot - 5]"
                  :disabled="!connected"
                  @click="emit('clickSlot', slot, $event)"
                  @hover="onSlotHover($event)"
                  @leave="onSlotLeave"
                />
              </div>
            </div>

            <!-- Player Silhouette & Offhand Slot (45) -->
            <div class="player-group">
              <div class="player-placeholder" aria-label="Oyuncu silueti">
                <span class="pixel-player"><i></i><i></i><i></i></span>
              </div>
              <div class="offhand-slot">
                <span class="slot-sublabel">{{ L('Diğer El', 'Offhand') }}</span>
                <InventorySlot
                  :slot="45"
                  :item="getItem(45)"
                  :label="L('Diğer el', 'Offhand')"
                  placeholder="shield"
                  :disabled="!connected"
                  @click="emit('clickSlot', 45, $event)"
                  @hover="onSlotHover($event)"
                  @leave="onSlotLeave"
                />
              </div>
            </div>

            <!-- 2x2 Crafting Grid (1, 2, 3, 4) -> Result (0) -->
            <div class="crafting-column">
              <h3 class="inv-subhead">{{ L('2×2 Üretim', '2×2 Crafting') }}</h3>
              <div class="craft-row">
                <div class="craft-grid">
                  <InventorySlot
                    v-for="slot in [1, 2, 3, 4]"
                    :key="slot"
                    :slot="slot"
                    :item="getItem(slot)"
                    :label="`${L('Üretim', 'Crafting')} ${slot}`"
                    :disabled="!connected"
                    @click="emit('clickSlot', slot, $event)"
                    @hover="onSlotHover($event)"
                    @leave="onSlotLeave"
                  />
                </div>
                <span class="craft-arrow"><AppIcon name="ArrowRight" :size="18" /></span>
                <div class="craft-result-box">
                  <InventorySlot
                    :slot="0"
                    :item="getItem(0)"
                    :label="L('Üretim sonucu', 'Crafting result')"
                    :disabled="!connected"
                    @click="emit('clickSlot', 0, $event)"
                    @hover="onSlotHover($event)"
                    @leave="onSlotLeave"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Main Inventory (27 slots: 9..35) -->
          <div class="player-inv-section">
            <h3 class="inv-subhead">{{ L('Ana Envanter', 'Main Inventory') }}</h3>
            <div class="mc-grid">
              <InventorySlot
                v-for="slot in 27"
                :key="slot + 8"
                :slot="slot + 8"
                :item="getItem(slot + 8)"
                :label="`${L('Envanter', 'Inventory')} ${slot}`"
                :disabled="!connected"
                @click="emit('clickSlot', slot + 8, $event)"
                @hover="onSlotHover($event)"
                @leave="onSlotLeave"
              />
            </div>

            <!-- Hotbar (9 slots: 36..44) + Quick Slot Selection Buttons (1..9) -->
            <div class="inv-hotbar-row">
              <h3 class="inv-subhead">{{ L('Hızlı Erişim', 'Hotbar') }}</h3>
              <div class="quickbar-selectors">
                <button
                  v-for="i in 9"
                  :key="i"
                  type="button"
                  class="quickbar-btn"
                  :class="{ active: data.selectedSlot === i - 1 }"
                  :title="`${L('Slot', 'Slot')} ${i} ${L('seç', 'select')}`"
                  @click="emit('selectHotbar', i - 1)"
                >
                  {{ i }}
                </button>
              </div>
            </div>
            <div class="mc-grid">
              <InventorySlot
                v-for="slot in 9"
                :key="slot + 35"
                :slot="slot + 35"
                :item="getItem(slot + 35)"
                :label="`${L('Hızlı erişim', 'Hotbar')} ${slot}`"
                :selected="data.selectedSlot === slot - 1 && connected"
                :disabled="!connected"
                @click="emit('clickSlot', slot + 35, $event)"
                @hover="onSlotHover($event)"
                @leave="onSlotLeave"
              />
            </div>
          </div>
        </template>

        <!-- Outside Drop / Cursor Bar (Safety: only shown if openWindow exists or player inventory has items) -->
        <div v-if="data.cursor && (data.openWindow || data.inventory.length > 0)" class="inv-cursor-bar">
          <span class="cursor-info">
            {{ L('İmleçte:', 'On cursor:') }} <strong>{{ data.cursor.customName || data.cursor.displayName }}</strong> × {{ data.cursor.count }}
          </span>
          <button
            type="button"
            class="drop-outside"
            @click="emit('clickSlot', -999, $event)"
            @contextmenu.prevent="emit('clickSlot', -999, $event)"
          >
            {{ L('Dışarı bırak (sol: tümü, sağ: bir)', 'Drop outside (left: all, right: one)') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Cursor Ghost (Safety: only shown if openWindow exists or player inventory has items) -->
    <div
      v-if="data.cursor && (data.openWindow || data.inventory.length > 0)"
      class="cursor-ghost"
      :style="{ left: `${pointer.x + 14}px`, top: `${pointer.y + 14}px` }"
      aria-hidden="true"
    >
      <ItemIcon :item="data.cursor" />
      <b v-if="data.cursor.count > 1">{{ data.cursor.count }}</b>
    </div>

    <!-- Minecraft Style Rich Item Tooltip Box -->
    <div
      v-if="hoveredSlot !== null && hoveredItem && !data.cursor"
      class="mc-item-tooltip"
      :style="tooltipStyle"
      aria-hidden="true"
    >
      <!-- Title: nameSegments or customName / displayName -->
      <div class="mc-tooltip-title">
        <template v-if="hoveredItem.nameSegments?.length">
          <span
            v-for="(seg, sIdx) in hoveredItem.nameSegments"
            :key="sIdx"
            :style="{
              color: seg.color || '#ffff55',
              fontWeight: seg.bold ? 'bold' : 'normal',
              fontStyle: seg.italic ? 'italic' : 'normal',
              textDecoration: [seg.underlined ? 'underline' : '', seg.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined
            }"
          >{{ seg.text }}</span>
        </template>
        <span
          v-else
          :style="{ color: hoveredItem.customName ? '#55ffff' : (hoveredItem.enchanted ? '#ff55ff' : '#ffffff') }"
        >
          {{ hoveredItem.customName || hoveredItem.displayName }}
        </span>
      </div>

      <!-- Lore Lines -->
      <div v-if="hoveredItem.lore?.length" class="mc-tooltip-lore">
        <div v-for="(line, lIdx) in hoveredItem.lore" :key="lIdx" class="mc-lore-line">
          <span
            v-for="(seg, sIdx) in line"
            :key="sIdx"
            :style="{
              color: seg.color || '#aaaaaa',
              fontWeight: seg.bold ? 'bold' : 'normal',
              fontStyle: seg.italic ? 'italic' : 'normal',
              textDecoration: [seg.underlined ? 'underline' : '', seg.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined
            }"
          >{{ seg.text }}</span>
        </div>
      </div>

      <!-- Item Meta info footer -->
      <div class="mc-tooltip-meta">
        <span class="meta-item-id">minecraft:{{ hoveredItem.name }}</span>
        <span class="meta-slot-num">{{ L('Yuva', 'Slot') }} #{{ hoveredSlot }}</span>
      </div>
    </div>
  </div>
</template>
