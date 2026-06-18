import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { PetType } from '../shared/types'

export interface InitialState {
  selectedPet: PetType
  paused: boolean
}

export interface DeskPetApi {
  getInitialState: () => Promise<InitialState>
  onCpuUpdate: (cb: (load: number) => void) => () => void
  onPetChanged: (cb: (pet: PetType) => void) => () => void
  onPauseChanged: (cb: (paused: boolean) => void) => () => void
  /** Ask main to show the context menu (Change Pet / Pause / Quit). */
  openMenu: () => void
}

function subscribe<T>(channel: string, cb: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: DeskPetApi = {
  getInitialState: () => ipcRenderer.invoke(IPC.getInitialState),
  onCpuUpdate: (cb) => subscribe<number>(IPC.cpuUpdate, cb),
  onPetChanged: (cb) => subscribe<PetType>(IPC.petChanged, cb),
  onPauseChanged: (cb) => subscribe<boolean>(IPC.pauseChanged, cb),
  openMenu: () => ipcRenderer.send(IPC.chipClick)
}

contextBridge.exposeInMainWorld('deskpet', api)
