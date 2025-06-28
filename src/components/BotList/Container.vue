<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useBotStore } from "../../store/botStore";
import BotListItem from "./Item.vue";
const botStore = useBotStore();
const bots = computed(() => Object.values(botStore.bots));
console.log(bots.value);
defineProps<{
  triggerError?: (message: string) => void;
}>();
const openUsernames = ref<string[]>([]);
onMounted(() => {
  setInterval(async () => {
    const windows = (await window.ipcRenderer.invoke("get-open-windows")) as {
      url: string;
    }[];
    const a = windows
      .map((win) => {
        let w = win.url.split("/");
        return w[w.length - 2];
      })
      .filter((win) => win !== "#");
    openUsernames.value = a;
  }, 1000);
});
</script>
<template>
  <div>
    <div
      class="scroll-area max-h-52 w-56 flex flex-col items-start gap-1 bg-neutral-500 backdrop-blur-sm bg-opacity-20 p-2 rounded-xl overflow-auto"
    >
      <div v-if="bots.length === 0" class="text-white">No bots available</div>
      <BotListItem
        v-for="bot in bots"
        :key="bot.username"
        :isOpen="openUsernames.includes(bot.username)"
        :username="bot.username"
        :trigError="triggerError"
      />
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
}

.scroll-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
</style>
