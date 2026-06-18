import type { DeskPetApi } from './preload'

declare global {
  interface Window {
    deskpet: DeskPetApi
  }
}

export {}
