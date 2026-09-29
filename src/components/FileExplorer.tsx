import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, File, Folder, Home, Link, RefreshCw, Search, X } from 'lucide-react'
import { browseRemoteFiles } from '../server/files.functions'
import type { FileResult } from '../server/files-input'
import type { Coordinates } from '../server/ssh-input'

type Directory = Extract<FileResult, { kind: 'directory' }>
type Preview = Extract<FileResult, { kind: 'file' }>
function sizeLabel(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function FileExplorer({ coordinates }: { coordinates: Coordinates }) {
  const [directory, setDirectory] = useState<Directory | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [path, setPath] = useState('/')
  const [offset, setOffset] = useState(0)
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  async function browse(target: string, pageOffset = 0) {
    const id = ++requestId.current
    setBusy(true); setError(''); setPreview(null)
    try {
      const result = await browseRemoteFiles({ data: { ...coordinates, path: target, offset: pageOffset } })
      if (id !== requestId.current) return
      if (!result.ok) { setError(result.error); return }
      if (result.kind === 'directory') {
        setDirectory(result); setPath(result.path); setOffset(pageOffset); setFilter('')
      } else { setPreview(result); if (directory) setPath(directory.path) }
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : 'File request failed.')
    } finally { if (id === requestId.current) setBusy(false) }
  }
  useEffect(() => {
    void browse('/')
    return () => { requestId.current++ }
  }, [coordinates.host, coordinates.port, coordinates.username, coordinates.password])

  const entries = directory?.entries.filter(entry => (hidden || !entry.name.startsWith('.')) && entry.name.toLowerCase().includes(filter.toLowerCase())).sort((a, b) => Number(b.type === 'directory') - Number(a.type === 'directory') || a.name.localeCompare(b.name)) ?? []
  const parent = directory?.path.replace(/\/[^/]+\/?$/, '') || '/'
  const openPath = (event: FormEvent) => { event.preventDefault(); void browse(path) }
  return <section className="panel file-explorer">
    <div className="panel-header"><h2><Folder size={18} /> File Explorer</h2><span role="status">{busy ? 'Reading from Ubuntu…' : directory ? `${directory.entries.length} entries on this page` : 'Server filesystem'}</span></div>
    <div className="file-navigation">
      <div className="live-tabs"><button className="period-button" disabled={busy} onClick={() => void browse('/')}><Folder size={16} /> Root /</button><button className="period-button" disabled={busy} onClick={() => void browse('.')}><Home size={16} /> Home</button><button className="period-button" disabled={busy || !directory || directory.path === '/'} onClick={() => void browse(parent)}><ArrowUp size={16} /> Up</button><button className="period-button" disabled={busy} onClick={() => void browse(directory?.path ?? '/', offset)}><RefreshCw size={16} /> Refresh</button></div>
      <form className="file-path-form" onSubmit={openPath}><label className="field-label" htmlFor="remote-path">Server path</label><div className="input-shell"><input id="remote-path" value={path} disabled={busy} onChange={event => setPath(event.target.value)} spellCheck={false} required /><button className="period-button" type="submit" disabled={busy}>Open</button></div></form>
      <div className="file-filter"><div className="input-shell"><Search size={16} /><input aria-label="Filter this directory page" value={filter} onChange={event => setFilter(event.target.value)} placeholder="Filter this page by name" /></div><label><input type="checkbox" checked={hidden} onChange={event => setHidden(event.target.checked)} /> Show hidden files</label></div>
    </div>
    {error && <p className="live-error" role="alert">{error}{directory && ` Still showing ${directory.path}.`}</p>}
    {directory && <><nav className="file-breadcrumbs" aria-label="Directory path"><button disabled={busy} onClick={() => void browse('/')}>/</button>{directory.path.split('/').filter(Boolean).map((part, index, parts) => <button disabled={busy} key={index} onClick={() => void browse('/' + parts.slice(0, index + 1).join('/'))}>{part} /</button>)}</nav>
      <div className="file-table-wrap" aria-busy={busy}><table className="file-table"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Permissions</th><th>Owner UID:GID</th><th>Modified</th></tr></thead><tbody>{entries.map(entry => <tr key={entry.name}><td><button disabled={busy} onClick={() => void browse((directory.path === '/' ? '' : directory.path) + '/' + entry.name)}>{entry.type === 'directory' ? <Folder size={16} /> : entry.type === 'link' ? <Link size={16} /> : <File size={16} />}<span>{entry.name}</span></button></td><td>{entry.type}</td><td>{entry.type === 'directory' ? '—' : sizeLabel(entry.size)}</td><td><code>{entry.mode}</code></td><td>{entry.uid}:{entry.gid}</td><td>{new Date(entry.modified).toLocaleString()}</td></tr>)}</tbody></table>{entries.length === 0 && <p className="file-empty">{directory.entries.length === 0 ? 'This directory is empty.' : 'No entries match the current filters on this page.'}</p>}</div>
      <div className="live-tabs file-pagination"><button className="period-button" disabled={busy || offset === 0} onClick={() => void browse(directory.path, Math.max(0, offset - 200))}>Previous</button><span>Page {Math.floor(offset / 200) + 1}</span><button className="period-button" disabled={busy || directory.nextOffset === null} onClick={() => void browse(directory.path, directory.nextOffset!)}>Next</button></div></>}
    {preview && <section className="file-preview"><div className="panel-header"><h3>{preview.path}</h3><button className="period-button" onClick={() => setPreview(null)} aria-label="Close file preview"><X size={16} /></button></div>{preview.binary ? <p>Binary file · {sizeLabel(preview.size)}. Text preview is unavailable.</p> : <><p>Read-only UTF-8 preview · {sizeLabel(preview.size)}{preview.truncated && ' · Showing the first 64 KB only'}</p><pre>{preview.content || '(Empty file)'}</pre></>}</section>}
    <p className="connection-hint">Browsing as {coordinates.username}. Hidden files are included. Linux permissions apply; protected directories may be inaccessible. Symbolic links open their target. Listings are paged in groups of 200; refresh after filesystem changes.</p>
  </section>
}
