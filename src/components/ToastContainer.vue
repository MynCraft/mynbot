<template>
  <Transition name="fade">
    <div
      v-if="visible"
      :class="[
        'fixed right-4 top-10 z-10 max-w-xs p-2 rounded-lg shadow-sm flex items-center  text-sm',
        type === 'success'
          ? 'bg-green-100 text-green-700'
          : type === 'error'
          ? 'bg-red-100 text-red-700'
          : type === 'warning'
          ? 'bg-orange-100 text-orange-700'
          : 'bg-gray-100 text-gray-700',
      ]"
    >
      <div class="me-2">
        <slot>{{ message }}</slot>
      </div>
      <button @click="hide" class="ms-auto text-xl leading-none">×</button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from "vue";

const visible = ref(false);
const message = ref("");
const type = ref<"success" | "error" | "warning" | "info">("info");

function showToast(msg: string, t: typeof type.value = "info", timeout = 3000) {
  message.value = msg;
  type.value = t;
  visible.value = true;
  setTimeout(() => {
    visible.value = false;
  }, timeout);
}

function hide() {
  visible.value = false;
}

defineExpose({ showToast });
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
