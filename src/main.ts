import { createApp } from 'vue'
import App from './App.vue'
import "./index.css"
import 'flowbite';
import router from './router'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router);
app.mount('#app').$nextTick(() => {
  window.ipcRenderer.on('main-process-message', (_event, message) => {
    console.log(message)
  })
})
