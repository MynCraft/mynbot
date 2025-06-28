import { app, BrowserWindow, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: true,
      // devTools: false
    },
    height: 544,
    width: 306,
    titleBarStyle: "hidden",
    resizable: false,
    fullscreenable: false,
    fullscreen: false,
    frame: false,
  })
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
ipcMain.on('close-window', () => {
  win?.close()
})





ipcMain.on('open-bot-window', (_event, username) => {
  createBotWindow(username);
})
const botWindows = new Map<string, BrowserWindow>()
function createBotWindow(username: string) {
  let botWin: BrowserWindow = new BrowserWindow({
    width: 928,
    height: 522,
    titleBarStyle: "hidden",
    resizable: false,
    fullscreenable: false,
    fullscreen: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  botWindows.set(username, botWin);
  if (VITE_DEV_SERVER_URL) {
    botWin.loadURL(VITE_DEV_SERVER_URL + `#/bot/${username}/home`);
  } else {
    botWin.loadFile(path.join(RENDERER_DIST, 'index.html'), {
      hash: `/bot/${username}/home`
    });
  }

  botWin.webContents.on('did-finish-load', () => {
    botWin?.webContents.send('main-process-message', (new Date).toLocaleString());
  });
}
ipcMain.on('close-bot-window', (_event, username: string) => {
  const win = botWindows.get(username)
  if (win) {
    win.close()
    botWindows.delete(username)
  }
})
ipcMain.handle('get-open-windows', () => {
  return BrowserWindow.getAllWindows().map(win => ({
    id: win.id,
    url: win.webContents.getURL()
  }));
});