/**
 * Win32 interop (via koffi) to detect a true fullscreen foreground app, so the
 * widget can hide like the taskbar does — without misfiring on merely maximized
 * windows (which still show the taskbar). Coordinates are PHYSICAL pixels.
 */
import koffi from 'koffi'

const user32 = koffi.load('user32.dll')

const GetForegroundWindow = user32.func('GetForegroundWindow', 'uintptr_t', [])
const GetWindowRect = user32.func('GetWindowRect', 'bool', ['uintptr_t', 'void*'])
const GetClassNameW = user32.func('GetClassNameW', 'int', ['uintptr_t', 'void*', 'int'])
const SetWindowPos = user32.func('SetWindowPos', 'bool', [
  'uintptr_t',
  'intptr_t',
  'int',
  'int',
  'int',
  'int',
  'uint'
])

const HWND_TOPMOST = -1n
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010

/** Read the HWND of an Electron BrowserWindow as a BigInt. */
export function hwndOf(handle: Buffer): bigint {
  return handle.readBigUInt64LE(0)
}

/**
 * Force the window back above the taskbar in the topmost z-order, without
 * activating it. Needed because clicking the taskbar promotes it above us.
 */
export function setTopmost(hwnd: bigint): void {
  SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
}

const SHELL_CLASSES = new Set(['WorkerW', 'Progman', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'])

/**
 * True when the foreground window covers the entire monitor (a fullscreen
 * game/video). A maximized window stops at the work area — its height is less
 * than the full monitor — so it does not match.
 */
export function isForegroundFullscreen(
  ownHwnd: bigint,
  monitor: { width: number; height: number }
): boolean {
  const fg = BigInt(GetForegroundWindow() as unknown as number | bigint)
  if (!fg || fg === ownHwnd) return false

  const nameBuf = Buffer.alloc(256 * 2)
  const len = GetClassNameW(fg, nameBuf, 256)
  const cls = nameBuf.toString('utf16le', 0, Math.max(0, len) * 2)
  if (SHELL_CLASSES.has(cls)) return false

  const rect = Buffer.alloc(16)
  if (!GetWindowRect(fg, rect)) return false
  const w = rect.readInt32LE(8) - rect.readInt32LE(0)
  const h = rect.readInt32LE(12) - rect.readInt32LE(4)
  return w >= monitor.width && h >= monitor.height
}
