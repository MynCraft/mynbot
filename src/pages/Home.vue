<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useBotStore } from "../store/botStore";
import BotList from "../components/BotList/Container.vue";
import ToastContainer from "../components/ToastContainer.vue";
const botStore = useBotStore();
const username = ref("");
const splashGone = ref(false);
const toastRef = ref();

function triggerError(msg: string) {
  toastRef.value?.showToast(msg, "error");
}
onMounted(() => {
  setTimeout(() => {
    splashGone.value = true;
  }, 500);
});
const click = () => {
  botStore.addBot(username.value);
  window.electronAPI.openBotWindow(username.value);
  username.value = "";
};
const close = () => {
  window.ipcRenderer.send("close-window");
};
const openGithub = () => {
  window.electronAPI.openExternal("https://github.com/MynCraft");
};
</script>
<template>
  <div>
    <ToastContainer ref="toastRef" />
    <div
      style="background-image: url('/wallpapers/homeWallpaper.jpg')"
      class="w-dvw h-dvh bg-cover bg-center flex flex-col items-center"
    >
      <div
        class="h-6 bg-neutral-300 w-dvw bg-opacity-30 flex flex-row justify-between items-center px-2"
      >
        <span
          class="absolute left-1/2 -translate-x-1/2 text-white cursor-default select-none"
          >MynBot</span
        >
        <span></span>
        <button @click="close">
          <i class="fa-solid fa-circle-xmark text-red-600 cursor-pointer"></i>
        </button>
      </div>
      <div class="flex flex-col items-center py-7">
        <button @click="openGithub">
          <img src="/MynCraft.png" alt="" class="w-32 rounded-3xl opacity-90" />
        </button>
        <div
          class="w-56 flex flex-col items-start mt-4 gap-2 bg-neutral-500 backdrop-blur-sm bg-opacity-20 p-3 rounded-xl"
        >
          <input
            spellcheck="false"
            type="text"
            v-model="username"
            placeholder="Username"
            class="bg-transparent border-b border-white focus:outline-none"
            @keypress="
              (e) => {
                if (e.key === 'Enter') {
                  click();
                }
              }
            "
          />
          <div class="flex flex-row gap-2 items-center justify-between w-full">
            <button
              @click="click"
              class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-xl transition duration-200 flex flex-row items-center gap-1 justify-center"
            >
              <i class="fa-solid fa-circle-plus"></i> Create Bot
            </button>
            <button
              @click="openGithub"
              class="bg-neutral-700 bg-opacity-70 hover:bg-opacity-40 text-white p-1 rounded-xl transition duration-200 flex flex-row items-center gap-1 justify-center"
            >
              <i class="fa-brands fa-github"></i>
              Github
            </button>
          </div>
        </div>
      </div>
      <div>
        <BotList :triggerError="triggerError" />
      </div>
    </div>
    <img
      src="/Splash.png"
      alt="Loading..."
      class="splash-screen fixed inset-0 z-50 bg-black text-white flex items-center justify-center text-4xl font-bold transition-opacity duration-1000"
      :class="{ 'opacity-0 pointer-events-none': splashGone }"
    />
  </div>
</template>
<style scoped></style>
