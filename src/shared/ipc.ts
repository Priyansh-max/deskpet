/** IPC channel names shared between the main and renderer processes. */

export const IPC = {
  /** Main -> renderer: latest CPU load percentage (0-100). */
  cpuUpdate: 'cpu:update',
  /** Main -> renderer: the active pet changed (cat | dog). */
  petChanged: 'pet:changed',
  /** Main -> renderer: animation pause state toggled (boolean). */
  pauseChanged: 'pause:changed',
  /** Renderer -> main: request the current state on startup. */
  getInitialState: 'state:get'
} as const
