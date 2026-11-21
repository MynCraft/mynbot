<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChatSegment, LoginPatternAction, LoginPatternRule, LoginPromptEntry, LoginPromptSource } from '../../types/bot';
import { buildLoginPattern, testLoginPattern } from '../../utils/chatPatternBuilder';
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{ username: string; connected: boolean; patterns: LoginPatternRule[] }>();
const emit = defineEmits<{ add: [rule: LoginPatternRule]; remove: [id: string] }>();
const store = useBotStore();
const { L } = useI18n();

const liveEntries = computed<LoginPromptEntry[]>(() => {
  const data = store.data[props.username];
  if (data?.loginPrompts?.length) return data.loginPrompts.slice(-25);
  return (data?.chat || []).slice(-25).map((entry, idx) => ({
    id: entry.id || `c-${idx}-${entry.text.slice(0, 16)}`,
    text: entry.text,
    source: 'chat' as const,
    at: 0,
    ...(entry.segments ? { segments: entry.segments } : {}),
  }));
});

const frozen = ref(false);
const frozenEntries = ref<LoginPromptEntry[]>([]);
const recentEntries = computed<LoginPromptEntry[]>(() => (frozen.value ? frozenEntries.value : liveEntries.value));
const selectedIds = ref<string[]>([]);
const patternAction = ref<LoginPatternAction>('login');
const patternName = ref('');
const triggerText = ref('');

function toggleFreeze() {
  if (!frozen.value) {
    frozenEntries.value = [...liveEntries.value];
    frozen.value = true;
  } else {
    frozen.value = false;
    frozenEntries.value = [];
  }
}

function toggleLine(id: string) {
  const pos = selectedIds.value.indexOf(id);
  if (pos >= 0) selectedIds.value.splice(pos, 1);
  else if (selectedIds.value.length < 8) selectedIds.value.push(id);
}

const selectedEntries = computed(() =>
  recentEntries.value.filter(entry => selectedIds.value.includes(entry.id))
);
const selectedLines = computed(() => selectedEntries.value.map(entry => entry.text.trim()));

const suggestedTrigger = computed(() => {
  if (triggerText.value.trim() || !selectedLines.value.length) return '';
  const joined = selectedLines.value.join(' ');
  const cmdMatch = /(\/(?:login|register|l|reg))\b/i.exec(joined);
  if (cmdMatch) return cmdMatch[1];
  const kwMatch = /\b(giriş|kayıt|login|register|şifre|password)\b/i.exec(joined);
  return kwMatch ? kwMatch[1] : '';
});

function sourceLabel(source: LoginPromptSource): string {
  switch (source) {
    case 'title': return 'Title';
    case 'subtitle': return 'Subtitle';
    case 'actionbar': return 'Actionbar';
    default: return 'Chat';
  }
}

function segmentStyle(seg: ChatSegment) {
  return {
    color: seg.color || '#ffffff',
    fontWeight: seg.bold ? 'bold' : undefined,
    fontStyle: seg.italic ? 'italic' : undefined,
    textDecoration: [seg.underlined ? 'underline' : '', seg.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
  };
}

const preview = computed(() => {
  if (!selectedLines.value.length) return null;
  const built = buildLoginPattern({
    lines: selectedLines.value,
    triggerText: triggerText.value,
    action: patternAction.value,
    name: patternName.value,
  });
  if (!built.rule) return { error: built.error };
  const test = testLoginPattern(built.rule, selectedLines.value);
  return { rule: built.rule, test };
});

function savePattern() {
  if (!preview.value?.rule || !preview.value.test?.matched) return;
  emit('add', preview.value.rule);
  selectedIds.value = [];
  patternName.value = '';
  triggerText.value = '';
}
</script>

<template>
  <section class="panel-card plugin-module-card">
    <div class="module-head">
      <div>
        <h3>{{ L('Giriş / Kayıt Kalıbı Kalibratörü', 'Login / Register Pattern Calibrator') }}</h3>
        <p>{{ L('Sunucunun giriş veya kayıt istediği tek ya da çok satırlı sohbet, Title veya Actionbar mesajını seçerek otomatik algılamayı öğret.', 'Teach automatic detection by selecting the single or multi-line chat, Title, or Actionbar prompt requesting login or registration.') }}</p>
      </div>
    </div>

    <div class="calibrator-chat-box">
      <div class="calibrator-chat-head">
        <span>{{ L('Gelen Mesajlardan Seç (Chat / Title / Actionbar)', 'Select from Incoming Prompts (Chat / Title / Actionbar)') }} ({{ selectedLines.length }} {{ L('satır seçili', 'lines selected') }})</span>
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
          :class="{ chosen: selectedIds.includes(entry.id) }"
        >
          <input type="checkbox" :checked="selectedIds.includes(entry.id)" @change="toggleLine(entry.id)" />
          <span class="pattern-meta" style="margin-right: 6px; opacity: 0.8;">[{{ sourceLabel(entry.source) }}]</span>
          <span class="calibrator-line-text">
            <template v-if="entry.segments?.length">
              <span
                v-for="(seg, j) in entry.segments"
                :key="j"
                :style="segmentStyle(seg)"
              >{{ j === 0 ? seg.text.trimStart() : seg.text }}</span>
            </template>
            <template v-else>{{ entry.text.trimStart() }}</template>
          </span>
        </label>
      </div>
      <p v-else class="empty-copy">
        {{ connected ? L('Henüz gelen sohbet, Title veya Actionbar satırı yok. Sunucudan giriş/kayıt mesajı geldiğinde burada görünür.', 'No incoming chat, Title, or Actionbar lines yet. Server login/register prompts will appear here.') : L('Canlı mesaj satırlarını görmek için sunucuya bağlan.', 'Connect to server to view live prompt lines.') }}
      </p>
    </div>

    <div class="fields calibrator-fields">
      <div>
        <label for="lpat-action">{{ L('Komut Türü (Action)', 'Command Type (Action)') }}</label>
        <select id="lpat-action" v-model="patternAction">
          <option value="login">{{ L('Giriş Yap (/login)', 'Login (/login)') }}</option>
          <option value="register">{{ L('Kayıt Ol (/register)', 'Register (/register)') }}</option>
        </select>
      </div>
      <div>
        <label for="lpat-name">{{ L('Kalıp Adı (isteğe bağlı)', 'Pattern Name (optional)') }}</label>
        <input id="lpat-name" v-model="patternName" maxlength="64" :placeholder="L('Örn: Sunucu Giriş Mesajı', 'e.g. Server Login Message')" />
      </div>
      <div>
        <label for="lpat-trigger">{{ L('Anahtar İbare (isteğe bağlı)', 'Key Phrase (optional)') }}</label>
        <input id="lpat-trigger" v-model="triggerText" maxlength="128" :placeholder="L('Örn: /login veya giriş yap', 'e.g. /login or please login')" />
        <button
          v-if="suggestedTrigger"
          type="button"
          class="secondary compact"
          style="margin-top: 4px;"
          @click="triggerText = suggestedTrigger"
        >
          {{ L('Önerilen:', 'Suggested:') }} {{ suggestedTrigger }}
        </button>
      </div>
    </div>

    <div v-if="preview" class="calibrator-preview">
      <p v-if="preview.error" class="calibrator-err">{{ preview.error }}</p>
      <p v-else-if="preview.test?.matched" class="calibrator-ok">
        {{ L('Algılandı', 'Detected') }} ({{ preview.rule?.lineCount }} {{ L('satır', 'lines') }}) <AppIcon name="ArrowRight" :size="14" />
        <strong>{{ preview.test.action === 'register' ? L('Kayıt Komutu Tetiklenecek', 'Register Command Will Trigger') : L('Giriş Komutu Tetiklenecek', 'Login Command Will Trigger') }}</strong>
      </p>
      <button
        type="button"
        class="panel-connect compact"
        :disabled="!preview.test?.matched"
        @click="savePattern"
      >
        {{ L('Kalıbı Kaydet', 'Save Pattern') }}
      </button>
    </div>

    <div v-if="patterns.length" class="script-list">
      <div v-for="pat in patterns" :key="pat.id" class="script-row">
        <div class="script-toggle">
          <strong>{{ pat.name }}</strong>
          <small class="pattern-meta">
            {{ pat.action === 'register' ? L('Kayıt Ol (/register)', 'Register (/register)') : L('Giriş Yap (/login)', 'Login (/login)') }} · {{ pat.lineCount }} {{ L('satır', 'lines') }}
            <template v-if="pat.triggerText"> · "{{ pat.triggerText }}"</template>
          </small>
        </div>
        <button type="button" class="delete-bot" :title="L('Kalıbı sil', 'Delete pattern')" :aria-label="L('Kalıbı sil', 'Delete pattern')" @click="emit('remove', pat.id)"><AppIcon name="Trash2" :size="15" /></button>
      </div>
    </div>
  </section>
</template>
