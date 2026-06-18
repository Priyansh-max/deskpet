import { useMemo } from 'react'
import { cpuToFps, type PetType } from '../shared/types'
import { getFrames } from './petAssets'
import { useAnimation } from './hooks/useAnimation'

interface PetProps {
  pet: PetType
  cpu: number
  paused: boolean
}

export function Pet({ pet, cpu, paused }: PetProps): JSX.Element | null {
  const frames = useMemo(() => getFrames(pet), [pet])
  const fps = cpuToFps(cpu)

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
