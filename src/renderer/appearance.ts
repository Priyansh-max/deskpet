import type { Settings } from '../shared/types'

/** Convert a #rrggbb hex to an "r, g, b" triplet for rgba(); falls back to black. */
export function hexToRgb(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return '0, 0, 0'
  const n = parseInt(match[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/** Apply the readout accent colour (used by the settings-page preview). */
export function applyAccent(accent: string): void {
  document.documentElement.style.setProperty('--accent', accent)
}

/**
 * Apply the chip appearance (accent + background colour/opacity + UI scale) as
 * CSS custom properties. The chip's CSS reads these; the Rust side mirrors
 * `scale` into the window width so the pill always fits.
 */
export function applyChipAppearance(
  s: Pick<Settings, 'accent' | 'bgColor' | 'opacity' | 'scale'>
): void {
  const root = document.documentElement
  root.style.setProperty('--accent', s.accent)
  root.style.setProperty('--pill-rgb', hexToRgb(s.bgColor))
  root.style.setProperty('--pill-opacity', String(s.opacity))
  root.style.setProperty('--scale', String(s.scale))
}
