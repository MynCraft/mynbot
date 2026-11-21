<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChatEntry, ChatPatternRule, ChatPatternType } from '../../types/bot';
import { buildChatPattern, testChatPattern } from '../../utils/chatPatternBuilder';
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{ username: string; connected: boolean; patterns: ChatPatternRule[] }>();
const emit = defineEmits<{ add: [rule: ChatPatternRule]; remove: [id: string] }>();
const store = useBotStore();
const { L } = useI18n();

const liveEntries = computed<ChatEntry[]>(() =>
  (store.data[props.username]?.chat || []).slice(-25).map((entry, idx) => ({
    ...entry,
    id: entry.id || `c-${idx}-${entry.text.slice(0, 16)}`,
  }))
);
const frozen = ref(false);
const frozenEntries = ref<ChatEntry[]>([]);
const recentEntries = computed<ChatEntry[]>(() => (frozen.value ? frozenEntries.value : liveEntries.value));
const selectedIds = ref<string[]>([]);
const patternType = ref<ChatPatternType>('pm');
const patternName = ref('');
const senderText = ref('');
const messageText = ref('');
const magicCode = ref('');
const listeningMagic = ref(false);
const copied = ref(false);

function toggleFreeze() {
  if (!frozen.value) {
    frozenEntries.value = [...liveEntries.value];
    frozen.value = true;
  } else {
    frozen.value = false;
    frozenEntries.value = [];
  }
}

function generateMagicCode() {
  const code = `MYN${Math.floor(1000 + Math.random() * 9000)}`;
  magicCode.value = code;
  messageText.value = code;
  listeningMagic.value = true;
  copied.value = false;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(code).then(() => { copied.value = true; }).catch(() => {});
  }
}

watch(
  () => liveEntries.value.length,
  () => {
    if (!listeningMagic.value || !magicCode.value) return;
    const match = liveEntries.value.find(entry => entry.text.includes(magicCode.value));
    if (match?.id) {
      if (frozen.value) {
        frozen.value = false;
        frozenEntries.value = [];
      }
      selectedIds.value = [match.id];
      listeningMagic.value = false;
    }
  }
);

function toggleLine(id: string) {
  const pos = selectedIds.value.indexOf(id);
  if (pos >= 0) selectedIds.value.splice(pos, 1);
  else selectedIds.value.push(id);
}

const selectedLines = computed(() =>
  recentEntries.value
    .filter(entry => entry.id && selectedIds.value.includes(entry.id))
    .map(entry => entry.text.trim())
);

const preview = computed(() => {
  if (!selectedLines.value.length) return null;
  const built = buildChatPattern({
    lines: selectedLines.value,
    senderText: senderText.value,
    messageText: messageText.value,
    type: patternType.value,
    name: patternName.value,
  });
  if (!built.rule) return { error: built.error };
  const test = testChatPattern(built.rule, selectedLines.value);
  return { rule: built.rule, test };
});

function savePattern() {
  if (!preview.value?.rule || !preview.value.test?.matched) return;
  emit('add', preview.value.rule);
  selectedIds.value = [];
  patternName.value = '';
  messageText.value = '';
  magicCode.value = '';
  listeningMagic.value = false;
}
</script>

<template>
  <section class="panel-card plugin-module-card">
    <div class="module-head">
      <div>
        <h3>{{ L('Sohbet & Özel Mesaj Tanıma (Sihirli Kod / Toplu Seçim)', 'Chat & Private Message Detection (Magic Code / Batch Selection)') }}</h3>
        <p>{{ L('Sunucunun özel veya çok satırlı (ör. 5 satırlık PM) sohbet biçimini regex yazmadan öğret.', 'Train custom or multi-line server chat formats (e.g. 5-line PM) without writing regex.') }}</p>
      </div>
      <div class="plugins-toolbar">
        <button type="button" class="secondary compact" @click="generateMagicCode">
          {{ listeningMagic ? `${L('Dinleniyor:', 'Listening:')} ${magicCode}` : L('Sihirli kod üret', 'Generate magic code') }}
        </button>
      </div>
    </div>

    <p v-if="magicCode" class="magic-hint">
      {{ L('Kod:', 'Code:') }} <code>{{ magicCode }}</code>
      <span v-if="copied"> ({{ L('panoya kopyalandı', 'copied to clipboard') }})</span> — {{ L('Oyundan normal sohbete veya', 'Send in normal game chat or via') }} <code>/msg {{ username }} {{ magicCode }}</code> {{ L('ile gönder.', '.') }}
      <span v-if="listeningMagic"> {{ L('Yeni mesaj bekleniyor…', 'Waiting for new message…') }}</span>
    </p>

    <div class="calibrator-chat-box">
      <div class="calibrator-chat-head">
        <span>{{ L('Anlık Sohbetten Satır Seç', 'Select Lines from Live Chat') }} ({{ selectedLines.length }} {{ L('satır seçili', 'lines selected') }})</span>
        <div class="plugins-toolbar">
          <button type="button" class="secondary compact" @click="toggleFreeze">
            {{ frozen ? L('Listeyi çöz', 'Unfreeze list') : L('Listeyi dondur', 'Freeze list') }}
          </button>
          <button v-if="selectedLines.length" type="button" class="secondary compact" @click="selectedIds = []">{{ L('Seçimi temizle', 'Clear selection') }}</button>
        </div>
      </div>
      <div v-if="recentEntries.length" class="calibrator-lines mc-chat-output">
        <label
          v-for="entry in recentEntries"
          :key="entry.id"
          class="calibrator-line"
          :class="{ chosen: entry.id && selectedIds.includes(entry.id), magic: magicCode && entry.text.includes(magicCode) }"
        >
          <input type="checkbox" :checked="Boolean(entry.id && selectedIds.includes(entry.id))" @change="entry.id && toggleLine(entry.id)" />
          <span class="calibrator-line-text">
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
              >{{ j === 0 ? seg.text.trimStart() : seg.text }}</span>
            </template>
            <template v-else>{{ entry.text.trimStart() }}</template>
          </span>
        </label>
      </div>
      <p v-else class="empty-copy">
        {{ connected ? L('Henüz gelen sohbet satırı yok. Oyundan bir mesaj veya sihirli kodu gönder.', 'No incoming chat lines yet. Send a message or the magic code from the game.') : L('Canlı sohbet satırlarını görmek için sunucuya bağlan.', 'Connect to server to view live chat lines.') }}
      </p>
    </div>

    <div class="fields calibrator-fields">
      <div>
        <label for="pat-type">{{ L('Mesaj türü', 'Message type') }}</label>
        <select id="pat-type" v-model="patternType">
          <option value="pm">{{ L('Özel Mesaj (PM)', 'Private Message (PM)') }}</option>
          <option value="chat">{{ L('Genel Sohbet', 'Global Chat') }}</option>
        </select>
      </div>
      <div>
        <label for="pat-name">{{ L('Kalıp adı (isteğe bağlı)', 'Pattern name (optional)') }}</label>
        <input id="pat-name" v-model="patternName" maxlength="64" :placeholder="L('Örn: Sunucu PM (5 satır)', 'e.g. Server PM (5 lines)')" />
      </div>
      <div>
        <label for="pat-sender">{{ L('Gönderen oyuncu adı (varsa)', 'Sender name (if any)') }}</label>
        <input id="pat-sender" v-model="senderText" maxlength="32" :placeholder="L('Örn: Ahmet', 'e.g. PlayerName')" />
      </div>
      <div>
        <label for="pat-message">{{ L('Seçilen bloktaki asıl mesaj', 'Actual message in selected block') }}</label>
        <input id="pat-message" v-model="messageText" maxlength="200" :placeholder="L('Örn: MYN4821 veya selam', 'e.g. MYN4821 or hello')" />
      </div>
    </div>

    <div v-if="preview" class="calibrator-preview">
      <p v-if="preview.error" class="calibrator-err">{{ preview.error }}</p>
      <p v-else-if="preview.test?.matched" class="calibrator-ok">
        {{ L('Algılandı', 'Detected') }} ({{ preview.rule?.lineCount }} {{ L('satır', 'lines') }}) <AppIcon name="ArrowRight" :size="14" />
        {{ L('Gönderen:', 'Sender:') }} <strong>{{ preview.test.sender || '—' }}</strong> ·
        {{ L('Mesaj:', 'Message:') }} <strong>{{ preview.test.message }}</strong>
      </p>
      <button
        type="button"
        class="panel-connect compact"
        :disabled="!preview.test?.matched"
        @click="savePattern"
      >
        {{ L('Kalıbı kaydet', 'Save pattern') }}
      </button>
    </div>

    <div v-if="patterns.length" class="script-list">
      <div v-for="pat in patterns" :key="pat.id" class="script-row">
        <div class="script-toggle">
          <strong>{{ pat.name }}</strong>
          <small class="pattern-meta">
            {{ pat.type === 'pm' ? L('Özel Mesaj', 'Private Message') : L('Genel Sohbet', 'Global Chat') }} · {{ pat.lineCount }} {{ L('satır', 'lines') }}
          </small>
        </div>
        <button type="button" class="delete-bot" :title="L('Kalıbı sil', 'Delete pattern')" :aria-label="L('Kalıbı sil', 'Delete pattern')" @click="emit('remove', pat.id)"><AppIcon name="Trash2" :size="15" /></button>
      </div>
    </div>
  </section>
</template>
