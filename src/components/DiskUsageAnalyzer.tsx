import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Folder, Home, RefreshCw } from 'lucide-react'
import { scanDiskUsage } from '../server/disk.functions'
import type { Coordinates } from '../server/ssh-input'
import type { DiskNode, DiskScan } from '../server/disk-input'
import { diskSegments, diskSize, ringPath } from './disk-chart'

export function DiskUsageAnalyzer({ coordinates, refreshKey }: { coordinates: Coordinates; refreshKey: number }) {
  const [result, setResult] = useState<DiskScan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [path, setPath] = useState('/')
  const [hover, setHover] = useState<DiskNode | null>(null)
  const request = useRef(0)
  const abort = useRef<AbortController | null>(null)
  const currentPath = useRef('/')
  async function scan(target: string) {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    const id = ++request.current
    setBusy(true); setError(''); setHover(null)
    try {
      const data = await scanDiskUsage({ data: { ...coordinates, path: target }, signal: controller.signal })
      if (id !== request.current) return
      if (!data.ok) { setError(data.error); return }
      setResult(data); setPath(data.root.path); currentPath.current = data.root.path
    } catch (e) {
      if (id === request.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Disk scan failed.')
    } finally { if (id === request.current) setBusy(false) }
  }
  useEffect(() => {
    void scan(currentPath.current)
    return () => { ++request.current; abort.current?.abort() }
  }, [coordinates.host, coordinates.port, coordinates.username, coordinates.password, refreshKey])
  const root = result?.root
  const selected = hover ?? root
  const colors = ['var(--orange)', 'var(--green)', 'var(--blue)', 'var(--amber)']
  const percent = (size: number) => root?.size ? `${(size / root.size * 100).toFixed(1)}%` : '—'
  return <section className="panel disk-analyzer" aria-busy={busy}>
    <div className="panel-header"><h2>Disk usage analyzer</h2><span role="status">{busy ? 'Scanning server…' : result ? `Scanned ${new Date(result.scannedAt).toLocaleTimeString()}` : 'Waiting for scan'}</span></div>
    <div className="disk-body">
      <form className="disk-toolbar" onSubmit={e => { e.preventDefault(); void scan(path) }}>
        <button type="button" className="period-button" disabled={busy} onClick={() => void scan('/')}><Folder size={15} /> Root</button>
        <button type="button" className="period-button" disabled={busy} onClick={() => void scan('.')}><Home size={15} /> Home</button>
        <button type="button" className="period-button" disabled={busy || !root || root.path === '/'} onClick={() => void scan(root!.path.slice(0, root!.path.lastIndexOf('/')) || '/')}><ArrowUp size={15} /> Up</button>
        <label className="input-shell disk-path"><span className="sr-only">Absolute server path</span><input value={path} onChange={e => setPath(e.target.value)} disabled={busy} aria-label="Absolute server path" /></label>
        <button className="period-button" disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''} /> Scan</button>
      </form>
      {error && <p role="alert" className="live-error">{error} {result && 'The previous scan remains displayed.'}</p>}
      {result && <>
        <div className="disk-capacity">{Object.entries(result.capacity).map(([label, value]) => <div key={label}><span>Filesystem {label}</span><strong>{diskSize(value)}</strong></div>)}</div>
        <div className="disk-capacity-bar" aria-label={`Filesystem used: ${(result.capacity.used / result.capacity.total * 100).toFixed(1)}%. Available: ${diskSize(result.capacity.available)}. Remaining space is filesystem reserved space.`}><span style={{ width: `${result.capacity.used / result.capacity.total * 100}%` }} /><span style={{ width: `${result.capacity.available / result.capacity.total * 100}%` }} /></div>
        {result.partial && <p role="status" className="connection-hint">Incomplete scan: {result.timedOut ? 'the 45-second limit was reached' : 'some entries could not be read or changed during scanning'}. Sizes show only the data read. Choose a smaller folder to inspect it.</p>}
        <div className="disk-layout">
          <div className="disk-chart-wrap">
            <svg viewBox="0 0 400 400" className="disk-chart" role="group" aria-label={`Disk usage rings for ${root!.path}. Inner ring: immediate entries. Outer ring: their contents.`}>
              <circle cx="200" cy="200" r="160" fill="none" stroke="var(--line)" strokeWidth="72" />
              <circle cx="200" cy="200" r="98" fill="none" stroke="var(--line)" strokeWidth="46" />
              {diskSegments(root!).map(segment => <path key={`${segment.level}:${segment.node.path}`} d={ringPath(segment.start, segment.end, segment.level ? 126 : 75, segment.level ? 195 : 121)} fill={colors[segment.color % colors.length]} fillOpacity={segment.level ? .65 : 1} stroke="var(--panel)" strokeWidth="1.5" role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy} aria-label={`${segment.node.path}: ${diskSize(segment.node.size)}, ${percent(segment.node.size)} of scanned size. Open entry.`} onMouseEnter={() => setHover(segment.node)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(segment.node)} onBlur={() => setHover(null)} onClick={() => { if (!busy) void scan(segment.node.path) }} onKeyDown={e => { if (!busy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void scan(segment.node.path) } }}><title>{segment.node.path}: {diskSize(segment.node.size)}</title></path>)}
              <text x="200" y="195" textAnchor="middle" className="disk-center-size">{diskSize(selected!.size)}</text>
              <text x="200" y="217" textAnchor="middle" className="disk-center-label">{hover ? percent(hover.size) : result.partial ? 'read so far' : 'scanned size'}</text>
            </svg>
            <p className="disk-selection">{selected!.path}</p>
          </div>
          <div className="disk-table-wrap"><table className="disk-table"><caption>{root!.path} — allocated disk space</caption><thead><tr><th scope="col">Entry</th><th scope="col">Size</th><th scope="col">Share</th></tr></thead><tbody>
            {root!.children.map((node, index) => <tr key={node.path}><td><button disabled={busy} onClick={() => void scan(node.path)}><span className="disk-swatch" style={{ background: colors[index % colors.length] }} />{node.name}</button></td><td>{diskSize(node.size)}</td><td>{percent(node.size)}</td></tr>)}
            {root!.size > root!.children.reduce((sum, node) => sum + node.size, 0) && <tr><td>{result.kind === 'file' ? 'Selected file' : 'Directory metadata / other blocks'}</td><td>{diskSize(root!.size - root!.children.reduce((sum, node) => sum + node.size, 0))}</td><td>{percent(root!.size - root!.children.reduce((sum, node) => sum + node.size, 0))}</td></tr>}
            {!root!.children.length && !root!.size && <tr><td colSpan={3}>{result.partial ? 'No sizes were obtained.' : 'No allocated blocks.'}</td></tr>}
          </tbody></table></div>
        </div>
        <p className="connection-hint">Select a ring segment or entry to inspect it. Inner ring: immediate entries. Outer ring: their contents. Each scan stays on one filesystem and does not follow symbolic links inside the selected folder. Hard-linked files are counted once. Scanned file sizes can differ from filesystem usage because of permissions, filesystem metadata, deleted open files, and other mounts.</p>
      </>}
    </div>
  </section>
}
