import { useEffect, useState } from 'react'
import { DEFAULT_PREFERENCES, type PetType } from '../shared/types'
import { Pet } from './Pet'

export function App(): JSX.Element {
  const [pet, setPet] = useState<PetType>(DEFAULT_PREFERENCES.selectedPet)
  const [cpu, setCpu] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
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

  return (
    <div className="deskpet">
      <button
        type="button"
        className="widget"
        onClick={() => window.deskpet.openMenu()}
        aria-label="DeskPet — open menu"
      >
        <Pet pet={pet} cpu={cpu} paused={paused} />
        <span className="widget__cpu">
          <span className="widget__num">{Math.round(cpu)}</span>%
        </span>
      </button>
    </div>
  )
}
