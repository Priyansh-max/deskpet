import {
  METRIC_LABELS,
  formatBytesPerSec,
  formatMetricValue,
  type Metrics,
  type Settings
} from '../shared/types'

interface ReadoutProps {
  settings: Pick<Settings, 'metric' | 'showLabel'>
  metrics: Metrics
}

/**
 * The chip's label + reading. Shared by the taskbar chip and the settings-page
 * live preview so the two always render the same way (percentage value, or the
 * distinct ↓ download / ↑ upload network pair).
 */
export function Readout({ settings, metrics }: ReadoutProps): JSX.Element {
  return (
    <span className="widget__readout" data-metric={settings.metric}>
      {settings.showLabel && <span className="widget__label">{METRIC_LABELS[settings.metric]}</span>}
      {settings.metric === 'net' ? (
        <span className="widget__net">
          <span className="widget__net-item" title="Download">
            <span className="widget__arrow widget__arrow--down">↓</span>
            <span className="widget__num">{formatBytesPerSec(metrics.netDown)}</span>
          </span>
          <span className="widget__net-item" title="Upload">
            <span className="widget__arrow widget__arrow--up">↑</span>
            <span className="widget__num">{formatBytesPerSec(metrics.netUp)}</span>
          </span>
        </span>
      ) : (
        <span className="widget__value">{formatMetricValue(settings.metric, metrics)}</span>
      )}
    </span>
  )
}
