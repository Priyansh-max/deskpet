/** Shared types and constants used by both the Rust backend and the renderer. */

export type PetType = 'cat' | 'dog' | 'horse' | 'bird' | 'fish'

export const PETS: PetType[] = ['cat', 'dog', 'horse', 'bird', 'fish']

/** Which metric the chip displays. Animation speed is always driven by CPU. */
export type MetricKind = 'cpu' | 'ram' | 'net'

/** Appearance theme for the chip (and the settings window). */
export type ThemeMode = 'auto' | 'light' | 'dark'

/** Which metric the load alert watches (percentage metrics only). */
export type AlertMetric = 'cpu' | 'ram'

/** Number of animation frames per pet (cat_1.png ... cat_8.png). */
export const FRAME_COUNT = 8

/** How often the backend samples system load and emits a `metrics` event. */
export const METRICS_POLL_INTERVAL_MS = 1000

/** Default animation speed bounds (frames per second). */
export const MIN_FPS = 3
export const MAX_FPS = 18

/** Bumped when the persisted shape changes; see DEFAULT_SETTINGS. */
export const SETTINGS_VERSION = 2

/**
 * Persisted user settings — the single source of truth, mirrored field-for-field
 * by the Rust `Settings` struct (camelCase <-> the renamed serde fields).
 */
export interface Settings {
  version: number
  selectedPet: PetType
  paused: boolean
  /** The metric shown in the chip; animation speed still tracks CPU. */
  metric: MetricKind
  /** Show the metric name ("CPU 45%") or just the value ("45%"). */
  showLabel: boolean
  // Speed model — fps = minFps + (cpu/100)^sensitivity * (maxFps - minFps).
  minFps: number
  maxFps: number
  /** Curve exponent: >1 ramps calmly at low load, <1 is eager. */
  sensitivity: number
  // Appearance.
  theme: ThemeMode
  /** Pill background alpha, 0..1. */
  opacity: number
  /** Chip UI scale (content + window width grow together). */
  scale: number
  /** Accent colour for the readout text, any CSS colour (hex). */
  accent: string
  // Behaviour.
  autostart: boolean
  /** Persist the paused state across restarts (else start unpaused). */
  rememberPause: boolean
  hideUnderFullscreen: boolean
  // Position.
  /** Logical px the chip keeps from the tray end of the taskbar. */
  edgeOffset: number
  /** Monitor index, 0 = primary. Secondary support is best-effort. */
  monitor: number
  // Load alert: visibly react when the watched metric crosses the threshold.
  alertEnabled: boolean
  alertMetric: AlertMetric
  /** Trigger percentage, 1..100. */
  alertThreshold: number
}

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  selectedPet: 'cat',
  paused: false,
  metric: 'cpu',
  showLabel: true,
  minFps: MIN_FPS,
  maxFps: MAX_FPS,
  sensitivity: 1,
  theme: 'auto',
  opacity: 0.34,
  scale: 1,
  accent: '#ffffff',
  autostart: false,
  rememberPause: true,
  hideUnderFullscreen: true,
  edgeOffset: 300,
  monitor: 0,
  alertEnabled: true,
  alertMetric: 'cpu',
  alertThreshold: 90
}

/** A partial update to settings; only present fields are applied + clamped server-side. */
export type SettingsPatch = Partial<Settings>

/** Live system metrics emitted by the backend once per second. */
export interface Metrics {
  /** Global CPU load, 0..100. */
  cpu: number
  /** Used / total physical RAM, in bytes, plus the derived percentage. */
  ramUsed: number
  ramTotal: number
  ramPct: number
  /** Network throughput across all interfaces, in bytes/second. */
  netDown: number
  netUp: number
}

export const DEFAULT_METRICS: Metrics = {
  cpu: 0,
  ramUsed: 0,
  ramTotal: 0,
  ramPct: 0,
  netDown: 0,
  netUp: 0
}

export const METRIC_LABELS: Record<MetricKind, string> = {
  cpu: 'CPU',
  ram: 'RAM',
  net: 'NET'
}

/**
 * Map a CPU load percentage (0-100) to an animation frame rate.
 * fps = minFps + (cpu/100)^sensitivity * (maxFps - minFps), clamped to [minFps, maxFps].
 */
export function loadToFps(
  cpu: number,
  s: Pick<Settings, 'minFps' | 'maxFps' | 'sensitivity'>
): number {
  const t = Math.max(0, Math.min(1, cpu / 100))
  const curved = Math.pow(t, s.sensitivity)
  const fps = s.minFps + curved * (s.maxFps - s.minFps)
  return Math.max(s.minFps, Math.min(s.maxFps, fps))
}

/** Format a byte rate compactly, e.g. 1.2G, 1.2M, 340K, 12. */
export function formatBytesPerSec(bps: number): string {
  if (bps >= 1024 * 1024 * 1024) return `${(bps / (1024 * 1024 * 1024)).toFixed(1)}G`
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)}M`
  if (bps >= 1024) return `${Math.round(bps / 1024)}K`
  return `${Math.round(bps)}`
}

/** The chip's value text for the active metric. */
export function formatMetricValue(metric: MetricKind, m: Metrics): string {
  switch (metric) {
    case 'cpu':
      return `${Math.round(m.cpu)}%`
    case 'ram':
      return `${Math.round(m.ramPct)}%`
    case 'net':
      return `↓${formatBytesPerSec(m.netDown)} ↑${formatBytesPerSec(m.netUp)}`
  }
}

/** Whether the load alert should fire for the current metrics. */
export function isAlerting(
  s: Pick<Settings, 'alertEnabled' | 'alertMetric' | 'alertThreshold'>,
  m: Metrics
): boolean {
  if (!s.alertEnabled) return false
  const value = s.alertMetric === 'ram' ? m.ramPct : m.cpu
  return value >= s.alertThreshold
}
