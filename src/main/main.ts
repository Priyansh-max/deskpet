import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc'
import {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  type PetType
} from '../shared/types'
import { getSelectedPet, setSelectedPet } from './store'
import { startCpuMonitor } from './cpuMonitor'
import { createTray, refreshTray, destroyTray } from './tray'

let petWindow: BrowserWindow | null = null
let stopCpuMonitor: (() => void) | null = null

// In-memory runtime state. The selected pet is persisted; pause is session-only.
let selectedPet: PetType = 'cat'
let paused = false

function send(channel: string, payload: unknown): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, payload)
  }
}

function createPetWindow(): void {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = primary.workAreaSize
  const { x: areaX, y: areaY } = primary.workArea

  // Anchor to the bottom-right corner of the primary display's work area,
  // with a small margin so the pet does not hug the screen edge.
  const margin = 12
  const x = areaX + width - WINDOW_WIDTH - margin
  const y = areaY + height - WINDOW_HEIGHT - margin

  petWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  petWindow.setAlwaysOnTop(true, 'screen-saver')

  petWindow.once('ready-to-show', () => {
    petWindow?.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void petWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (process.env['DESKPET_DEBUG']) {
    petWindow.webContents.on('did-finish-load', () => console.log('[deskpet] renderer loaded'))
    petWindow.webContents.on('did-fail-load', (_e, code, desc) =>
      console.error('[deskpet] renderer failed to load', code, desc)
    )
    petWindow.webContents.on('console-message', (_e, _lvl, message) =>
      console.log('[deskpet][renderer]', message)
    )
  }
}

function trayCallbacks() {
  return {
    getSelectedPet: () => selectedPet,
    getPaused: () => paused,
    onSelectPet: (pet: PetType) => {
      if (pet === selectedPet) return
      selectedPet = pet
      setSelectedPet(pet)
      send(IPC.petChanged, pet)
      refreshTray(trayCallbacks())
    },
    onTogglePause: () => {
      paused = !paused
      send(IPC.pauseChanged, paused)
      refreshTray(trayCallbacks())
    },
    onQuit: () => {
      app.quit()
    }
  }
}

function registerIpc(): void {
  // Renderer asks for the current state once it has mounted.
  ipcMain.handle(IPC.getInitialState, () => ({
    selectedPet,
    paused
  }))
}

app.whenReady().then(() => {
  selectedPet = getSelectedPet()

  registerIpc()
  createPetWindow()
  createTray(trayCallbacks())

  let loggedFirstSample = false
  stopCpuMonitor = startCpuMonitor((load) => {
    if (process.env['DESKPET_DEBUG'] && !loggedFirstSample) {
      loggedFirstSample = true
      console.log(`[deskpet] first CPU sample: ${load.toFixed(1)}%`)
    }
    send(IPC.cpuUpdate, load)
  })
})

// Keep running with no windows: this is a tray-resident app.
app.on('window-all-closed', () => {
  // Intentionally do not quit; the tray keeps the app alive.
})

app.on('before-quit', () => {
  stopCpuMonitor?.()
  destroyTray()
})
