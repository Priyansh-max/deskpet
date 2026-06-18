/** Shared types and constants used by both the main and renderer processes. */

export type PetType = 'cat' | 'dog' | 'horse' | 'bird' | 'fish'

export const PETS: PetType[] = ['cat', 'dog', 'horse', 'bird', 'fish']

/** Which screen edge the taskbar lives on. */
export type TaskbarEdge = 'bottom' | 'top' | 'left' | 'right'

/** Number of animation frames per pet (cat_1.png ... cat_8.png). */
export const FRAME_COUNT = 8

/** How often the main process samples CPU load. */
export const CPU_POLL_INTERVAL_MS = 1000

/** Animation speed bounds (frames per second). */
export const MIN_FPS = 3
export const MAX_FPS = 18

/**
 * The pet overlays the taskbar. Its window is sized to the taskbar thickness
 * (e.g. ~48px tall for a bottom taskbar) so the pet sits within the taskbar band.
 */

/** Fallback taskbar thickness (px) when it can't be measured (auto-hide). */
export const FALLBACK_TASKBAR_THICKNESS = 48

/**
 * Default gap (px) the widget keeps from the right/bottom edge of the taskbar,
 * i.e. roughly to the left of the system tray (clock, battery, etc.).
 * Position is provisional — we'll fine-tune this later.
 */
export const TASKBAR_PET_EDGE_OFFSET = 300

/**
 * Length (px, DIP) of the chip window along the taskbar. The chip is embedded
 * as a child of the taskbar and sized to the taskbar's thickness on the
 * cross-axis; this is its extent along the bar.
 */
export const TASKBAR_CHIP_LENGTH = 120

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
