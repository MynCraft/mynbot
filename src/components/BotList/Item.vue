<script setup lang="ts">
import { useBotStore } from "../../store/botStore";
const props = defineProps<{
  username: string;
  isOpen: boolean;
  trigError?: (message: string) => void;
}>();
const botStore = useBotStore();
const deleteBot = () => {
  if (props.isOpen) {
    props.trigError?.("Bot is currently open, close it first!");
  } else botStore.deleteBot(props.username);
};

const openBotWindow = () => {
  if (props.isOpen) {
    props.trigError?.("Bot already open!");
  } else window.electronAPI.openBotWindow(props.username);
};
</script>
<template>
  <div class="flex items-center justify-between w-full gap-1">
    <button
      @click="openBotWindow"
      class="text-white bg-neutral-500 bg-opacity-20 backdrop-blur-sm py-1 px-2 w-full rounded-lg flex items-center gap-2 cursor-pointer hover:bg-opacity-30 transition duration-200"
    >
      <span>{{ username }}</span>
    </button>
    <div
      class="flex items-center gap-2 bg-neutral-500 bg-opacity-20 backdrop-blur-sm py-1 px-2 rounded-lg"
    >
      <i
        class="fa-regular fa-circle-dot text-sm"
        :class="{ 'text-green-500': isOpen, 'text-neutral-400': !isOpen }"
      ></i>

      <button
        @click="deleteBot"
        class="text-red-600 hover:text-red-800 transition duration-200"
      >
        <i class="fa-solid fa-trash-can text-red-600 text-sm"></i>
      </button>
    </div>
  </div>
</template>
<style scoped></style>
