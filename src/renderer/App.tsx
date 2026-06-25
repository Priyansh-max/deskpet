import { useEffect, useState } from 'react'
import {
  DEFAULT_METRICS,
  DEFAULT_SETTINGS,
  isAlerting,
  type Metrics,
  type Settings
} from '../shared/types'
import { Pet } from './Pet'
import { Readout } from './Readout'
import { applyChipAppearance } from './appearance'
import { getSettings, onMetrics, onSettings, openMenu } from './tauri'

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS)

  useEffect(() => {
    void getSettings().then(setSettings)
    const unsubscribers = [onSettings(setSettings), onMetrics(setMetrics)]
    return () => unsubscribers.forEach((off) => off())
  }, [])

  useEffect(() => {
    applyChipAppearance(settings)
  }, [settings])

  const alerting = isAlerting(settings, metrics)

  return (
    <div className="deskpet">
      <button
        type="button"
        className={`widget${alerting ? ' widget--alert' : ''}`}
        onClick={() => openMenu()}
        aria-label="DeskPet — open menu"
      >
        <Pet pet={settings.selectedPet} cpu={metrics.cpu} paused={settings.paused} settings={settings} />
        <Readout settings={settings} metrics={metrics} />
      </button>
    </div>
  )
}
