import si from 'systeminformation'
import { CPU_POLL_INTERVAL_MS } from '../shared/types'

type CpuListener = (load: number) => void

let timer: NodeJS.Timeout | null = null

/**
 * Polls the current CPU load every CPU_POLL_INTERVAL_MS and invokes the
 * listener with a value in the range 0-100. Returns a stop function.
 */
export function startCpuMonitor(onLoad: CpuListener): () => void {
  let stopped = false

  const sample = async (): Promise<void> => {
    try {
      const load = await si.currentLoad()
      if (!stopped) {
        onLoad(load.currentLoad)
      }
    } catch {
      // Ignore transient sampling errors; keep the pet moving at idle speed.
    }
  }

  // Sample immediately so the renderer gets a value without waiting a full tick.
  void sample()
  timer = setInterval(() => void sample(), CPU_POLL_INTERVAL_MS)

  return () => {
    stopped = true
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }
}
