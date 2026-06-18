import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC } from '../shared/ipc'
import { TASKBAR_CHIP_LENGTH, TASKBAR_PET_EDGE_OFFSET, type PetType } from '../shared/types'
import { getSelectedPet, setSelectedPet } from './store'
import { startCpuMonitor } from './cpuMonitor'
import {
  createTray,
  refreshTray,
  destroyTray,
  buildContextMenu,
  type TrayCallbacks
} from './tray'
import { getPrimaryTaskbarBounds, type TaskbarBounds } from './taskbar'
import { hwndOf, isForegroundFullscreen, setTopmost } from './win32'

// Stop Chromium from blanking the transparent widget when it thinks it's
// covered. (Hardware acceleration is intentionally LEFT ON — disabling it makes
// transparent layered windows flicker on activation.)
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

let petWindow: BrowserWindow | null = null
let petHwnd: bigint | null = null
let stopCpuMonitor: (() => void) | null = null
let keepOnTopTimer: NodeJS.Timeout | null = null
let hiddenForFullscreen = false
let menuOpen = false

let selectedPet: PetType = 'cat'
let paused = false

function send(channel: string, payload?: unknown): void {
  const wc = petWindow?.webContents
  if (wc && !petWindow!.isDestroyed() && !wc.isDestroyed()) {
    try {
      wc.send(channel, payload)
    } catch {
      // The render frame can be disposed mid-send during teardown; ignore.
    }
  }
}

/** Compute the chip's rectangle (DIP) inside the taskbar band, near the tray. */
function computeChipBounds(tb: TaskbarBounds): Electron.Rectangle {
  if (tb.edge === 'left' || tb.edge === 'right') {
    return {
      x: tb.x,
      y: Math.round(tb.y + tb.height - TASKBAR_PET_EDGE_OFFSET - TASKBAR_CHIP_LENGTH),
      width: tb.thickness,
      height: TASKBAR_CHIP_LENGTH
    }
  }
  return {
    x: Math.round(tb.x + tb.width - TASKBAR_PET_EDGE_OFFSET - TASKBAR_CHIP_LENGTH),
    y: tb.y,
    width: TASKBAR_CHIP_LENGTH,
    height: tb.thickness
  }
}

function positionChip(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.setBounds(computeChipBounds(getPrimaryTaskbarBounds()))
}

function createPetWindow(): void {
  const bounds = computeChipBounds(getPrimaryTaskbarBounds())

  petWindow = new BrowserWindow({
    ...bounds,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  petHwnd = hwndOf(petWindow.getNativeWindowHandle())
  // Sit above the taskbar (itself a topmost window). Set once.
  petWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env['ELECTRON_RENDERER_URL']) {
    void petWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  petWindow.once('ready-to-show', () => {
    petWindow?.showInactive()
    positionChip()
  })

  if (process.env['DESKPET_DEBUG']) {
    petWindow.webContents.on('did-finish-load', () => console.log('[deskpet] renderer loaded'))
    petWindow.webContents.on('console-message', (_e, _lvl, message) =>
      console.log('[deskpet][renderer]', message)
    )
  }
}

/** Hide the widget only while a genuine fullscreen app is foreground. */
function updateFullscreenVisibility(): void {
  if (!petWindow || petWindow.isDestroyed() || !petHwnd) return

  const disp = screen.getPrimaryDisplay()
  const monitor = {
    width: Math.round(disp.bounds.width * disp.scaleFactor),
    height: Math.round(disp.bounds.height * disp.scaleFactor)
  }

  const fullscreen = isForegroundFullscreen(petHwnd, monitor)
  if (fullscreen && !hiddenForFullscreen) {
    hiddenForFullscreen = true
    petWindow.hide()
  } else if (!fullscreen && hiddenForFullscreen) {
    hiddenForFullscreen = false
    petWindow.showInactive()
    positionChip()
    petWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

// --- Actions, shared by the tray menu and the chip's click menu. ---

function selectPet(pet: PetType): void {
  if (pet === selectedPet) return
  selectedPet = pet
  setSelectedPet(pet)
  send(IPC.petChanged, pet)
  refreshTray(trayCallbacks())
}

function togglePause(): void {
  paused = !paused
  send(IPC.pauseChanged, paused)
  refreshTray(trayCallbacks())
}

function quitApp(): void {
  app.quit()
}

function trayCallbacks(): TrayCallbacks {
  return {
    getSelectedPet: () => selectedPet,
    getPaused: () => paused,
    onSelectPet: selectPet,
    onTogglePause: togglePause,
    onQuit: quitApp
  }
}

function popupMenu(): void {
  if (!petWindow || petWindow.isDestroyed()) return
  // Pause the topmost re-assert while the menu is open, otherwise it would keep
  // shoving the widget above the menu.
  menuOpen = true
  buildContextMenu(trayCallbacks()).popup({
    window: petWindow,
    callback: () => {
      menuOpen = false
    }
  })
}

function registerIpc(): void {
  ipcMain.handle(IPC.getInitialState, () => ({ selectedPet, paused }))
  ipcMain.on(IPC.chipClick, popupMenu)
}

app.whenReady().then(() => {
  selectedPet = getSelectedPet()

  registerIpc()
  createPetWindow()
  createTray(trayCallbacks())

  screen.on('display-metrics-changed', positionChip)
  screen.on('display-added', positionChip)
  screen.on('display-removed', positionChip)

  // Keep the widget above the taskbar (which jumps above us when clicked) and
  // hide it under genuine fullscreen apps. Skip while the menu is open.
  keepOnTopTimer = setInterval(() => {
    updateFullscreenVisibility()
    if (petHwnd && !hiddenForFullscreen && !menuOpen) setTopmost(petHwnd)
  }, 350)

  stopCpuMonitor = startCpuMonitor((load) => send(IPC.cpuUpdate, load))
})

// Keep running with no windows: this is a tray-resident app.
app.on('window-all-closed', () => {
  // Intentionally do not quit; the tray keeps the app alive.
})

app.on('before-quit', () => {
  stopCpuMonitor?.()
  if (keepOnTopTimer) {
    clearInterval(keepOnTopTimer)
    keepOnTopTimer = null
  }
  destroyTray()
})
