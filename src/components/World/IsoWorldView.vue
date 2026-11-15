<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { BotData, ControlName, WorldBlock, WorldEntity } from '../../types/bot';
import ItemIcon from '../Inventory/ItemIcon.vue';
import AppIcon from '../ui/AppIcon.vue';
import { useI18n } from '../../i18n';

const api = window.electronAPI;

const props = defineProps<{
  username: string;
  connected: boolean;
  data: BotData;
  modalOpen?: boolean;
}>();

const emit = defineEmits<{
  (e: 'openInventory'): void;
  (e: 'error', msg: string): void;
}>();

const { L, t: i18n_t } = useI18n();
function blockIcon(kind?: string) {
  if (kind === 'chest') return 'Box';
  if (kind === 'anvil') return 'Hammer';
  if (kind === 'furnace') return 'Flame';
  if (kind === 'crafting') return 'Axe';
  return 'Layers';
}
const t = (key: string, params?: Record<string, string | number>) => {
  const val = i18n_t(key, params);
  if (val === key && key === 'world.physicsOn') {
    return L('Fizik: Açık', 'Physics: On');
  }
  return val;
};

// Layer vertical slice filter
type LayerFilter = 'auto' | 'foot' | 'head' | 'interactable';
const layerFilter = ref<LayerFilter>('auto');

// Heading mode: 'north' = North is UP; 'bot' = facing is UP
const headingMode = ref<'north' | 'bot'>('north');

// Target movement position indicator
const targetMovePos = ref<{ x: number; y: number; z: number } | null>(null);

// Canvas refs & state
const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const hoveredCell = ref<{ dx: number; dz: number; block: WorldBlock | null; entity: WorldEntity | null } | null>(null);

// Texture cache
const textureCache = new Map<string, HTMLImageElement | null>();
function getTexture(name: string): HTMLImageElement | null {
  if (textureCache.has(name)) {
    return textureCache.get(name) || null;
  }
  textureCache.set(name, null);
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}textures/block/${encodeURIComponent(name)}.png`;
  img.onload = () => {
    textureCache.set(name, img);
    requestRender();
  };
  img.onerror = () => {
    const itemImg = new Image();
    itemImg.src = `${import.meta.env.BASE_URL}textures/item/${encodeURIComponent(name)}.png`;
    itemImg.onload = () => {
      textureCache.set(name, itemImg);
      requestRender();
    };
    itemImg.onerror = () => {
      // not available
    };
  };
  return null;
}

// Fallback colors for blocks
function getBlockColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('grass')) return '#5c8e32';
  if (lower.includes('dirt') || lower.includes('podzol') || lower.includes('path')) return '#866043';
  if (lower.includes('stone') || lower.includes('andesite') || lower.includes('diorite') || lower.includes('granite') || lower.includes('cobble')) return '#7f8389';
  if (lower.includes('chest') || lower.includes('barrel') || lower.includes('shulker')) return '#bd8736';
  if (lower.includes('anvil')) return '#3f3f47';
  if (lower.includes('crafting') || lower.includes('work')) return '#966336';
  if (lower.includes('furnace') || lower.includes('smoker') || lower.includes('blast')) return '#555555';
  if (lower.includes('wood') || lower.includes('plank') || lower.includes('log') || lower.includes('fence')) return '#9c7446';
  if (lower.includes('water')) return '#296396';
  if (lower.includes('lava')) return '#d45a1c';
  if (lower.includes('leaves')) return '#336826';
  if (lower.includes('sand') || lower.includes('sandstone')) return '#d2c795';
  if (lower.includes('glass')) return '#94bcc2';
  if (lower.includes('iron')) return '#d8d8d8';
  if (lower.includes('gold')) return '#f3c734';
  if (lower.includes('diamond')) return '#5decf5';
  if (lower.includes('emerald')) return '#37d962';
  if (lower.includes('redstone')) return '#d92727';
  if (lower.includes('obsidian') || lower.includes('bedrock')) return '#1e192c';
  if (lower.includes('wool') || lower.includes('concrete')) return '#a8b0ba';

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffff;
  const r = (hash & 0x7f) + 80;
  const g = ((hash >> 7) & 0x7f) + 80;
  const b = ((hash >> 14) & 0x7f) + 80;
  return `rgb(${r}, ${g}, ${b})`;
}

// Cell lookup helpers for 15x15 radar (-7..+7)
function getCellBlock(dx: number, dz: number): WorldBlock | null {
  const blocks = props.data.world?.blocks;
  if (!blocks || !blocks.length) return null;

  const matches = blocks.filter(b => b.dx === dx && b.dz === dz);
  if (!matches.length) return null;

  if (layerFilter.value === 'interactable') {
    return matches.find(b => Boolean(b.interactable)) || null;
  }
  if (layerFilter.value === 'foot') {
    return matches.find(b => b.dy >= -1 && b.dy <= 0) || null;
  }
  if (layerFilter.value === 'head') {
    return matches.find(b => b.dy >= 1 && b.dy <= 2) || null;
  }

  // 'auto' mode:
  // 1. Prioritize interactable blocks in this column
  const interactable = matches.find(b => Boolean(b.interactable));
  if (interactable) return interactable;

  // 2. Pick block closest to feet level (-0.5)
  let best = matches[0];
  let bestScore = 999;
  for (const b of matches) {
    const score = Math.abs(b.dy - (-0.5));
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

function getCellEntity(dx: number, dz: number): WorldEntity | null {
  const entities = props.data.world?.entities;
  if (!entities || !entities.length) return null;
  const botX = props.data.pose?.x ?? 0;
  const botZ = props.data.pose?.z ?? 0;
  return entities.find(e => {
    const edx = Math.round(e.x - botX);
    const edz = Math.round(e.z - botZ);
    return edx === dx && edz === dz;
  }) || null;
}

// Request render animation frame
let animFrameId: number | null = null;
function requestRender() {
  if (animFrameId !== null) return;
  animFrameId = requestAnimationFrame(() => {
    animFrameId = null;
    render();
  });
}

function render() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#0a101d';
  ctx.fillRect(0, 0, width, height);

  // Grid sizing: 15x15
  const gridCount = 15;
  const cellSize = Math.floor(Math.min(width - 24, height - 24) / gridCount);
  const gridWidth = cellSize * gridCount;
  const gridHeight = cellSize * gridCount;
  const originX = Math.floor((width - gridWidth) / 2);
  const originY = Math.floor((height - gridHeight) / 2);

  // Bot orientation
  const yaw = props.data.pose?.yaw ?? 0;
  const isBotHeading = headingMode.value === 'bot';

  // Draw Radar Cells
  for (let row = 0; row < gridCount; row++) {
    for (let col = 0; col < gridCount; col++) {
      const dx = col - 7;
      const dz = row - 7;
      const cellX = originX + col * cellSize;
      const cellY = originY + row * cellSize;

      const block = getCellBlock(dx, dz);
      const isHovered = hoveredCell.value?.dx === dx && hoveredCell.value?.dz === dz;

      // Base tile
      ctx.fillStyle = '#0e1626';
      ctx.fillRect(cellX, cellY, cellSize, cellSize);

      // Block drawing
      if (block) {
        const baseColor = getBlockColor(block.name);
        ctx.fillStyle = baseColor;
        ctx.fillRect(cellX, cellY, cellSize, cellSize);

        // Texture image
        const img = getTexture(block.name);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, cellX, cellY, cellSize, cellSize);
        }

        // Depth shading relative to foot level
        if (block.dy > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        } else if (block.dy < 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
          ctx.fillRect(cellX, cellY, cellSize, cellSize);
        }

        // Relative height tag (+1, -1, etc.)
        if (block.dy !== 0) {
          ctx.font = 'bold 8px ui-monospace, monospace';
          const dyText = block.dy > 0 ? `+${block.dy}` : `${block.dy}`;
          const tw = ctx.measureText(dyText).width;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(cellX + cellSize - tw - 4, cellY + 1, tw + 3, 10);
          ctx.fillStyle = block.dy > 0 ? '#b9f477' : '#9bb0cf';
          ctx.fillText(dyText, cellX + cellSize - tw - 2, cellY + 9);
        }

        // Interactable highlight & icon
        if (block.interactable) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.strokeRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, Math.max(2, cellSize * 0.11), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cell border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, cellY, cellSize, cellSize);

      // Target Move indicator
      if (targetMovePos.value) {
        const botX = props.data.pose?.x ?? 0;
        const botZ = props.data.pose?.z ?? 0;
        const tdx = Math.round(targetMovePos.value.x - botX);
        const tdz = Math.round(targetMovePos.value.z - botZ);
        if (tdx === dx && tdz === dz) {
          ctx.save();
          ctx.strokeStyle = '#b9f477';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#b9f477';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, cellSize * 0.38, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, Math.max(2, cellSize * 0.12), 0, Math.PI * 2);
          ctx.fillStyle = '#b9f477';
          ctx.fill();
          ctx.restore();
        }
      }

      // Entity / NPC marker
      const entity = getCellEntity(dx, dz);
      if (entity) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cellX + cellSize / 2, cellY + cellSize / 2, cellSize * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = entity.type === 'player' ? 'rgba(99, 102, 241, 0.85)' : 'rgba(236, 72, 153, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const markerX = cellX + cellSize / 2;
        const markerY = cellY + cellSize / 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(markerX, markerY - cellSize * 0.08, cellSize * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(markerX, markerY + cellSize * 0.16, cellSize * 0.17, Math.PI, 0);
        ctx.fill();

        // Name tag
        ctx.font = 'bold 8px Inter, sans-serif';
        const nameWidth = ctx.measureText(entity.displayName).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(cellX + cellSize / 2 - nameWidth / 2 - 2, cellY - 10, nameWidth + 4, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(entity.displayName, cellX + cellSize / 2, cellY - 2);
        ctx.restore();
      }

      // Hover outline
      if (isHovered) {
        ctx.strokeStyle = '#ceffa1';
        ctx.lineWidth = 2;
        ctx.strokeRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
      }
    }
  }

  // Draw Bot at Center Cell (col=7, row=7)
  const botCellX = originX + 7 * cellSize;
  const botCellY = originY + 7 * cellSize;
  const botCenterX = botCellX + cellSize / 2;
  const botCenterY = botCellY + cellSize / 2;

  ctx.save();
  // Vision Cone
  const dirX = -Math.sin(yaw);
  const dirY = Math.cos(yaw);
  const coneLength = cellSize * 2.2;

  ctx.beginPath();
  ctx.moveTo(botCenterX, botCenterY);
  const leftAngle = Math.atan2(dirY, dirX) - Math.PI / 6;
  const rightAngle = Math.atan2(dirY, dirX) + Math.PI / 6;
  ctx.lineTo(botCenterX + coneLength * Math.cos(leftAngle), botCenterY + coneLength * Math.sin(leftAngle));
  ctx.arc(botCenterX, botCenterY, coneLength, leftAngle, rightAngle);
  ctx.closePath();
  ctx.fillStyle = 'rgba(185, 244, 119, 0.18)';
  ctx.fill();

  // Bot Ring & Arrow
  ctx.beginPath();
  ctx.arc(botCenterX, botCenterY, cellSize * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = '#172810';
  ctx.fill();
  ctx.strokeStyle = '#b9f477';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#b9f477';
  ctx.shadowBlur = 8;
  ctx.stroke();

  // Direction pointer arrow
  const arrowX = botCenterX + dirX * (cellSize * 0.5);
  const arrowY = botCenterY + dirY * (cellSize * 0.5);
  ctx.beginPath();
  ctx.moveTo(botCenterX, botCenterY);
  ctx.lineTo(arrowX, arrowY);
  ctx.strokeStyle = '#b9f477';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Arrowhead
  const headAngle = Math.atan2(dirY, dirX);
  const headLen = 6;
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX - headLen * Math.cos(headAngle - Math.PI / 6), arrowY - headLen * Math.sin(headAngle - Math.PI / 6));
  ctx.lineTo(arrowX - headLen * Math.cos(headAngle + Math.PI / 6), arrowY - headLen * Math.sin(headAngle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = '#b9f477';
  ctx.fill();

  // Username badge above bot
  ctx.font = 'bold 9px Inter, sans-serif';
  const name = props.username;
  const nameWidth = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(11, 16, 32, 0.88)';
  ctx.fillRect(botCenterX - nameWidth / 2 - 4, botCenterY - cellSize * 0.55 - 12, nameWidth + 8, 12);
  ctx.strokeStyle = '#b9f47766';
  ctx.strokeRect(botCenterX - nameWidth / 2 - 4, botCenterY - cellSize * 0.55 - 12, nameWidth + 8, 12);
  ctx.fillStyle = '#b9f477';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, botCenterX, botCenterY - cellSize * 0.55 - 6);

  ctx.restore();

  // Compass Indicator (Top-Left)
  ctx.save();
  ctx.fillStyle = 'rgba(11, 18, 32, 0.85)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.fillRect(8, 8, 36, 36);
  ctx.strokeRect(8, 8, 36, 36);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillStyle = isBotHeading ? '#9bb0cf' : '#ff6b6b';
  ctx.fillText('N', 26, 20);
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = '#7a8ba7';
  ctx.beginPath();
  ctx.moveTo(26, 25);
  ctx.lineTo(22, 32);
  ctx.lineTo(26, 30);
  ctx.lineTo(30, 32);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// Mouse interaction on 2D Radar
function onCanvasMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const width = rect.width;
  const height = rect.height;
  const gridCount = 15;
  const cellSize = Math.floor(Math.min(width - 24, height - 24) / gridCount);
  const gridWidth = cellSize * gridCount;
  const gridHeight = cellSize * gridCount;
  const originX = Math.floor((width - gridWidth) / 2);
  const originY = Math.floor((height - gridHeight) / 2);

  const col = Math.floor((mx - originX) / cellSize);
  const row = Math.floor((my - originY) / cellSize);

  if (col >= 0 && col < gridCount && row >= 0 && row < gridCount) {
    const dx = col - 7;
    const dz = row - 7;
    const block = getCellBlock(dx, dz);
    const entity = getCellEntity(dx, dz);
    hoveredCell.value = { dx, dz, block, entity };
  } else {
    hoveredCell.value = null;
  }
  requestRender();
}

// Click on Radar Grid (Left Click)
async function onCanvasClick() {
  if (!hoveredCell.value) return;
  const { dx, dz, block, entity } = hoveredCell.value;

  try {
    // 1. Entity interaction
    if (entity) {
      if (entity.distance <= 5.0) {
        await api.interactEntity(props.username, entity.id);
      } else {
        await api.moveTo(props.username, { x: entity.x, y: entity.y, z: entity.z });
        targetMovePos.value = { x: entity.x, y: entity.y, z: entity.z };
      }
      return;
    }

    // 2. Interactable block interaction
    if (block?.interactable) {
      if (block.distance <= 5.5) {
        await api.openBlock(props.username, { x: block.x, y: block.y, z: block.z });
      } else {
        await api.moveTo(props.username, { x: block.x, y: block.y, z: block.z });
        targetMovePos.value = { x: block.x, y: block.y, z: block.z };
      }
      return;
    }

    // 3. Normal block or empty ground walk
    const botPose = props.data.pose;
    const targetX = block ? block.x : Math.round((botPose?.x ?? 0) + dx);
    const targetY = block ? block.y : (botPose?.y ?? 64);
    const targetZ = block ? block.z : Math.round((botPose?.z ?? 0) + dz);

    await api.moveTo(props.username, { x: targetX, y: targetY, z: targetZ });
    targetMovePos.value = { x: targetX, y: targetY, z: targetZ };
  } catch (err) {
    emit('error', String(err));
  }
}

// Context menu (Right Click)
async function onCanvasContextMenu() {
  if (!hoveredCell.value) return;
  const { block, entity } = hoveredCell.value;

  try {
    if (entity) {
      await api.interactEntity(props.username, entity.id);
    } else if (block) {
      await api.openBlock(props.username, { x: block.x, y: block.y, z: block.z });
    }
  } catch (err) {
    emit('error', String(err));
  }
}

// Actions
async function openBlock(b: { x: number; y: number; z: number }) {
  try {
    await api.openBlock(props.username, { x: b.x, y: b.y, z: b.z });
  } catch (err) {
    emit('error', String(err));
  }
}

async function walkTo(pos: { x: number; y?: number; z: number }) {
  try {
    await api.moveTo(props.username, pos);
    targetMovePos.value = { x: pos.x, y: pos.y ?? props.data.pose?.y ?? 64, z: pos.z };
  } catch (err) {
    emit('error', String(err));
  }
}

async function interactEntity(entityId: number) {
  try {
    await api.interactEntity(props.username, entityId);
  } catch (err) {
    emit('error', String(err));
  }
}


async function refreshWorld() {
  try {
    await api.scanWorld(props.username);
  } catch (err) {
    emit('error', String(err));
  }
}

async function useHeldItem() {
  try {
    await api.useHeldItem(props.username);
  } catch (err) {
    emit('error', String(err));
  }
}

async function selectHotbar(idx: number) {
  try {
    await api.selectSlot(props.username, idx);
  } catch (err) {
    emit('error', String(err));
  }
}

// Continuous movement & Step movement
const activeControls = ref<Record<string, boolean>>({});

async function startContinuousControl(control: ControlName) {
  if (activeControls.value[control]) return;
  activeControls.value[control] = true;
  try {
    await api.setControl(props.username, control, true);
  } catch (err) {
    emit('error', String(err));
  }
}

async function stopContinuousControl(control: ControlName) {
  if (!activeControls.value[control]) return;
  activeControls.value[control] = false;
  try {
    await api.setControl(props.username, control, false);
  } catch (err) {
    emit('error', String(err));
  }
}

async function triggerStep(control: ControlName) {
  try {
    await api.stepControl(props.username, control, 280);
  } catch (err) {
    emit('error', String(err));
  }
}

function releaseAllControls() {
  for (const [ctrl, active] of Object.entries(activeControls.value)) {
    if (active) {
      void api.setControl(props.username, ctrl as ControlName, false);
    }
  }
  activeControls.value = {};
}

async function lookDelta(dyaw: number, dpitch: number) {
  const currentYaw = props.data.pose?.yaw ?? 0;
  const currentPitch = props.data.pose?.pitch ?? 0;
  const newYaw = currentYaw + dyaw;
  const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, currentPitch + dpitch));
  try {
    await api.lookBot(props.username, newYaw, newPitch);
  } catch (err) {
    emit('error', String(err));
  }
}

// Keyboard handling
function handleKeyDown(e: KeyboardEvent) {
  if (props.modalOpen) return;
  const target = e.target as HTMLElement | null;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')) return;

  if (e.code === 'KeyW') { e.preventDefault(); void startContinuousControl('forward'); }
  else if (e.code === 'KeyS') { e.preventDefault(); void startContinuousControl('back'); }
  else if (e.code === 'KeyA') { e.preventDefault(); void startContinuousControl('left'); }
  else if (e.code === 'KeyD') { e.preventDefault(); void startContinuousControl('right'); }
  else if (e.code === 'Space') { e.preventDefault(); void startContinuousControl('jump'); }
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); void startContinuousControl('sneak'); }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'KeyW') void stopContinuousControl('forward');
  else if (e.code === 'KeyS') void stopContinuousControl('back');
  else if (e.code === 'KeyA') void stopContinuousControl('left');
  else if (e.code === 'KeyD') void stopContinuousControl('right');
  else if (e.code === 'Space') void stopContinuousControl('jump');
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') void stopContinuousControl('sneak');
}

// Bottom lists
const bottomTab = ref<'blocks' | 'entities'>('blocks');

const nearbyBlocks = computed(() => {
  const blocks = props.data.world?.blocks || [];
  return blocks
    .filter(b => Boolean(b.interactable) && b.distance <= 12.0)
    .sort((a, b) => a.distance - b.distance);
});

const nearbyEntities = computed(() => {
  const entities = props.data.world?.entities || [];
  return entities
    .slice()
    .sort((a, b) => a.distance - b.distance);
});

// Currently held item
const heldItem = computed(() => {
  return props.data.inventory.find(item => item.slot === props.data.selectedSlot + 36) ?? null;
});

// Resize observer
let resizeObserver: ResizeObserver | null = null;

watch([() => props.data.world, () => props.data.pose, layerFilter, headingMode], () => {
  requestRender();
});

onMounted(async () => {
  await nextTick();
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => requestRender());
    resizeObserver.observe(containerRef.value);
  }
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', releaseAllControls);
  requestRender();
});

onUnmounted(() => {
  releaseAllControls();
  if (resizeObserver) resizeObserver.disconnect();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('blur', releaseAllControls);
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
});
</script>

<template>
  <div class="iso-world-shell">
    <!-- Top HUD Bar -->
    <header class="iso-hud-bar">
      <div class="hud-left">
        <div class="hud-stat-pill" :title="L('Koordinatlar (X, Y, Z)', 'Coordinates (X, Y, Z)')">
          <AppIcon name="Map" :size="15" />
          <span class="hud-mono">
            {{ data.pose ? `${data.pose.x.toFixed(1)}, ${data.pose.y.toFixed(1)}, ${data.pose.z.toFixed(1)}` : '—, —, —' }}
          </span>
        </div>
        <div class="hud-stat-pill" :title="L('Bakış Açısı', 'Look Direction')">
          <span class="hud-mono">
            Yaw: {{ data.pose ? `${Math.round((data.pose.yaw * 180) / Math.PI)}°` : '0°' }}
          </span>
        </div>
        <div class="hud-badge health" :title="L('Can', 'Health')">
          <AppIcon name="Heart" :size="15" />
          <strong>{{ data.pose?.health !== undefined ? Math.round(data.pose.health) : 20 }}</strong>
        </div>
        <div class="hud-badge food" :title="L('Açlık', 'Food')">
          <AppIcon name="Drumstick" :size="15" />
          <strong>{{ data.pose?.food !== undefined ? Math.round(data.pose.food) : 20 }}</strong>
        </div>

        <!-- Physics Status Badge (Always Active) -->
        <span class="stat-pill physics-on"><AppIcon name="Zap" :size="14" /> {{ t('world.physicsOn') }}</span>

        <!-- Chunk loaded status badge -->
        <span
          v-if="data.pose?.chunkLoaded === false"
          class="hud-chunk-badge"
          :title="L('Bot henüz haritayı tam yüklemedi veya lobide bekleniyor', 'Bot has not fully loaded chunks yet or waiting in lobby')"
        >
          <AppIcon name="LoaderCircle" :size="14" /> {{ L('Lobi/Chunk Bekleniyor', 'Waiting for Lobby/Chunks') }}
        </span>
      </div>

      <div class="hud-center">
        <!-- Layer Filter Group -->
        <div class="hud-layer-group">
          <button
            type="button"
            class="hud-layer-btn"
            :class="{ active: layerFilter === 'auto' }"
            :title="L('Yürünebilir zemin ve sandıkları akıllıca gösterir', 'Smartly displays walkable ground and chests')"
            @click="layerFilter = 'auto'; requestRender()"
          >
            {{ L('Otomatik Yüzey', 'Auto Surface') }}
          </button>
          <button
            type="button"
            class="hud-layer-btn"
            :class="{ active: layerFilter === 'foot' }"
            :title="L('Ayak seviyesindeki bloklar (-1..0)', 'Blocks at feet level (-1..0)')"
            @click="layerFilter = 'foot'; requestRender()"
          >
            {{ L('Ayak (0..-1)', 'Feet (0..-1)') }}
          </button>
          <button
            type="button"
            class="hud-layer-btn"
            :class="{ active: layerFilter === 'head' }"
            :title="L('Baş seviyesindeki bloklar (+1..+2)', 'Blocks at head level (+1..+2)')"
            @click="layerFilter = 'head'; requestRender()"
          >
            {{ L('Baş (+1..+2)', 'Head (+1..+2)') }}
          </button>
          <button
            type="button"
            class="hud-layer-btn highlight"
            :class="{ active: layerFilter === 'interactable' }"
            :title="L('Sadece sandık, örs ve konteynerleri göster', 'Only show chests, anvils and containers')"
            @click="layerFilter = 'interactable'; requestRender()"
          >
            {{ L('Sadece Sandık/Örs', 'Chests/Anvils Only') }}
          </button>
        </div>

        <button
          type="button"
          class="hud-btn"
          :title="L('Çevredeki dünyayı yeniden tara', 'Scan surrounding world again')"
          :disabled="!connected"
          @click="refreshWorld"
        >
          <AppIcon name="RefreshCw" :size="15" /> {{ L('Yenile', 'Refresh') }}
        </button>
      </div>

      <div class="hud-right">
        <!-- Action Buttons -->
        <button
          type="button"
          class="hud-action-btn"
          :title="heldItem ? `${L('Eldeki eşyayı kullan:', 'Use held item:')} ${heldItem.customName || heldItem.displayName}` : L('Eldeki eşyayı kullan (Sağ tık)', 'Use held item (Right click)')"
          :disabled="!connected"
          @click="useHeldItem"
        >
          {{ L('Sağ Tık / Eşyayı Kullan', 'Right Click / Use Item') }}
        </button>
        <button
          type="button"
          class="hud-inv-btn"
          :title="L('Envanteri Aç (E)', 'Open Inventory (E)')"
          @click="emit('openInventory')"
        >
          <AppIcon name="Backpack" :size="16" /> {{ L('Envanter (E)', 'Inventory (E)') }}
        </button>
      </div>
    </header>

    <!-- Compact Hotbar Strip (Slots 1..9) directly below HUD -->
    <div class="hud-hotbar-strip">
      <span class="hotbar-label">{{ L('Hızlı Erişim:', 'Hotbar:') }}</span>
      <div class="hotbar-slots">
        <button
          v-for="idx in 9"
          :key="idx"
          type="button"
          class="hud-hotbar-slot"
          :class="{ active: data.selectedSlot === idx - 1 }"
          :title="`${L('Slot', 'Slot')} ${idx}: ${data.inventory.find(i => i.slot === 35 + idx)?.customName || data.inventory.find(i => i.slot === 35 + idx)?.displayName || L('Boş', 'Empty')}`"
          :disabled="!connected"
          @click="selectHotbar(idx - 1)"
        >
          <span class="slot-idx">{{ idx }}</span>
          <ItemIcon
            v-if="data.inventory.find(i => i.slot === 35 + idx)"
            :item="data.inventory.find(i => i.slot === 35 + idx)!"
          />
          <b v-if="(data.inventory.find(i => i.slot === 35 + idx)?.count ?? 0) > 1">
            {{ data.inventory.find(i => i.slot === 35 + idx)?.count }}
          </b>
        </button>
      </div>
      <div v-if="heldItem" class="held-item-tag">
        <small>{{ L('Eldeki:', 'Held:') }}</small>
        <strong>{{ heldItem.customName || heldItem.displayName }}</strong>
      </div>
    </div>

    <!-- 2B Top-Down Interactive Radar Canvas Container -->
    <div
      ref="containerRef"
      class="iso-canvas-container radar-mode"
      @mousemove="onCanvasMouseMove"
      @mouseleave="hoveredCell = null; requestRender()"
      @click="onCanvasClick"
      @contextmenu.prevent="onCanvasContextMenu"
    >
      <canvas ref="canvasRef" class="iso-canvas"></canvas>

      <!-- Hovered Cell / Entity Rich Info Card (Bottom-Left) -->
      <div v-if="hoveredCell" class="iso-block-tooltip">
        <!-- If Entity hovered -->
        <template v-if="hoveredCell.entity">
          <strong class="tooltip-title">{{ hoveredCell.entity.displayName }}</strong>
          <span class="tooltip-coords">
          <AppIcon :name="hoveredCell.entity.type === 'player' ? 'UserRound' : 'Bot'" :size="14" /> {{ hoveredCell.entity.type === 'player' ? L('Oyuncu', 'Player') : L('NPC / Varlık', 'NPC / Entity') }} ·
            ({{ hoveredCell.entity.x.toFixed(1) }}, {{ hoveredCell.entity.y.toFixed(1) }}, {{ hoveredCell.entity.z.toFixed(1) }}) ·
            {{ hoveredCell.entity.distance.toFixed(1) }}m
          </span>
          <em class="tooltip-action">
            {{ hoveredCell.entity.distance <= 5 ? L('Etkileşim (Sağ Tık) için tıkla', 'Click for Interaction (Right Click)') : L('Yanına yürümek için tıkla', 'Click to walk closer') }}
          </em>
        </template>

        <!-- If Block hovered -->
        <template v-else-if="hoveredCell.block">
          <strong class="tooltip-title">{{ hoveredCell.block.displayName }}</strong>
          <span class="tooltip-coords">
            ({{ hoveredCell.block.x }}, {{ hoveredCell.block.y }}, {{ hoveredCell.block.z }}) ·
            {{ hoveredCell.block.distance.toFixed(1) }}m · {{ L('Kot:', 'Y-Diff:') }} {{ hoveredCell.block.dy >= 0 ? `+${hoveredCell.block.dy}` : hoveredCell.block.dy }}
          </span>
          <em v-if="hoveredCell.block.interactable" class="tooltip-action">
            {{ hoveredCell.block.distance <= 5.5 ? L('Açmak için tıkla', 'Click to open') : L('Yanına yürümek için tıkla', 'Click to walk closer') }}
          </em>
          <em v-else class="tooltip-walk">
            {{ L('Buraya yürümek için tıkla', 'Click to walk here') }}
          </em>
        </template>

        <!-- Empty ground -->
        <template v-else>
          <strong class="tooltip-title">{{ L('Zemin / Boşluk', 'Ground / Space') }}</strong>
          <span class="tooltip-coords">Δ ({{ hoveredCell.dx }}, {{ hoveredCell.dz }})</span>
          <em class="tooltip-walk">{{ L('Buraya yürümek için tıkla', 'Click to walk here') }}</em>
        </template>
      </div>

      <!-- Radar Navigation Controls Overlay -->
      <div class="radar-controls-overlay">
        <button
          type="button"
          class="radar-toggle-btn"
          :class="{ active: headingMode === 'bot' }"
          :title="L('Kuzey sabit veya bot yönü görünümü', 'North locked or bot heading view')"
          @click="headingMode = headingMode === 'north' ? 'bot' : 'north'; requestRender()"
        >
          <AppIcon name="Compass" :size="15" /> {{ headingMode === 'north' ? L('Kuzey Sabit', 'North Locked') : L('Bot Yönü', 'Bot Heading') }}
        </button>
        <button
          v-if="targetMovePos"
          type="button"
          class="radar-clear-btn"
          :title="L('Hedef noktayı temizle', 'Clear destination target')"
          @click="targetMovePos = null; requestRender()"
        >
          <AppIcon name="X" :size="14" /> {{ L('Hedefi Temizle', 'Clear Target') }}
        </button>
      </div>
    </div>

    <!-- Bottom Strip: Nearby Interactables & Controls -->
    <div class="iso-bottom-bar">
      <!-- Left Panel: Nearby Blocks & Entities -->
      <section class="iso-nearby-panel">
        <div class="nearby-head">
          <div class="nearby-tab-buttons">
            <button
              type="button"
              class="nearby-tab-btn"
              :class="{ active: bottomTab === 'blocks' }"
              @click="bottomTab = 'blocks'"
            >
              <AppIcon name="Box" :size="15" /> {{ L('Sandık & Bloklar', 'Chests & Blocks') }} ({{ nearbyBlocks.length }})
            </button>
            <button
              type="button"
              class="nearby-tab-btn"
              :class="{ active: bottomTab === 'entities' }"
              @click="bottomTab = 'entities'"
            >
              <AppIcon name="UserRound" :size="15" /> {{ L('NPC & Oyuncular', 'NPCs & Players') }} ({{ nearbyEntities.length }})
            </button>
          </div>
        </div>

        <!-- Tab 1: Nearby Blocks -->
        <div v-if="bottomTab === 'blocks'" class="nearby-content">
          <div v-if="nearbyBlocks.length" class="nearby-list">
            <div
              v-for="b in nearbyBlocks"
              :key="`${b.x},${b.y},${b.z}`"
              class="nearby-item"
            >
              <span class="nearby-icon"><AppIcon :name="blockIcon(b.interactable)" :size="17" /></span>
              <div class="nearby-meta">
                <strong>{{ b.displayName }}</strong>
                <small>({{ b.x }}, {{ b.y }}, {{ b.z }}) · {{ b.distance.toFixed(1) }}m</small>
              </div>
              <div class="nearby-actions">
                <button
                  type="button"
                  class="nearby-btn open"
                  :disabled="!connected || b.distance > 5.5"
                  :title="b.distance > 5.5 ? L('Açmak için yaklaşmalısın (5.5m)', 'Must get closer to open (5.5m)') : L('Aç', 'Open')"
                  @click="openBlock(b)"
                >
                  <AppIcon name="ExternalLink" :size="14" /> {{ L('Aç', 'Open') }}
                </button>
                <button
                  type="button"
                  class="nearby-btn walk"
                  :disabled="!connected"
                  :title="L('Yanına yürü', 'Walk closer')"
                  @click="walkTo(b)"
                >
                  <AppIcon name="Footprints" :size="14" /> {{ L('Yürü', 'Walk') }}
                </button>
              </div>
            </div>
          </div>
          <p v-else class="nearby-empty">{{ L('Yakında açılabilir nesne yok (12m).', 'No interactable objects nearby (12m).') }}</p>
        </div>

        <!-- Tab 2: Nearby Entities / NPCs -->
        <div v-else class="nearby-content">
          <div v-if="nearbyEntities.length" class="nearby-list">
            <div
              v-for="e in nearbyEntities"
              :key="e.id"
              class="nearby-item"
            >
              <span class="nearby-icon"><AppIcon :name="e.type === 'player' ? 'UserRound' : 'Bot'" :size="17" /></span>
              <div class="nearby-meta">
                <strong>{{ e.displayName }}</strong>
                <small>{{ e.type === 'player' ? L('Oyuncu', 'Player') : 'NPC' }} · {{ e.distance.toFixed(1) }}m</small>
              </div>
              <div class="nearby-actions">
                <button
                  type="button"
                  class="nearby-btn open"
                  :disabled="!connected || e.distance > 5.0"
                  :title="e.distance > 5.0 ? L('Etkileşim için yaklaşmalısın (5m)', 'Must get closer to interact (5m)') : L('Etkileşim (Sağ Tık)', 'Interact (Right Click)')"
                  @click="interactEntity(e.id)"
                >
                  <AppIcon name="ExternalLink" :size="14" /> {{ L('Sağ Tık', 'Right Click') }}
                </button>
                <button
                  type="button"
                  class="nearby-btn walk"
                  :disabled="!connected"
                  :title="L('Yanına yürü', 'Walk closer')"
                  @click="walkTo({ x: e.x, y: e.y, z: e.z })"
                >
                  <AppIcon name="Footprints" :size="14" /> {{ L('Yürü', 'Walk') }}
                </button>
              </div>
            </div>
          </div>
          <p v-else class="nearby-empty">{{ L('Yakında NPC veya oyuncu yok.', 'No NPCs or players nearby.') }}</p>
        </div>
      </section>

      <!-- Right Panel: Hybrid Movement & Look Controls -->
      <section class="iso-controls-panel">
        <div class="controls-head">
          <h3>{{ L('Hareket & Bakış', 'Movement & Look') }}</h3>
          <span class="wasd-hint">{{ L('Klavye: WASD · Boşluk · Shift', 'Keyboard: WASD · Space · Shift') }}</span>
        </div>
        <div class="controls-content">
          <!-- Hybrid Movement D-Pad -->
          <div class="dpad-grid">
            <button
              type="button"
              class="dpad-btn up"
              :class="{ active: activeControls['forward'] }"
              :disabled="!connected"
              :title="L('İleri Yürü (Basılı tut veya 1 tıkla adım at)', 'Walk Forward (Hold or click to step)')"
              @mousedown="startContinuousControl('forward')"
              @mouseup="stopContinuousControl('forward')"
              @mouseleave="stopContinuousControl('forward')"
              @click="triggerStep('forward')"
            >
              {{ L('İleri (W)', 'Forward (W)') }}
            </button>
            <div class="dpad-row">
              <button
                type="button"
                class="dpad-btn left"
                :class="{ active: activeControls['left'] }"
                :disabled="!connected"
                :title="L('Sola Yürü (Basılı tut veya 1 tıkla adım at)', 'Walk Left (Hold or click to step)')"
                @mousedown="startContinuousControl('left')"
                @mouseup="stopContinuousControl('left')"
                @mouseleave="stopContinuousControl('left')"
                @click="triggerStep('left')"
              >
                {{ L('Sol (A)', 'Left (A)') }}
              </button>
              <button
                type="button"
                class="dpad-btn jump"
                :class="{ active: activeControls['jump'] }"
                :disabled="!connected"
                :title="L('Zıpla', 'Jump')"
                @mousedown="startContinuousControl('jump')"
                @mouseup="stopContinuousControl('jump')"
                @mouseleave="stopContinuousControl('jump')"
                @click="triggerStep('jump')"
              >
                {{ L('Zıpla', 'Jump') }}
              </button>
              <button
                type="button"
                class="dpad-btn right"
                :class="{ active: activeControls['right'] }"
                :disabled="!connected"
                :title="L('Sağa Yürü (Basılı tut veya 1 tıkla adım at)', 'Walk Right (Hold or click to step)')"
                @mousedown="startContinuousControl('right')"
                @mouseup="stopContinuousControl('right')"
                @mouseleave="stopContinuousControl('right')"
                @click="triggerStep('right')"
              >
                {{ L('Sağ (D)', 'Right (D)') }}
              </button>
            </div>
            <div class="dpad-row-sub">
              <button
                type="button"
                class="dpad-btn down"
                :class="{ active: activeControls['back'] }"
                :disabled="!connected"
                :title="L('Geri Yürü (Basılı tut veya 1 tıkla adım at)', 'Walk Back (Hold or click to step)')"
                @mousedown="startContinuousControl('back')"
                @mouseup="stopContinuousControl('back')"
                @mouseleave="stopContinuousControl('back')"
                @click="triggerStep('back')"
              >
                {{ L('Geri (S)', 'Back (S)') }}
              </button>
              <button
                type="button"
                class="dpad-btn sneak"
                :class="{ active: activeControls['sneak'] }"
                :disabled="!connected"
                :title="L('Eğil', 'Sneak')"
                @mousedown="startContinuousControl('sneak')"
                @mouseup="stopContinuousControl('sneak')"
                @mouseleave="stopContinuousControl('sneak')"
              >
                {{ L('Eğil', 'Sneak') }}
              </button>
            </div>
          </div>

          <!-- Look Direction Buttons -->
          <div class="look-grid">
            <span class="look-title">{{ L('Kamera Açısı', 'Camera Angle') }}</span>
            <div class="look-buttons">
              <button
                type="button"
                class="look-btn"
                :title="L('Sola Bak (45°)', 'Look Left (45°)')"
                :disabled="!connected"
                @click="lookDelta(-Math.PI / 4, 0)"
              >
                ↶ {{ L('Sol 45°', 'Left 45°') }}
              </button>
              <button
                type="button"
                class="look-btn"
                :title="L('Yukarı Bak', 'Look Up')"
                :disabled="!connected"
                @click="lookDelta(0, -0.3)"
              >
                ↑ {{ L('Yukarı', 'Up') }}
              </button>
              <button
                type="button"
                class="look-btn"
                :title="L('Aşağı Bak', 'Look Down')"
                :disabled="!connected"
                @click="lookDelta(0, 0.3)"
              >
                ↓ {{ L('Aşağı', 'Down') }}
              </button>
              <button
                type="button"
                class="look-btn"
                :title="L('Sağa Bak (45°)', 'Look Right (45°)')"
                :disabled="!connected"
                @click="lookDelta(Math.PI / 4, 0)"
              >
                ↷ {{ L('Sağ 45°', 'Right 45°') }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.stat-pill.physics-on {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(185, 244, 119, 0.15);
  border: 1px solid rgba(185, 244, 119, 0.35);
  border-radius: 6px;
  color: #b9f477;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 9px;
  user-select: none;
}
</style>
