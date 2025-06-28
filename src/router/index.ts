import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        { path: "/", name: "Home", component: () => import("./../pages/Home.vue") },
        {
            path: "/bot/:username", name: "Bot", component: () => import("./../pages/Bot.vue"), children: [
                { path: "home", name: "BotHome", component: () => import("./../pages/Bot/Home.vue") },
                { path: "chat", name: "BotChat", component: () => import("./../pages/Bot/Chat.vue") },
                { path: "plugins", name: "BotPlugins", component: () => import("./../pages/Bot/Plugins.vue") },
                { path: "inventory", name: "BotInventory", component: () => import("./../pages/Bot/Inventory.vue") },
                { path: ":pathMatch(.*)*", redirect: "/home" }

            ]
        },
        { path: "/settings", name: "Settings", component: () => import("./../pages/Settings.vue") }
    ],
})

export default router