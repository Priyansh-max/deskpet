import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { PetType } from '../shared/types'

export interface InitialState {
  selectedPet: PetType
  paused: boolean
}

export function getInitialState(): Promise<InitialState> {
  return invoke<InitialState>('get_initial_state')
}

/** Ask the backend to show the context menu (Change Pet / Pause / Quit). */
export function openMenu(): void {
  void invoke('open_menu')
}

/** Subscribe to a backend event; returns an unsubscribe function. */
function on<T>(event: string, cb: (value: T) => void): () => void {
  let unlisten: UnlistenFn | undefined
  let active = true
  void listen<T>(event, (e) => cb(e.payload)).then((u) => {
    if (active) unlisten = u
    else u()
  })
  return () => {
    active = false
    unlisten?.()
  }
}

export const onCpuUpdate = (cb: (load: number) => void): (() => void) => on<number>('cpu', cb)
export const onPetChanged = (cb: (pet: PetType) => void): (() => void) => on<PetType>('pet', cb)
export const onPauseChanged = (cb: (paused: boolean) => void): (() => void) => on<boolean>('pause', cb)
