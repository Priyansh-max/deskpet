import { useEffect, useRef, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  DEFAULT_METRICS,
  DEFAULT_SETTINGS,
  METRIC_LABELS,
  PETS,
  formatBytesPerSec,
  isAlerting,
  type AlertMetric,
  type MetricKind,
  type Metrics,
  type Settings,
  type SettingsPatch,
  type ThemeMode
} from '../shared/types'
import { Pet } from './Pet'
import { Readout } from './Readout'
import { applyTheme } from './appearance'
import { getSettings, onMetrics, onSettings, openUrl, updateSettings } from './tauri'

const METRICS: MetricKind[] = ['cpu', 'ram', 'net']
const ALERT_METRICS: AlertMetric[] = ['cpu', 'ram']
const THEMES: ThemeMode[] = ['auto', 'light', 'dark']

const REPO_URL = 'https://github.com/Priyansh-max/deskpet'
const RELEASES_URL = `${REPO_URL}/releases`
const ISSUES_URL = `${REPO_URL}/issues`
const RUNCAT_URL = 'https://kyome.io/runcat/'

type TabId = 'pet' | 'readout' | 'animation' | 'appearance' | 'startup' | 'about'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pet', label: 'Pet' },
  { id: 'readout', label: 'Readout' },
  { id: 'animation', label: 'Animation' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'startup', label: 'Startup' },
  { id: 'about', label: 'About' }
]

type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'current' }
  | { state: 'available'; latest: string }
  | { state: 'error' }

export function SettingsApp(): JSX.Element {
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS)
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS)
  const [tab, setTab] = useState<TabId>('pet')
  const [version, setVersion] = useState('')
  const [update, setUpdate] = useState<UpdateState>({ state: 'idle' })

  // Accumulate rapid slider changes and flush once, so drags don't hammer disk.
  const pending = useRef<SettingsPatch>({})
  const debounce = useRef<number | undefined>(undefined)

  useEffect(() => {
    void getSettings().then(setDraft)
    const unsubscribers = [
      // Reconcile from the backend unless we have an edit in flight.
      onSettings((s) => {
        if (Object.keys(pending.current).length === 0) setDraft(s)
      }),
      onMetrics(setMetrics)
    ]
    void getVersion()
      .then(setVersion)
      .catch(() => undefined)
    return () => unsubscribers.forEach((off) => off())
  }, [])

  async function checkUpdates(): Promise<void> {
    setUpdate({ state: 'checking' })
    try {
      const res = await fetch(`https://api.github.com/repos/Priyansh-max/deskpet/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }
      })
      if (!res.ok) throw new Error('bad status')
      const data: { tag_name?: string } = await res.json()
      const latest = (data.tag_name ?? '').replace(/^v/, '')
      if (latest && compareVersions(latest, version) > 0) {
        setUpdate({ state: 'available', latest })
      } else {
        setUpdate({ state: 'current' })
      }
    } catch {
      setUpdate({ state: 'error' })
    }
  }

  // Theme the settings window itself to match the chosen appearance.
  useEffect(() => {
    applyTheme(draft.theme, draft.accent)
  }, [draft.theme, draft.accent])

  // Esc closes the window; flush any queued edit first so it isn't lost.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        flush()
        void getCurrentWindow().close()
      }
    }
    // Best-effort flush if the window goes away mid-edit (e.g. title-bar X).
    const onHide = (): void => flush()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pagehide', onHide)
    }
  }, [])

  /** Send any queued (debounced) slider edit immediately. */
  function flush(): void {
    if (Object.keys(pending.current).length === 0) return
    window.clearTimeout(debounce.current)
    const patch = pending.current
    pending.current = {}
    updateSettings(patch)
  }

  function commit(patch: SettingsPatch, deferred = false): void {
    setDraft((d) => ({ ...d, ...patch }))
    if (deferred) {
      pending.current = { ...pending.current, ...patch }
      window.clearTimeout(debounce.current)
      debounce.current = window.setTimeout(flush, 140)
    } else {
      // An immediate change supersedes any queued slider edit. Merge the queued
      // patch underneath so unrelated pending fields aren't dropped, while this
      // patch wins on overlap (so "Reset" truly overrides a mid-drag value).
      window.clearTimeout(debounce.current)
      const merged = { ...pending.current, ...patch }
      pending.current = {}
      updateSettings(merged)
    }
  }

  function reset(): void {
    const { version: _version, ...rest } = DEFAULT_SETTINGS
    commit(rest)
  }

  return (
    <div className="settings">
      <nav className="sidebar">
        <div className="sidebar__brand">🐾 DeskPet</div>
        <div className="sidebar__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn-reset" onClick={reset}>
          Reset to defaults
        </button>
      </nav>

      <div className="content">
        <header className="preview">
          <div
            className={`preview__chip${isAlerting(draft, metrics) ? ' widget--alert' : ''}`}
            style={{ background: `rgba(0, 0, 0, ${draft.opacity})` }}
          >
            <Pet pet={draft.selectedPet} cpu={metrics.cpu} paused={draft.paused} settings={draft} />
            <Readout settings={draft} metrics={metrics} />
          </div>
          <div className="preview__stats">
            <Stat label="CPU" value={`${Math.round(metrics.cpu)}%`} />
            <Stat label="RAM" value={`${Math.round(metrics.ramPct)}%`} />
            <Stat
              label="NET"
              value={`↓${formatBytesPerSec(metrics.netDown)} ↑${formatBytesPerSec(metrics.netUp)}`}
            />
          </div>
        </header>

        <main className="panel">
          {tab === 'pet' && (
            <section className="section">
              <div className="petstage">
                <Pet
                  pet={draft.selectedPet}
                  cpu={metrics.cpu}
                  paused={draft.paused}
                  settings={draft}
                />
              </div>
              <div className="petgrid">
                {PETS.map((pet) => (
                  <button
                    key={pet}
                    type="button"
                    className={`petgrid__item${pet === draft.selectedPet ? ' is-selected' : ''}`}
                    onClick={() => commit({ selectedPet: pet })}
                  >
                    {pet}
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === 'readout' && (
            <section className="section">
              <Row label="Metric">
                <Segmented
                  options={METRICS}
                  value={draft.metric}
                  format={(m) => METRIC_LABELS[m]}
                  onChange={(metric) => commit({ metric })}
                />
              </Row>
              <Row label="Show label" hint="“CPU 45%” vs “45%”">
                <Toggle checked={draft.showLabel} onChange={(showLabel) => commit({ showLabel })} />
              </Row>
            </section>
          )}

          {tab === 'animation' && (
            <section className="section">
              <Row label="Pause animation" hint="Freeze the pet on its current frame">
                <Toggle checked={draft.paused} onChange={(paused) => commit({ paused })} />
              </Row>
              <Row label="Min speed" value={`${Math.round(draft.minFps)} fps`}>
                <Slider
                  min={1}
                  max={draft.maxFps}
                  step={1}
                  value={draft.minFps}
                  onChange={(v) => commit({ minFps: v }, true)}
                  onCommit={flush}
                />
              </Row>
              <Row label="Max speed" value={`${Math.round(draft.maxFps)} fps`}>
                <Slider
                  min={draft.minFps}
                  max={60}
                  step={1}
                  value={draft.maxFps}
                  onChange={(v) => commit({ maxFps: v }, true)}
                  onCommit={flush}
                />
              </Row>
              <Row label="Sensitivity" value={sensitivityLabel(draft.sensitivity)}>
                <Slider
                  min={0.3}
                  max={3}
                  step={0.1}
                  value={draft.sensitivity}
                  onChange={(v) => commit({ sensitivity: v }, true)}
                  onCommit={flush}
                />
              </Row>
              <Row label="Load alert" hint="Flash the readout when load is high">
                <Toggle
                  checked={draft.alertEnabled}
                  onChange={(alertEnabled) => commit({ alertEnabled })}
                />
              </Row>
              <Row label="Alert metric">
                <Segmented
                  options={ALERT_METRICS}
                  value={draft.alertMetric}
                  format={(m) => METRIC_LABELS[m]}
                  onChange={(alertMetric) => commit({ alertMetric })}
                />
              </Row>
              <Row label="Threshold" value={`${Math.round(draft.alertThreshold)}%`}>
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={draft.alertThreshold}
                  onChange={(v) => commit({ alertThreshold: v }, true)}
                  onCommit={flush}
                />
              </Row>
            </section>
          )}

          {tab === 'appearance' && (
            <section className="section">
              <Row label="Theme">
                <Segmented
                  options={THEMES}
                  value={draft.theme}
                  format={(t) => t[0].toUpperCase() + t.slice(1)}
                  onChange={(theme) => commit({ theme })}
                />
              </Row>
              <Row label="Opacity" value={`${Math.round(draft.opacity * 100)}%`}>
                <Slider
                  min={0.1}
                  max={1}
                  step={0.02}
                  value={draft.opacity}
                  onChange={(v) => commit({ opacity: v }, true)}
                  onCommit={flush}
                />
              </Row>
              <Row label="Size" value={`${Math.round(draft.scale * 100)}%`}>
                <Slider
                  min={0.8}
                  max={1.4}
                  step={0.05}
                  value={draft.scale}
                  onChange={(v) => commit({ scale: v }, true)}
                  onCommit={flush}
                />
              </Row>
              <Row label="Accent" hint="Readout text colour">
                <input
                  type="color"
                  value={normalizeHex(draft.accent)}
                  onChange={(e) => commit({ accent: e.target.value }, true)}
                  onBlur={flush}
                />
              </Row>
            </section>
          )}

          {tab === 'startup' && (
            <section className="section">
              <Row label="Launch at login">
                <Toggle checked={draft.autostart} onChange={(autostart) => commit({ autostart })} />
              </Row>
              <Row label="Remember pause" hint="Keep paused state across restarts">
                <Toggle
                  checked={draft.rememberPause}
                  onChange={(rememberPause) => commit({ rememberPause })}
                />
              </Row>
              <Row label="Hide under fullscreen" hint="Mirror native taskbar behaviour">
                <Toggle
                  checked={draft.hideUnderFullscreen}
                  onChange={(hideUnderFullscreen) => commit({ hideUnderFullscreen })}
                />
              </Row>
            </section>
          )}

          {tab === 'about' && (
            <section className="section about">
              <div className="about__head">
                <span className="about__name">🐾 DeskPet</span>
                {version && <span className="about__ver">v{version}</span>}
              </div>
              <p className="about__desc">
                A desktop companion that lives in your taskbar and runs faster as your machine
                heats up.
              </p>
              <Row label="Updates">
                <button type="button" className="btn" onClick={() => void checkUpdates()}>
                  {updateButtonLabel(update)}
                </button>
              </Row>
              {update.state === 'available' && (
                <button type="button" className="link" onClick={() => openUrl(RELEASES_URL)}>
                  Download v{update.latest} →
                </button>
              )}
              <div className="about__links">
                <button type="button" className="link" onClick={() => openUrl(REPO_URL)}>
                  GitHub
                </button>
                <button type="button" className="link" onClick={() => openUrl(ISSUES_URL)}>
                  Report an issue
                </button>
              </div>
              <p className="about__credit">
                Inspired by{' '}
                <button type="button" className="link" onClick={() => openUrl(RUNCAT_URL)}>
                  RunCat
                </button>
                , the original taskbar pet that runs with your CPU.
              </p>
              <div className="about__meta">
                <em>Open source</em> · Apache-2.0 License
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

/** Compare dotted numeric versions; >0 if a is newer than b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function updateButtonLabel(u: UpdateState): string {
  switch (u.state) {
    case 'checking':
      return 'Checking…'
    case 'current':
      return 'Up to date ✓'
    case 'available':
      return `Update available: v${u.latest}`
    case 'error':
      return 'Check failed, retry'
    default:
      return 'Check for updates'
  }
}

function sensitivityLabel(s: number): string {
  if (s < 0.7) return `Eager (${s.toFixed(1)})`
  if (s > 1.5) return `Calm (${s.toFixed(1)})`
  return `Linear (${s.toFixed(1)})`
}

/** Coerce arbitrary CSS colours to a 7-char hex for <input type="color">. */
function normalizeHex(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff'
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}

function Row({
  label,
  hint,
  value,
  children
}: {
  label: string
  hint?: string
  value?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="row">
      <div className="row__head">
        <span className="row__label">{label}</span>
        {hint && <span className="row__hint">{hint}</span>}
      </div>
      <div className="row__control">
        {value && <span className="row__value">{value}</span>}
        {children}
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`toggle${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  )
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  format
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  format: (v: T) => string
}): JSX.Element {
  return (
    <div className="segmented">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`segmented__item${opt === value ? ' is-selected' : ''}`}
          onClick={() => onChange(opt)}
        >
          {format(opt)}
        </button>
      ))}
    </div>
  )
}

/**
 * Range slider that streams changes via onChange (debounced by the caller) and
 * fires onCommit when the interaction ends (pointer up / key up / blur), so the
 * final value is flushed immediately and never lost to a pending debounce.
 */
function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  onCommit: () => void
}): JSX.Element {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
    />
  )
}
