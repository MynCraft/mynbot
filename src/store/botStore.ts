import { defineStore } from 'pinia';
import type { BotConfig, BotData, BotStatus, PluginScriptInfo } from '../types/bot';

export const useBotStore = defineStore('bots', {
  state: () => ({
    bots: [] as BotConfig[],
    openWindows: [] as string[],
    statuses: {} as Record<string, BotStatus>,
    data: {} as Record<string, BotData>,
    pluginsDir: '',
    pluginScripts: [] as PluginScriptInfo[],
    error: '',
  }),
  actions: {
    async refresh() {
      try {
        const data = await window.electronAPI.snapshot();
        this.bots = data.bots;
        this.openWindows = data.openWindows;
        this.statuses = data.statuses;
        this.data = data.data;
        this.pluginsDir = data.pluginsDir;
        this.pluginScripts = data.pluginScripts;
        this.error = '';
      } catch (error) {
        this.error = String(error);
      }
    },
    async addBot(bot: BotConfig) { await window.electronAPI.addBot(bot); await this.refresh(); },
    async deleteBot(username: string) { await window.electronAPI.deleteBot(username); await this.refresh(); },
  },
});
