<script setup lang="ts">
import { useRoute } from "vue-router";
const { username } = useRoute().params;

const exit = () => {
  window.electronAPI.requestWindowClose(username as string);
};
</script>
<template>
  <div>
    <div class="h-8 w-[calc(100dvw-24px)] flex flex-row justify-between">
      <div
        class="h-8 px-3 text-neutral-300 bg-neutral-500 rounded-lg bg-opacity-50 flex items-center justify-center"
      >
        <span>{{ username }}</span>
      </div>
      <div
        class="absolute left-1/2 -translate-x-1/2 h-8 px-3 font-bold text-neutral-300 bg-neutral-500 rounded-lg bg-opacity-50 flex items-center justify-center"
      >
        MynBot
      </div>

      <button
        @click="exit"
        class="h-8 px-3 text-neutral-300 bg-neutral-500 bg-opacity-50 hover:bg-opacity-80 cursor-pointer rounded-lg flex items-center justify-center gap-3"
      >
        <span>Exit</span>
        <span><i class="fa-solid fa-right-from-bracket"></i></span>
      </button>
    </div>
  </div>
</template>
<style scoped></style>
