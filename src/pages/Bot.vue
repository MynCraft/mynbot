<script setup lang="ts">
import { onMounted, Ref, ref } from "vue";
import NavbarContainer from "../components/Navbar/Container.vue";
import Titlebar from "../components/Titlebar.vue";
import { useRoute } from "vue-router";
const wallpaper: Ref<string> = ref("");
onMounted(() => {
  const number = Math.floor(Math.random() * 4) + 1;
  wallpaper.value = `url(/wallpapers/wallpaper${number}.jpg)`;
});
const route = useRoute();
console.log(route.params);
</script>
<template>
  <div>
    <div
      :style="{
        backgroundImage: wallpaper,
      }"
      class="h-dvh w-dvw bg-cover p-3 flex flex-col gap-3"
    >
      <Titlebar />
      <div
        class="h-[calc(100dvh-68px)] w-[calc(100dvw-24px)] flex flex-row gap-3"
      >
        <NavbarContainer />
        <div
          class="h-[calc(100dvh-68px)] w-[calc(100dvw-184px)] bg-neutral-500 rounded-lg bg-opacity-50 p-3"
        >
          <RouterView />
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped></style>
