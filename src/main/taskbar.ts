import { screen, type Display } from 'electron'
import { FALLBACK_TASKBAR_THICKNESS, type TaskbarEdge } from '../shared/types'

export interface TaskbarBounds {
  /** Bounding box of the taskbar itself, in DIP screen coordinates. */
  x: number
  y: number
  width: number
  height: number
  edge: TaskbarEdge
  /** Thickness of the taskbar (height for horizontal, width for vertical). */
  thickness: number
}

/**
 * Derive the taskbar's location from the difference between a display's full
 * bounds and its work area. Windows excludes the taskbar from the work area,
 * so the leftover strip is the taskbar.
 *
 * Falls back to a bottom strip of FALLBACK_TASKBAR_THICKNESS when the taskbar
 * is auto-hidden (bounds == workArea) and its real size can't be measured.
 */
export function getTaskbarBounds(display: Display): TaskbarBounds {
  const b = display.bounds
  const wa = display.workArea

  const horizontalLoss = b.height - wa.height
  const verticalLoss = b.width - wa.width

  // Horizontal taskbar (top or bottom).
  if (horizontalLoss > 0 && horizontalLoss >= verticalLoss) {
    const atTop = wa.y > b.y
    return {
      x: b.x,
      y: atTop ? b.y : wa.y + wa.height,
      width: b.width,
      height: horizontalLoss,
      edge: atTop ? 'top' : 'bottom',
      thickness: horizontalLoss
    }
  }

  // Vertical taskbar (left or right).
  if (verticalLoss > 0) {
    const atLeft = wa.x > b.x
    return {
      x: atLeft ? b.x : wa.x + wa.width,
      y: b.y,
      width: verticalLoss,
      height: b.height,
      edge: atLeft ? 'left' : 'right',
      thickness: verticalLoss
    }
  }

  // Auto-hidden or no detectable taskbar: assume a bottom strip.
  return {
    x: b.x,
    y: b.y + b.height - FALLBACK_TASKBAR_THICKNESS,
    width: b.width,
    height: FALLBACK_TASKBAR_THICKNESS,
    edge: 'bottom',
    thickness: FALLBACK_TASKBAR_THICKNESS
  }
}

export function getPrimaryTaskbarBounds(): TaskbarBounds {
  return getTaskbarBounds(screen.getPrimaryDisplay())
}
