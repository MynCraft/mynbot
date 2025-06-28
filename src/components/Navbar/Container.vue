<script setup lang="ts">
import { useRoute } from "vue-router";
import NavbarItem from "./NavbarItem.vue";
const { username } = useRoute().params as { username: string };
</script>
<template>
  <div>
    <div
      class="h-[calc(100dvh-68px)] w-40 bg-neutral-500 rounded-lg bg-opacity-50 p-2 flex flex-col gap-1"
    >
      <NavbarItem title="Bot" path="home">
        <i class="fa-solid fa-robot"></i>
      </NavbarItem>
      <NavbarItem title="Chat" path="chat">
        <i class="fa-solid fa-comments"></i>
      </NavbarItem>
      <NavbarItem title="Inventory" path="inventory">
        <i class="fa-solid fa-box"></i>
      </NavbarItem>
      <NavbarItem title="Plugins" path="plugins">
        <i class="fa-solid fa-plug"></i>
      </NavbarItem>
      <div class="m-auto"></div>
    </div>
  </div>
</template>
<style scoped></style>
