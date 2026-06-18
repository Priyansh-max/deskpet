import { useEffect, useState } from 'react'
import { DEFAULT_PREFERENCES, type PetType } from '../shared/types'
import { Pet } from './Pet'
import {
  getInitialState,
  onCpuUpdate,
  onPetChanged,
  onPauseChanged,
  openMenu
} from './tauri'

export function App(): JSX.Element {
  const [pet, setPet] = useState<PetType>(DEFAULT_PREFERENCES.selectedPet)
  const [cpu, setCpu] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    void getInitialState().then((state) => {
      setPet(state.selectedPet)
      setPaused(state.paused)
    })

    const unsubscribers = [
      onCpuUpdate(setCpu),
      onPetChanged(setPet),
      onPauseChanged(setPaused)
    ]

    return () => unsubscribers.forEach((off) => off())
  }, [])

  return (
    <div className="deskpet">
      <button
        type="button"
        className="widget"
        onClick={() => openMenu()}
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
