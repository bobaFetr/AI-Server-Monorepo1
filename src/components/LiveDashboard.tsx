import { useState } from 'react'
import { Command, LogOut, RefreshCw, Server } from 'lucide-react'
import { runSsh } from '../server/ssh.functions'
import { type Coordinates, type Operation } from '../server/ssh-input'
import { ProcessMonitor } from './ProcessMonitor'

const views = { overview: 'Overview', processes: 'Processes', containers: 'Containers', storage: 'Storage', services: 'Services', journal: 'System journal' } as const

export function LiveDashboard({ coordinates, initialOutput, disconnect }: { coordinates: Coordinates; initialOutput: string; disconnect: () => void }) {
  const [view, setView] = useState<keyof typeof views>('overview')
  const [output, setOutput] = useState(initialOutput)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<string | null>(() => new Date().toLocaleTimeString())
  const [container, setContainer] = useState('')
  const [notice, setNotice] = useState('')
  async function run(operation: Operation) {
    if (busy) return
    if (['start', 'stop', 'restart'].includes(operation) && !window.confirm(`${operation} container ${container} on ${coordinates.host}?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await runSsh({ data: { ...coordinates, operation, container } })
      if (!result.ok) { setError(result.output); return }
      if (operation === 'start' || operation === 'stop' || operation === 'restart') {
        setNotice(`Container ${operation} completed.`)
        const refreshed = await runSsh({ data: { ...coordinates, operation: 'containers' } })
        if (!refreshed.ok) { setError(refreshed.output); return }
        setOutput(refreshed.output)
      } else setOutput(result.output)
      setUpdated(new Date().toLocaleTimeString())
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed.') }
    finally { setBusy(false) }
  }
  return <main className="live-shell">
    <header className="connection-header"><div className="brand-lockup"><div className="brand-mark"><Command size={19} /></div><div><strong>Northstar</strong><span>Ubuntu control</span></div></div><button className="period-button" disabled={busy} onClick={disconnect}><LogOut size={16} /> Disconnect</button></header>
    <section className="dashboard-content">
      <div className="page-heading"><div><div className="eyebrow"><Server size={16} /> Live SSH operations</div><h1>{coordinates.host}</h1><p>{coordinates.username} · Port {coordinates.port} · Password authenticated</p></div><button className="primary-action" disabled={busy || view === 'processes'} onClick={() => void run(view)}><RefreshCw size={16} className={busy ? 'spin' : ''} /> {busy ? 'Working…' : 'Refresh'}</button></div>
      <nav className="live-tabs" aria-label="Live server tools">{Object.entries(views).map(([id, label]) => <button className={view === id ? 'primary-action' : 'period-button'} disabled={busy} key={id} onClick={() => { setView(id as keyof typeof views); setOutput(''); setUpdated(null); setError(''); setNotice(''); if (id !== 'processes') void run(id as keyof typeof views) }}>{label}</button>)}</nav>
      {error && <p role="alert" className="live-error">{error} Previous results may be stale.</p>}
      {notice && <p role="status">{notice}</p>}
      {view === 'processes' ? <ProcessMonitor coordinates={coordinates} /> : <section className="panel"><div className="panel-header"><h2>{views[view]}</h2><span>{busy ? 'Loading…' : updated ? `Last successful update: ${updated}` : 'Not loaded yet'}</span></div><pre className="live-output" aria-busy={busy}>{output || (busy ? 'Reading server…' : 'No data available.')}</pre></section>}
      {view === 'containers' && <section className="panel live-controls"><label htmlFor="container-id">Container ID from the list above</label><div className="input-shell"><input disabled={busy} id="container-id" value={container} onChange={e => setContainer(e.target.value.trim())} placeholder="12-character container ID" /></div><div className="live-tabs">{(['start', 'stop', 'restart'] as const).map(action => <button key={action} className="period-button" disabled={busy || !/^[a-f0-9]{12,64}$/.test(container)} onClick={() => void run(action)}>{action}</button>)}</div><p>Your Ubuntu user must already have permission to access Docker.</p></section>}
      <p className="connection-hint">Processes stream through one SSH connection at the selected sampling interval. Other views refresh on demand. Interactive shell, file editing, firewall changes, and package installation are not enabled.</p>
    </section>
  </main>
}
