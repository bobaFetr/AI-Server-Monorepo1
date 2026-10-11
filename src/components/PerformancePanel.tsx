import { Activity, Cpu, MemoryStick } from 'lucide-react'
import type { PerformanceSample } from './process-metrics'
import { trendScale } from './trend-scale'
import { historyWindow, historyX } from './history-window'

function bytes(value: number | null) {
  if (value === null) return 'Unavailable'
  return value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GiB` : `${(value / 1024 ** 2).toFixed(1)} MiB`
}
function Gauge({ title, value, detail, kind }: { title: string; value: number | null; detail: string; kind: 'cpu' | 'memory' }) {
  return <article className={`panel performance-gauge ${kind}`}>
    <h3>{kind === 'cpu' ? <Cpu size={17} /> : <MemoryStick size={17} />}{title}</h3>
    <div className="performance-dial" style={{ background: `conic-gradient(var(--${kind === 'cpu' ? 'orange' : 'green'}) ${value ?? 0}%, var(--line) 0)` }}>
      <div><strong>{value === null ? '—' : `${value.toFixed(1)}%`}</strong><span>{value === null ? 'Unavailable' : 'Latest sample'}</span></div>
    </div><p>{detail}</p>
  </article>
}
function Trend({ title, samples, field, color }: { title: string; samples: PerformanceSample[]; field: 'cpu' | 'memory' | 'ioWait'; color: string }) {
  const window = historyWindow(samples)
  samples = window.samples
  const points = samples.filter(sample => sample[field] !== null)
  const scale = trendScale(points.map(sample => sample[field]!))
  const y = (value: number) => 150 - (value - scale.min) / (scale.max - scale.min) * 130
  let penDown = false
  const path = samples.map(sample => {
    if (sample[field] === null) { penDown = false; return '' }
    const command = penDown && !sample.breakBefore ? 'L' : 'M'
    penDown = true
    return `${command}${historyX(sample.sampledAt, window.start)},${y(sample[field]!)}`
  }).join(' ')
  return <article className="panel performance-trend"><h3>{title}<span>Auto · {scale.min.toFixed(1)}–{scale.max.toFixed(1)}%</span></h3>
    {points.length === 0 ? <p className="performance-wait">Waiting for available metrics…</p> : <svg viewBox="0 0 570 185" role="img" aria-label={`${title}: ${samples.at(-1)?.[field] === null ? 'latest sample unavailable' : `latest ${points.at(-1)![field]!.toFixed(1)} percent`}, ${points.length} recorded samples`}>
      {[scale.min, (scale.min + scale.max) / 2, scale.max].map(value => <g key={value}><line x1="40" x2="550" y1={y(value)} y2={y(value)} stroke="var(--line)" /><text x="0" y={y(value) + 4}>{value.toFixed(1)}%</text></g>)}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      <text x="40" y="178">60 seconds ago</text><text x="550" y="178" textAnchor="end">Latest sample</text>
    </svg>}
  </article>
}
export function PerformancePanel({ samples, status }: { samples: PerformanceSample[]; status: string }) {
  const current = samples.at(-1)
  return <section className="performance-panel" aria-label="Visual task manager">
    <div className="panel-header"><h2><Activity size={18} /> Visual task manager</h2><span>{status}</span></div>
    <div className="performance-summary">
      <Gauge title="CPU utilization" value={current?.cpu ?? null} detail="User + system + nice + interrupts · excludes I/O wait and steal" kind="cpu" />
      <Gauge title="RAM used" value={current?.memory ?? null} detail={current ? `${bytes(current.memoryUsed)} / ${bytes(current.memoryTotal)}` : 'Waiting for server data'} kind="memory" />
      <article className="panel performance-facts"><h3>System snapshot</h3><dl>
        <div><dt>{current?.taskKind ?? 'Tasks'} / running</dt><dd>{current?.tasks ?? '—'} / {current?.runningTasks ?? '—'}</dd></div>
        <div><dt>Load · 1 / 5 / 15 min</dt><dd>{current?.load.length ? current.load.map(value => value.toFixed(2)).join(' / ') : '—'}</dd></div>
        <div><dt>Buffers / cache</dt><dd>{bytes(current?.cache ?? null)}</dd></div>
        <div><dt>Swap used</dt><dd>{current?.swap === null || !current ? '—' : `${current.swap.toFixed(1)}%`}</dd></div>
        <div><dt>I/O wait</dt><dd>{current?.ioWait === null || !current ? '—' : `${current.ioWait.toFixed(1)}%`}</dd></div>
      </dl></article>
    </div>
    <div className="performance-charts"><Trend title="CPU history" samples={samples} field="cpu" color="var(--orange)" /><Trend title="RAM history" samples={samples} field="memory" color="var(--green)" /><Trend title="I/O wait history" samples={samples} field="ioWait" color="var(--blue)" /></div>
    {current && (current.cpu === null || current.memory === null || current.ioWait === null) && <p className="connection-hint" role="status">Some metrics are unavailable in the latest top summary. Previous chart points remain historical data. Check that top displays detailed, whole-server CPU and memory summaries.</p>}
    <p className="connection-hint">All three charts show a rolling 60-second window. Each new sample moves the line left and removes expired values; pausing freezes the window. Chart axes scale automatically; gauges use 0–100%. Constant measurements remain flat. CPU excludes I/O wait and stolen VM time. RAM uses top's used/total values in KiB. The first result takes about two sampling intervals; complete frames arrive one interval after measurement.</p>
  </section>
}
