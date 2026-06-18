import { useMemo } from 'react'
import { cpuToFps, type PetType } from '../shared/types'
import { getFrames } from './petAssets'
import { useAnimation } from './hooks/useAnimation'

interface PetProps {
  pet: PetType
  cpu: number
  paused: boolean
}

export function Pet({ pet, cpu, paused }: PetProps): JSX.Element {
  const frames = useMemo(() => getFrames(pet), [pet])
  const fps = cpuToFps(cpu)

  const frame = useAnimation({
    frameCount: frames.length,
    fps,
    paused
  })

  const src = frames[frame] ?? frames[0]

  return (
    <div className="pet">
      {src ? (
        <img
          className="pet__frame"
          src={src}
          alt={pet}
          draggable={false}
        />
      ) : null}
    </div>
  )
}
