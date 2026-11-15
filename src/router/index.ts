import { createRouter, createWebHashHistory } from 'vue-router';
import BotManagementView from '../views/BotManagementView.vue';
import BotView from '../views/BotView.vue';
export default createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', component: BotManagementView },
  { path: '/bot/:username', component: BotView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
] });
