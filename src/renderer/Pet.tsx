import { useMemo } from 'react'
import { loadToFps, type PetType, type Settings } from '../shared/types'
import { getFrames } from './petAssets'
import { useAnimation } from './hooks/useAnimation'

interface PetProps {
  pet: PetType
  cpu: number
  paused: boolean
  /** Speed model; animation is always driven by CPU regardless of the displayed metric. */
  settings: Pick<Settings, 'minFps' | 'maxFps' | 'sensitivity'>
}

export function Pet({ pet, cpu, paused, settings }: PetProps): JSX.Element | null {
  const frames = useMemo(() => getFrames(pet), [pet])
  const fps = loadToFps(cpu, settings)

  const frame = useAnimation({
    frameCount: frames.length,
    fps,
    paused
  })

  const src = frames[frame] ?? frames[0]

  if (!src) return null

  return (
    <img
      className={`widget__pet widget__pet--${pet}`}
      src={src}
      alt={pet}
      draggable={false}
    />
  )
}
