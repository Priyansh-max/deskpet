/** Shared types and constants used by both the main and renderer processes. */

export type PetType = 'cat' | 'dog'

export const PETS: PetType[] = ['cat', 'dog']

/** Number of animation frames per pet (cat_1.png ... cat_8.png). */
export const FRAME_COUNT = 8

/** How often the main process samples CPU load. */
export const CPU_POLL_INTERVAL_MS = 1000

/** Animation speed bounds (frames per second). */
export const MIN_FPS = 3
export const MAX_FPS = 18

/** Pet window dimensions, in pixels. */
export const WINDOW_WIDTH = 200
export const WINDOW_HEIGHT = 200

/** Persisted user preferences. */
export interface Preferences {
  selectedPet: PetType
}

export const DEFAULT_PREFERENCES: Preferences = {
  selectedPet: 'cat'
}

/**
 * Map a CPU load percentage (0-100) to an animation frame rate.
 * fps = 3 + (cpu / 100) * 15, clamped to [MIN_FPS, MAX_FPS].
 */
export function cpuToFps(cpuUsage: number): number {
  const clampedCpu = Math.max(0, Math.min(100, cpuUsage))
  const fps = MIN_FPS + (clampedCpu / 100) * (MAX_FPS - MIN_FPS)
  return Math.max(MIN_FPS, Math.min(MAX_FPS, fps))
}
