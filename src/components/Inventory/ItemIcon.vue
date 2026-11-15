<script lang="ts">
import { ITEM_TEXTURE_SET, BLOCK_TEXTURE_SET } from '../../utils/textureManifest';

const packTextureCache = new Map<string, string | null>();
const decodedImageUrls = new Set<string>();

const SPECIAL_ITEM_TEXTURES: Record<string, string> = {
  compass: 'compass_16',
  clock: 'clock_00',
  recovery_compass: 'recovery_compass_16',
  crossbow: 'crossbow_standby',
  fishing_rod: 'fishing_rod',
  spyglass: 'spyglass',
  experience_bottle: 'experience_bottle',
  writable_book: 'writable_book',
  written_book: 'written_book',
  chest_minecart: 'chest_minecart',
  hopper_minecart: 'hopper_minecart',
  tnt_minecart: 'tnt_minecart',
  glass_pane: 'glass',
  white_stained_glass_pane: 'white_stained_glass',
  orange_stained_glass_pane: 'orange_stained_glass',
  magenta_stained_glass_pane: 'magenta_stained_glass',
  light_blue_stained_glass_pane: 'light_blue_stained_glass',
  yellow_stained_glass_pane: 'yellow_stained_glass',
  lime_stained_glass_pane: 'lime_stained_glass',
  pink_stained_glass_pane: 'pink_stained_glass',
  gray_stained_glass_pane: 'gray_stained_glass',
  light_gray_stained_glass_pane: 'light_gray_stained_glass',
  cyan_stained_glass_pane: 'cyan_stained_glass',
  purple_stained_glass_pane: 'purple_stained_glass',
  blue_stained_glass_pane: 'blue_stained_glass',
  brown_stained_glass_pane: 'brown_stained_glass',
  green_stained_glass_pane: 'green_stained_glass',
  red_stained_glass_pane: 'red_stained_glass',
  black_stained_glass_pane: 'black_stained_glass',
  tinted_glass: 'tinted_glass',
  anvil: 'anvil_top',
  chipped_anvil: 'chipped_anvil_top',
  damaged_anvil: 'damaged_anvil_top',
  crafting_table: 'crafting_table_front',
  furnace: 'furnace_front',
  blast_furnace: 'blast_furnace_front',
  smoker: 'smoker_front',
  chest: 'oak_planks',
  trapped_chest: 'oak_planks',
  ender_chest: 'obsidian',
  barrel: 'barrel_side',
  lectern: 'lectern_front',
  beacon: 'beacon',
  snow: 'snow',
  grass_block: 'grass_block_side',
  podzol: 'podzol_side',
  mycelium: 'mycelium_side',
  enchanting_table: 'enchanting_table_top',
  jukebox: 'jukebox_top',
  tnt: 'tnt_side',
  pumpkin: 'pumpkin_side',
  carved_pumpkin: 'carved_pumpkin',
  jack_o_lantern: 'jack_o_lantern',
  melon: 'melon_side',
  hay_block: 'hay_block_side',
  bone_block: 'bone_block_side',
  quartz_block: 'quartz_block_side',
  smooth_quartz: 'quartz_block_bottom',
  snow_block: 'snow',
  cactus: 'cactus_side',
  scaffolding: 'scaffolding_top',
  sculk_sensor: 'sculk_sensor_top',
  calibrated_sculk_sensor: 'calibrated_sculk_sensor_top',
  daylight_detector: 'daylight_detector_top',
  dried_kelp_block: 'dried_kelp_top',
  magma_block: 'magma',
  tipped_arrow: 'tipped_arrow_head',
  crimson_hyphae: 'crimson_stem',
  warped_hyphae: 'warped_stem',
  stripped_crimson_hyphae: 'stripped_crimson_stem',
  stripped_warped_hyphae: 'stripped_warped_stem',
};

function resolveTextureFileUrl(baseName: string): string | null {
  if (!baseName) return null;
  const name = baseName.trim().toLowerCase();
  if (ITEM_TEXTURE_SET.has(name)) {
    return `${import.meta.env.BASE_URL}textures/item/${encodeURIComponent(name)}.png`;
  }
  if (BLOCK_TEXTURE_SET.has(name)) {
    return `${import.meta.env.BASE_URL}textures/block/${encodeURIComponent(name)}.png`;
  }
  return null;
}

function resolveVanillaTextureUrl(rawItemName: string): string | null {
  if (!rawItemName) return null;
  const cleaned = rawItemName.replace(/^minecraft:/, '').toLowerCase();
  const raw = cleaned.startsWith('waxed_') ? cleaned.replace(/^waxed_/, '') : cleaned;

  // 1. Exact mapped name from SPECIAL_ITEM_TEXTURES
  const mapped = SPECIAL_ITEM_TEXTURES[rawItemName] || SPECIAL_ITEM_TEXTURES[cleaned] || SPECIAL_ITEM_TEXTURES[raw];
  if (mapped) {
    const url = resolveTextureFileUrl(mapped);
    if (url) return url;
  }

  // 2. raw (and without waxed_)
  if (cleaned !== raw) {
    const urlCleaned = resolveTextureFileUrl(cleaned);
    if (urlCleaned) return urlCleaned;
  }
  const urlRaw = resolveTextureFileUrl(raw);
  if (urlRaw) return urlRaw;

  // 3. Pattern suffixes when none of the above hit:
  // - *_stained_glass_pane -> *_stained_glass
  if (raw.endsWith('_stained_glass_pane')) {
    const target = raw.replace(/_stained_glass_pane$/, '_stained_glass');
    const url = resolveTextureFileUrl(target);
    if (url) return url;
  }

  // - glass_pane -> glass
  if (raw === 'glass_pane') {
    const url = resolveTextureFileUrl('glass');
    if (url) return url;
  }

  // - *_carpet / *_bed / *_banner / *_wall_banner -> *_wool
  if (/_carpet$|_bed$|_banner$|_wall_banner$/.test(raw)) {
    const wool = raw.replace(/_(carpet|bed|wall_banner|banner)$/, '_wool');
    const url = resolveTextureFileUrl(wool);
    if (url) return url;
  }

  // - stripped_*_wood -> stripped_*_log
  if (raw.startsWith('stripped_') && raw.endsWith('_wood')) {
    const log = raw.replace(/_wood$/, '_log');
    const url = resolveTextureFileUrl(log);
    if (url) return url;
  }

  // - *_wood -> *_log
  if (raw.endsWith('_wood')) {
    const log = raw.replace(/_wood$/, '_log');
    const url = resolveTextureFileUrl(log);
    if (url) return url;
  }

  // - *_slab / *_stairs / *_wall / *_fence / *_fence_gate / *_button / *_pressure_plate
  const suffixMatch = raw.match(/^(.*)_(slab|stairs|wall|fence|fence_gate|button|pressure_plate)$/);
  if (suffixMatch) {
    const stem = suffixMatch[1];
    // try <stem>, <stem>s, <stem>_planks, <stem>_top, smooth_<stem>
    const candidates = [
      `${stem}_planks`,
      `${stem}s`,
      stem,
      `${stem}_top`,
      `smooth_${stem}`,
      `${stem}_block`,
    ];
    for (const c of candidates) {
      const url = resolveTextureFileUrl(c);
      if (url) return url;
    }
  }

  // - *_bundle -> white_bundle? if none, leather
  if (raw.endsWith('_bundle') || raw === 'bundle') {
    const bundleUrl = resolveTextureFileUrl('white_bundle') || resolveTextureFileUrl('bundle') || resolveTextureFileUrl('leather');
    if (bundleUrl) return bundleUrl;
  }

  // - ${raw}_top, ${raw}_side, ${raw}_front
  const orientations = [`${raw}_top`, `${raw}_side`, `${raw}_front`, `${raw}_bottom`];
  for (const o of orientations) {
    const url = resolveTextureFileUrl(o);
    if (url) return url;
  }

  return null;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { CursorItem } from '../../types/bot';

const props = defineProps<{ item: CursorItem }>();

const headCanvasRef = ref<HTMLCanvasElement | null>(null);
const headLoaded = ref(false);
let headSeq = 0;
let lastDrawnHeadUrl = '';

const customPackTexture = ref<string | null>(null);
const displayedSrc = ref<string | null>(null);
let packSeq = 0;
let imgSeq = 0;
let lastWatchedItemName = '';
let lastDisplayedItemName = '';

const isHead = computed(() => {
  const n = props.item.name;
  return (n.includes('head') || n.includes('skull')) && n !== 'tipped_arrow_head';
});

const vanillaTextureUrl = computed<string | null>(() => {
  if (isHead.value) return null;
  return resolveVanillaTextureUrl(props.item.name);
});

const desiredTargetUrl = computed<string | null>(() => {
  return customPackTexture.value || vanillaTextureUrl.value;
});

watch(
  [() => props.item.name, () => props.item.customModelData],
  ([name, cmd]) => {
    const cacheKey = `${name}:${cmd ?? 'none'}`;
    if (packTextureCache.has(cacheKey)) {
      customPackTexture.value = packTextureCache.get(cacheKey) ?? null;
      lastWatchedItemName = name;
      return;
    }

    if (name !== lastWatchedItemName) {
      customPackTexture.value = null;
    }
    lastWatchedItemName = name;

    const seq = ++packSeq;
    const electronApi = (
      window as unknown as {
        electronAPI?: {
          resolveResourcePackTexture?: (name: string, customModelData?: number) => Promise<string | null>;
        };
      }
    ).electronAPI;

    if (electronApi?.resolveResourcePackTexture && (cmd != null || !isHead.value)) {
      electronApi
        .resolveResourcePackTexture(name, cmd)
        .then(res => {
          if (res) {
            packTextureCache.set(cacheKey, res);
          }
          if (seq === packSeq) {
            customPackTexture.value = res || null;
          }
        })
        .catch(() => {
          if (seq === packSeq) {
            customPackTexture.value = null;
          }
        });
    } else {
      if (seq === packSeq) {
        customPackTexture.value = null;
      }
    }
  },
  { immediate: true }
);

watch(
  desiredTargetUrl,
  newUrl => {
    if (!newUrl) {
      displayedSrc.value = null;
      lastDisplayedItemName = props.item.name;
      return;
    }

    if (newUrl.startsWith('data:') || decodedImageUrls.has(newUrl)) {
      displayedSrc.value = newUrl;
      lastDisplayedItemName = props.item.name;
      return;
    }

    if (props.item.name !== lastDisplayedItemName) {
      displayedSrc.value = null;
    }

    const seq = ++imgSeq;
    const preload = new Image();
    preload.onload = () => {
      if (seq === imgSeq) {
        decodedImageUrls.add(newUrl);
        displayedSrc.value = newUrl;
        lastDisplayedItemName = props.item.name;
      }
    };
    preload.onerror = () => {
      if (seq === imgSeq) {
        displayedSrc.value = null;
      }
    };
    preload.src = newUrl;
  },
  { immediate: true }
);

function extractFace(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  hx: number,
  hy: number,
  brightness: number
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const cCtx = c.getContext('2d')!;
  cCtx.imageSmoothingEnabled = false;

  // Draws base skin layer
  cCtx.drawImage(img, sx, sy, 8, 8, 0, 0, 8, 8);

  // If img.height >= 64 (modern 64x64 skin) or sy === 0 || sy === 8: draws outer hat layer
  if (img.height >= 64 || sy === 0 || sy === 8) {
    cCtx.drawImage(img, hx, hy, 8, 8, 0, 0, 8, 8);
  }

  // If brightness < 1, applies shading using source-atop
  if (brightness < 1) {
    cCtx.globalCompositeOperation = 'source-atop';
    cCtx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
    cCtx.fillRect(0, 0, 8, 8);
  }

  return c;
}

function drawHeadTexture() {
  const url = props.item.headTextureUrl;
  if (!isHead.value || !url) {
    headLoaded.value = false;
    lastDrawnHeadUrl = '';
    return;
  }
  if (url === lastDrawnHeadUrl && headLoaded.value) {
    return;
  }

  const seq = ++headSeq;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (seq !== headSeq) return;
    const canvas = headCanvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);

    // Extract faces:
    // Top face: base (8, 0, 8, 8), hat (40, 0, 8, 8), brightness = 1.0
    const topFace = extractFace(img, 8, 0, 40, 0, 1.0);
    // Front-Left face: base (8, 8, 8, 8), hat (40, 8, 8, 8), brightness = 0.86
    const frontFace = extractFace(img, 8, 8, 40, 8, 0.86);
    // Front-Right face: base (0, 8, 8, 8), hat (32, 8, 8, 8), brightness = 0.70
    const sideFace = extractFace(img, 0, 8, 32, 8, 0.70);

    // Draw Top face: diamond at top
    ctx.save();
    ctx.setTransform(1.5, 0.75, -1.5, 0.75, 16, 2);
    ctx.drawImage(topFace, 0, 0);
    ctx.restore();

    // Draw Front-Left face: left side of cube
    ctx.save();
    ctx.setTransform(1.5, 0.75, 0, 1.625, 4, 8);
    ctx.drawImage(frontFace, 0, 0);
    ctx.restore();

    // Draw Front-Right face: right side of cube
    ctx.save();
    ctx.setTransform(1.5, -0.75, 0, 1.625, 16, 14);
    ctx.drawImage(sideFace, 0, 0);
    ctx.restore();

    lastDrawnHeadUrl = url;
    headLoaded.value = true;
  };
  img.onerror = () => {
    if (seq !== headSeq) return;
    headLoaded.value = false;
    lastDrawnHeadUrl = '';
  };
  img.src = url;
}

watch(
  () => [props.item.name, props.item.headTextureUrl],
  () => {
    if (isHead.value && props.item.headTextureUrl) {
      if (!lastDrawnHeadUrl) {
        headLoaded.value = false;
      }
      void nextTick(drawHeadTexture);
    } else {
      headLoaded.value = false;
      lastDrawnHeadUrl = '';
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (isHead.value && props.item.headTextureUrl) {
    drawHeadTexture();
  }
});

// Deterministic head hue for custom-named player heads
const customHue = computed(() => {
  const name = props.item.customName || '';
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  return hash % 360;
});

// Safe Fallback Text (Never show {" or [)
const safeFallbackText = computed(() => {
  const d = props.item.displayName?.trim() || '';
  if (!d || d.startsWith('{') || d.startsWith('[')) {
    return props.item.name.replace(/^minecraft:/, '').slice(0, 2).toUpperCase();
  }
  return d.slice(0, 2).toUpperCase();
});
</script>

<template>
  <div class="item-icon-wrapper" :class="{ 'enchanted-glow': item.enchanted }">
    <!-- 1. Head / Skull with headTextureUrl loaded on canvas or SVG (when no custom pack texture overrides it) -->
    <template v-if="isHead && !customPackTexture">
      <canvas
        v-show="item.headTextureUrl && headLoaded"
        ref="headCanvasRef"
        width="32"
        height="32"
        class="head-canvas"
      ></canvas>

      <!-- Fallback Pixel-Art SVG Heads (No PL letters!) -->
      <svg
        v-if="!item.headTextureUrl || !headLoaded"
        class="head-svg"
        viewBox="0 0 8 8"
        shape-rendering="crispEdges"
      >
        <!-- Skeleton Skull -->
        <template v-if="item.name.includes('skeleton_skull') && !item.name.includes('wither')">
          <rect width="8" height="8" fill="#bcbcbc" />
          <rect x="1" y="3" width="2" height="2" fill="#202020" />
          <rect x="5" y="3" width="2" height="2" fill="#202020" />
          <rect x="3" y="5" width="2" height="1" fill="#444444" />
          <rect x="2" y="6" width="1" height="1" fill="#202020" />
          <rect x="4" y="6" width="1" height="1" fill="#202020" />
          <rect x="6" y="6" width="1" height="1" fill="#202020" />
        </template>

        <!-- Wither Skeleton Skull -->
        <template v-else-if="item.name.includes('wither')">
          <rect width="8" height="8" fill="#252528" />
          <rect x="1" y="3" width="2" height="2" fill="#0d0d0f" />
          <rect x="5" y="3" width="2" height="2" fill="#0d0d0f" />
          <rect x="3" y="5" width="2" height="1" fill="#141416" />
          <rect x="2" y="6" width="4" height="1" fill="#35353c" />
        </template>

        <!-- Zombie Head -->
        <template v-else-if="item.name.includes('zombie')">
          <rect width="8" height="8" fill="#4c7c34" />
          <rect x="0" y="0" width="8" height="2" fill="#28441c" />
          <rect x="1" y="3" width="2" height="1" fill="#1b2e13" />
          <rect x="5" y="3" width="2" height="1" fill="#1b2e13" />
          <rect x="3" y="4" width="2" height="2" fill="#3b6228" />
          <rect x="2" y="6" width="4" height="1" fill="#233a18" />
        </template>

        <!-- Creeper Head -->
        <template v-else-if="item.name.includes('creeper')">
          <rect width="8" height="8" fill="#52a535" />
          <rect x="1" y="2" width="2" height="2" fill="#0b1707" />
          <rect x="5" y="2" width="2" height="2" fill="#0b1707" />
          <rect x="3" y="4" width="2" height="3" fill="#0b1707" />
          <rect x="2" y="5" width="1" height="2" fill="#0b1707" />
          <rect x="5" y="5" width="1" height="2" fill="#0b1707" />
        </template>

        <!-- Dragon Head -->
        <template v-else-if="item.name.includes('dragon')">
          <rect width="8" height="8" fill="#1a1820" />
          <rect x="1" y="3" width="2" height="1" fill="#a832a8" />
          <rect x="5" y="3" width="2" height="1" fill="#a832a8" />
          <rect x="2" y="5" width="4" height="2" fill="#0e0c12" />
        </template>

        <!-- Player Head (Steve / Custom-named player) -->
        <template v-else>
          <!-- Hair -->
          <rect width="8" height="8" fill="#bc8b72" :style="customHue ? { filter: `hue-rotate(${customHue}deg)` } : {}" />
          <rect x="0" y="0" width="8" height="2" fill="#4a3018" />
          <rect x="0" y="2" width="1" height="2" fill="#4a3018" />
          <rect x="7" y="2" width="1" height="2" fill="#4a3018" />
          <!-- Eyes -->
          <rect x="1" y="3" width="1" height="1" fill="#ffffff" />
          <rect x="2" y="3" width="1" height="1" fill="#2c3584" />
          <rect x="5" y="3" width="1" height="1" fill="#2c3584" />
          <rect x="6" y="3" width="1" height="1" fill="#ffffff" />
          <!-- Nose & Mouth -->
          <rect x="3" y="4" width="2" height="1" fill="#9c6e58" />
          <rect x="2" y="5" width="4" height="1" fill="#583522" />
          <rect x="3" y="6" width="2" height="1" fill="#bc8b72" />
        </template>
      </svg>
    </template>

    <!-- 2. Preloaded Image (Custom Pack Texture OR Preloaded Vanilla Texture) -->
    <img
      v-else-if="displayedSrc"
      :src="displayedSrc"
      class="custom-pack-img"
      alt=""
      @error="displayedSrc = null"
    />

    <!-- 3. Final Safe Text Fallback (Zero broken-img flash) -->
    <span v-else class="item-symbol">{{ safeFallbackText }}</span>
  </div>
</template>

<style scoped>
.custom-pack-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
</style>
