import { useEffect, useState } from 'react'
import { DEFAULT_PREFERENCES, type PetType } from '../shared/types'
import { Pet } from './Pet'

export function App(): JSX.Element {
  const [pet, setPet] = useState<PetType>(DEFAULT_PREFERENCES.selectedPet)
  const [cpu, setCpu] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // Pull the persisted pet and current pause state once on mount.
    void window.deskpet.getInitialState().then((state) => {
      setPet(state.selectedPet)
      setPaused(state.paused)
    })

    const unsubscribers = [
      window.deskpet.onCpuUpdate(setCpu),
      window.deskpet.onPetChanged(setPet),
      window.deskpet.onPauseChanged(setPaused)
    ]

    return () => unsubscribers.forEach((off) => off())
  }, [])

  return <Pet pet={pet} cpu={cpu} paused={paused} />
}
