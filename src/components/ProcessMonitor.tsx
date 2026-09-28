import { useEffect, useState } from 'react'
import { Pause, Play, RefreshCw } from 'lucide-react'
import { runSsh } from '../server/ssh.functions'
import type { Coordinates } from '../server/ssh-input'

export function ProcessMonitor({ coordinates }: { coordinates: Coordinates }) {
  const [running, setRunning] = useState(true)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState<string | null>(null)
  const { host, port, username, password } = coordinates

  useEffect(() => {
    if (!running) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function sample() {
      try {
        const result = await runSsh({ data: { host, port, username, password, operation: 'processes' } })
        if (stopped) return
        if (!result.ok) throw new Error(result.output)
        setOutput(result.output)
        setUpdated(new Date().toLocaleTimeString())
        setError('')
        // Schedule only after completion; slow SSH requests cannot accumulate.
        timer = setTimeout(() => void sample(), 100)
      } catch (cause) {
        if (stopped) return
        setError(cause instanceof Error ? cause.message : 'Process monitoring failed.')
        setRunning(false)
      }
    }
    void sample()
    return () => { stopped = true; clearTimeout(timer) }
  }, [running, host, port, username, password])

  return <>
    <div className="live-tabs"><button className="period-button" onClick={() => setRunning(value => !value)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause updates' : 'Resume updates'}</button><span role="status">{running ? 'Live · 1-second CPU samples plus connection time' : 'Updates paused'}{updated ? ` · Last received ${updated}` : ''}</span></div>
    {error && <p className="live-error" role="alert">{error} Updates stopped; displayed results are stale. Resume to retry.</p>}
    <section className="panel"><div className="panel-header"><h2>Processes</h2>{running && <RefreshCw size={16} className="spin" aria-label="Automatic updates active" />}</div><pre className="live-output">{output || (running ? 'Collecting a one-second CPU sample from the VM…' : 'No sample collected.')}</pre></section>
  </>
}
