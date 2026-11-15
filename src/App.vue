<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
const route = useRoute();
const splashUrl = `${import.meta.env.BASE_URL}Splash.png`;
const splash = ref(route.path === '/');
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => { if (splash.value) timer = setTimeout(() => { splash.value = false; }, 1300); });
onUnmounted(() => { if (timer) clearTimeout(timer); });
</script>
<template>
  <RouterView />
  <Transition name="splash"><div v-if="splash" class="splash-screen" role="status" aria-label="MynCraft açılıyor"><img :src="splashUrl" alt="MynCraft" /><span class="splash-loader"></span></div></Transition>
</template>
