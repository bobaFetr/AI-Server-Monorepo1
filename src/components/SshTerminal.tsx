import { useEffect, useRef, useState } from 'react'
import { RotateCcw, TerminalSquare } from 'lucide-react'
import type { Terminal } from '@xterm/xterm'
import type { Coordinates } from '../server/ssh-input'
import { terminalInputChunks } from './terminal-input'
import '@xterm/xterm/css/xterm.css'

export function SshTerminal({ coordinates }: { coordinates: Coordinates }) {
  const element = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [status, setStatus] = useState('Connecting to Ubuntu…')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const [identity, setIdentity] = useState<{ username: string; hostname: string } | null>(null)
  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0)
  const { host, port, username, password } = coordinates
  useEffect(() => {
    let disposed = false
    let socket: WebSocket | undefined
    let terminal: Terminal | undefined
    let observer: ResizeObserver | undefined
    let ready = false
    let ended = false
    setConnecting(true); setConnected(false); setIdentity(null); setError(''); setStatus('Connecting to Ubuntu…')
    const send = (message: object) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) }
    async function open() {
      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
        if (disposed || !element.current) return
        terminal = new Terminal({ cursorBlink: true, fontFamily: '"IBM Plex Mono", monospace', fontSize: 14, scrollback: 3000, screenReaderMode: true, theme: { background: '#181c1b', foreground: '#ecebe5', cursor: '#d99755' } })
        terminalRef.current = terminal
        const fit = new FitAddon()
        terminal.loadAddon(fit)
        terminal.open(element.current)
        fit.fit()
        socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/terminal`)
        socket.binaryType = 'arraybuffer'
        socket.onopen = () => {
          if (disposed) { socket?.close(); return }
          send({ type: 'connect', coordinates: { host, port, username, password }, cols: terminal!.cols, rows: terminal!.rows })
        }
        socket.onmessage = event => {
          if (disposed) return
          if (event.data instanceof ArrayBuffer) {
            const bytes = event.data.byteLength
            terminal!.write(new Uint8Array(event.data), () => { if (!disposed && ready) send({ type: 'ack', bytes }) })
            return
          }
          const message = JSON.parse(event.data)
          if (message.type === 'ready') {
            ready = true; setConnecting(false); setConnected(true)
            setIdentity({ username: message.username, hostname: message.hostname })
            setStatus('Connected')
            fit.fit()
            send({ type: 'resize', cols: terminal!.cols, rows: terminal!.rows })
            terminal!.focus()
          } else if (message.type === 'error') {
            ready = false; ended = true; setConnecting(false); setConnected(false); setError(message.message); setStatus('Connection failed')
          } else if (message.type === 'closed') {
            ready = false; ended = true; setConnecting(false); setConnected(false); setStatus(message.message)
          }
        }
        socket.onerror = () => { if (!disposed) { ended = true; setError('Terminal connection failed. Restart the local development server if it was running before this update.'); setStatus('Connection failed') } }
        socket.onclose = () => {
          ready = false
          if (!disposed) { setConnecting(false); setConnected(false); if (!ended) setStatus('Terminal disconnected'); terminal?.writeln('\r\n[Session closed]') }
        }
        terminal.onData(data => {
          if (!ready) return
          // Bound each paste/input frame; never interpret it as a local command.
          for (const chunk of terminalInputChunks(data)) send({ type: 'input', data: chunk })
        })
        terminal.onResize(size => { if (ready) send({ type: 'resize', ...size }) })
        observer = new ResizeObserver(() => { if (!disposed) fit.fit() })
        observer.observe(element.current)
      } catch {
        if (!disposed) { setConnecting(false); setError('Unable to initialize the terminal.'); setStatus('Connection failed'); socket?.close() }
      }
    }
    void open()
    return () => {
      disposed = true; ready = false
      observer?.disconnect()
      if (socket?.readyState === WebSocket.OPEN) socket.close()
      // A socket still connecting is closed by onopen before credentials are sent.
      terminal?.dispose(); terminalRef.current = null
    }
  }, [host, port, username, password, generation])

  return <section className="panel ssh-terminal-panel">
    <div className="panel-header"><h2><TerminalSquare size={18} /> {identity ? `${identity.username}@${identity.hostname}` : 'Ubuntu terminal'}</h2><span role="status">{status}</span><button className="period-button" disabled={connected || connecting} onClick={() => setGeneration(value => value + 1)}><RotateCcw size={16} /> Reconnect</button></div>
    {error && <p className="live-error" role="alert">{error}</p>}
    <div ref={element} className="ssh-terminal-screen" aria-label="Interactive Ubuntu SSH terminal" />
    <div className="live-tabs terminal-shortcuts"><button className="period-button" disabled={!connected} onClick={() => { terminalRef.current?.input('\x03', true); terminalRef.current?.focus() }}>Ctrl+C</button><button className="period-button" disabled={!connected} onClick={() => { terminalRef.current?.input('\t', true); terminalRef.current?.focus() }}>Tab</button></div>
    <p className="connection-hint">{identity ? `SSH login verified by Ubuntu: ${identity.username} on ${identity.hostname}.` : 'Verifying the Ubuntu login account.'} The shell prompt reflects any user changes made with su or sudo. Leaving this tab or disconnecting closes this shell.</p>
  </section>
}
