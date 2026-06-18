import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'path'
import { PETS, type PetType } from '../shared/types'

interface TrayCallbacks {
  getSelectedPet: () => PetType
  getPaused: () => boolean
  onSelectPet: (pet: PetType) => void
  onTogglePause: () => void
  onQuit: () => void
}

let tray: Tray | null = null

const PET_LABELS: Record<PetType, string> = {
  cat: 'Cat',
  dog: 'Dog'
}

function buildMenu(cb: TrayCallbacks): Menu {
  return Menu.buildFromTemplate([
    { label: '🐾 DeskPet', enabled: false },
    { type: 'separator' },
    {
      label: 'Change Pet',
      submenu: PETS.map((pet) => ({
        label: PET_LABELS[pet],
        type: 'radio',
        checked: cb.getSelectedPet() === pet,
        click: () => cb.onSelectPet(pet)
      }))
    },
    {
      label: 'Pause Animation',
      type: 'checkbox',
      checked: cb.getPaused(),
      click: () => cb.onTogglePause()
    },
    { type: 'separator' },
    { label: 'Quit', click: () => cb.onQuit() }
  ])
}

/** The tray icon ships as a packaged resource and is also available in dev. */
function trayIcon(): Electron.NativeImage {
  // In dev the icon lives in the project; when packaged it sits next to resources.
  const devPath = join(__dirname, '../../resources/tray.png')
  const prodPath = join(process.resourcesPath, 'tray.png')
  const image = nativeImage.createFromPath(app.isPackaged ? prodPath : devPath)
  if (image.isEmpty()) {
    // Fall back to a tiny transparent image so the tray still appears.
    return nativeImage.createEmpty()
  }
  return image
}

export function createTray(cb: TrayCallbacks): Tray {
  tray = new Tray(trayIcon())
  tray.setToolTip('DeskPet')
  tray.setContextMenu(buildMenu(cb))
  return tray
}

/** Rebuild the menu so radio/checkbox states reflect the latest preferences. */
export function refreshTray(cb: TrayCallbacks): void {
  if (tray) {
    tray.setContextMenu(buildMenu(cb))
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
