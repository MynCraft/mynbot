<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChatEntry, LoginPatternAction, LoginPatternRule } from '../../types/bot';
import { buildLoginPattern, testLoginPattern } from '../../utils/chatPatternBuilder';
import { useBotStore } from '../../store/botStore';
import { useI18n } from '../../i18n';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps<{ username: string; connected: boolean; patterns: LoginPatternRule[] }>();
const emit = defineEmits<{ add: [rule: LoginPatternRule]; remove: [id: string] }>();
const store = useBotStore();
const { L } = useI18n();

const recentEntries = computed<ChatEntry[]>(() => (store.data[props.username]?.chat || []).slice(-25));
const recentChat = computed(() => recentEntries.value.map(entry => entry.text.trim()));
const selectedIndices = ref<number[]>([]);
const patternAction = ref<LoginPatternAction>('login');
const patternName = ref('');
const triggerText = ref('');

function toggleLine(index: number) {
  const pos = selectedIndices.value.indexOf(index);
  if (pos >= 0) selectedIndices.value.splice(pos, 1);
  else if (selectedIndices.value.length < 8) selectedIndices.value.push(index);
  selectedIndices.value.sort((a, b) => a - b);
}

const selectedLines = computed(() =>
  selectedIndices.value
    .filter(i => i >= 0 && i < recentChat.value.length)
    .map(i => recentChat.value[i])
);

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
  selectedIndices.value = [];
  patternName.value = '';
  triggerText.value = '';
}
</script>

<template>
  <section class="panel-card plugin-module-card">
    <div class="module-head">
      <div>
        <h3>{{ L('Giriş / Kayıt Kalıbı Kalibratörü', 'Login / Register Pattern Calibrator') }}</h3>
        <p>{{ L('Sunucunun giriş veya kayıt istediği tek ya da çok satırlı sohbet mesajını seçerek otomatik algılamayı öğret.', 'Teach automatic detection by selecting the single or multi-line server prompt requesting login or registration.') }}</p>
      </div>
    </div>

    <div class="calibrator-chat-box">
      <div class="calibrator-chat-head">
        <span>{{ L('Anlık Sohbetten Giriş Mesajı Seç', 'Select Login Message from Live Chat') }} ({{ selectedLines.length }} {{ L('satır seçili', 'lines selected') }})</span>
        <button v-if="selectedLines.length" type="button" class="secondary compact" @click="selectedIndices = []">{{ L('Seçimi temizle', 'Clear selection') }}</button>
      </div>
      <div v-if="recentEntries.length" class="calibrator-lines mc-chat-output">
        <label
          v-for="(entry, index) in recentEntries"
          :key="`${index}-${entry.text.slice(0, 16)}`"
          class="calibrator-line"
          :class="{ chosen: selectedIndices.includes(index) }"
        >
          <input type="checkbox" :checked="selectedIndices.includes(index)" @change="toggleLine(index)" />
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
        {{ connected ? L('Henüz gelen sohbet satırı yok. Sunucudan giriş/kayıt mesajı geldiğinde burada görünür.', 'No incoming chat lines yet. Server login/register prompts will appear here.') : L('Canlı sohbet satırlarını görmek için sunucuya bağlan.', 'Connect to server to view live chat lines.') }}
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
