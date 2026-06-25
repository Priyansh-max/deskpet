import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { Metrics, Settings, SettingsPatch } from '../shared/types'

/** Fetch the current settings (the single source of truth held by the backend). */
export function getSettings(): Promise<Settings> {
  return invoke<Settings>('get_settings')
}

/** Send a partial settings update; the backend merges, clamps, persists, and broadcasts. */
export function updateSettings(patch: SettingsPatch): void {
  void invoke('update_settings', { patch })
}

/** Ask the backend to show the chip context menu (Change Pet / Settings / Pause / Quit). */
export function openMenu(): void {
  void invoke('open_menu')
}

/** Open (or focus) the settings window. */
export function openSettings(): void {
  void invoke('open_settings')
}

/** Open a URL in the default browser (via the backend). */
export function openUrl(url: string): void {
  void invoke('open_url', { url })
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

export const onMetrics = (cb: (m: Metrics) => void): (() => void) => on<Metrics>('metrics', cb)
export const onSettings = (cb: (s: Settings) => void): (() => void) => on<Settings>('settings', cb)
