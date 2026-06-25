import type { Settings, ThemeMode } from '../shared/types'

/** Apply the theme + accent colour as attributes/vars on the document root. */
export function applyTheme(theme: ThemeMode, accent: string): void {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.setProperty('--accent', accent)
}

/**
 * Apply the full chip appearance (theme + accent + pill opacity + UI scale) as
 * CSS custom properties. The chip's CSS reads these; the Rust side mirrors
 * `scale` into the window width so the pill always fits.
 */
export function applyChipAppearance(s: Settings): void {
  applyTheme(s.theme, s.accent)
  const root = document.documentElement
  root.style.setProperty('--pill-opacity', String(s.opacity))
  root.style.setProperty('--scale', String(s.scale))
}
