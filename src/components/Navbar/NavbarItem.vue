<script setup lang="ts">
import { useRoute } from "vue-router";
import router from "../../router";
import { ref } from "vue";

const props = defineProps<{ title: string; path: string }>();
const username = (useRoute().params as { username: string }).username;
const pPath = ref(`/bot/${username}/${props.path}`);
</script>
<template>
  <button @click="() => router.push(pPath)">
    <div
      :class="`${
        $route.path == pPath ? ' bg-opacity-85' : ' bg-opacity-40'
      }  bg-neutral-300 rounded-md py-1 px-2 cursor-pointer hover:bg-opacity-70 text-neutral-600 flex flex-row justify-start items-center gap-1 `"
    >
      <span><slot /></span>
      <span>{{ title }}</span>
    </div>
  </button>
</template>
<style scoped></style>
