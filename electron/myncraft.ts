// import { contextBridge } from "electron";
// import { BotOptions } from 'mineflayer'
// import { Client } from 'myncraftjs'
// const clients = new Map<string, Client>()
// contextBridge.exposeInMainWorld("myncraft", {
//     startBot(opt: BotOptions) {
//         opt.logEvent = true;
//         const client = new Client(opt)
//         clients.set(opt.username, client)
//     },
//     clients: () => clients,
//     getClient(username: string) {
//         return clients.get(username);
//     },
//     stopBot(username: string) {
//         const client = clients.get(username)
//         client?._client.end()
//         client?.getBot().end()
//         clients.delete(username)
//     }

// }
// )