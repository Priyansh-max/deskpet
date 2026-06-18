import { useEffect, useRef, useState } from 'react'

interface UseAnimationOptions {
  frameCount: number
  fps: number
  paused: boolean
}

/**
 * Drives a looping frame index at a given frame rate using requestAnimationFrame.
 * The fps can change every tick (it tracks CPU load) without restarting the loop.
 */
export function useAnimation({ frameCount, fps, paused }: UseAnimationOptions): number {
  const [frame, setFrame] = useState(0)

  // Keep the latest fps/paused/frameCount in refs so the rAF loop reads current
  // values without being torn down and recreated on every change.
  const fpsRef = useRef(fps)
  const pausedRef = useRef(paused)
  const frameCountRef = useRef(frameCount)
  fpsRef.current = fps
  pausedRef.current = paused
  frameCountRef.current = frameCount

  useEffect(() => {
    let rafId = 0
    let lastTime = performance.now()
    let accumulator = 0

    const loop = (now: number): void => {
      rafId = requestAnimationFrame(loop)

      const delta = now - lastTime
      lastTime = now

      if (pausedRef.current || frameCountRef.current <= 1) {
        return
      }

      accumulator += delta
      const interval = 1000 / fpsRef.current

      // Advance one frame per elapsed interval; cap catch-up to avoid bursts
      // after the tab/window was throttled in the background.
      let advanced = 0
      while (accumulator >= interval && advanced < frameCountRef.current) {
        accumulator -= interval
        advanced += 1
      }

      if (advanced > 0) {
        setFrame((prev) => (prev + advanced) % frameCountRef.current)
      }
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return frame
}
