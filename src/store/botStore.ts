
import { BotOptions } from "mineflayer";
import { defineStore } from "pinia";
export const useBotStore = defineStore('bot', {
  state: () => ({
    bots: {} as { [key: string]: BotOptions }
  }),
  actions: {
    deleteBot(username: string) {
      if (this.bots[username]) {
        delete this.bots[username];
      }
    },
    addBot(username: string) {
      this.bots[username] = { username };
    },
  },
  persist: true
});
