import { Client } from 'ssh2'
import { StringDecoder } from 'node:string_decoder'
import type { Coordinates } from './ssh-input'

// A delimiter after each completed measurement avoids rendering partial frames.
// Reuse SSH instead of repeating authentication for every measurement.
export function monitorCommand(interval: number) {
  if (![1, 2, 3, 5].includes(interval)) throw new Error('Unsupported sampling interval.')
  return `while :; do LC_ALL=C top -b -n 2 -d ${interval} -w 180 -E k -o %CPU || exit; printf '\\036'; done`
}

export function streamProcesses(data: Coordinates, keys: string[], signal: AbortSignal, onDone: () => void, interval = 3) {
  const command = monitorCommand(interval)
  let stop = () => {}
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const client = new Client()
      const encoder = new TextEncoder()
      const decoder = new StringDecoder('utf8')
      let buffer = ''
      let done = false
      let untrusted = false
      let deadline: ReturnType<typeof setTimeout>
      const finish = (message?: string, cancelled = false) => {
        if (done) return
        done = true
        clearTimeout(deadline)
        signal.removeEventListener('abort', abort)
        client.destroy()
        onDone()
        if (!cancelled) {
          if (message) controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + '\n'))
          controller.close()
        }
      }
      const abort = () => finish(undefined)
      stop = () => finish(undefined, true)
      const resetDeadline = () => {
        clearTimeout(deadline)
        deadline = setTimeout(() => finish('Process monitoring timed out. Displayed data is stale.'), 15000)
      }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) { abort(); return }
      resetDeadline()
      client.on('error', (error: Error & { level?: string }) => finish(untrusted ? 'VM host key verification failed.' : error.level === 'client-authentication' ? 'Authentication failed. Check the Ubuntu username/password and SSH password authentication.' : 'SSH monitoring connection failed.'))
      client.on('close', () => finish('SSH monitoring connection closed.'))
      client.on('ready', () => client.exec(command, (error, channel) => {
        if (done) { channel?.close(); return }
        if (error) { finish('The VM refused the process monitor.'); return }
        channel.on('error', () => finish('The process monitor failed.'))
        channel.on('close', () => finish('The process monitor stopped. Check that top (procps) is installed.'))
        channel.stderr.on('data', () => { /* Do not expose arbitrary server diagnostic output. */ })
        channel.on('data', (chunk: Buffer) => {
          if (done) return
          buffer += decoder.write(chunk)
          if (Buffer.byteLength(buffer) > 1024 * 1024) { finish('Process sample exceeded the size limit.'); return }
          let separator: number
          while ((separator = buffer.indexOf('\x1e')) !== -1) {
            const sample = buffer.slice(0, separator)
            buffer = buffer.slice(separator + 1)
            const frames = sample.split(/(?=^top - )/m).filter(frame => frame.startsWith('top - '))
            if (frames.length !== 2) { finish('Incomplete process sample received.'); return }
            if ((controller.desiredSize ?? 0) <= 0) { finish('Monitoring paused because the browser cannot keep up.'); return }
            controller.enqueue(encoder.encode(JSON.stringify({ output: frames[1].trim(), sampledAt: Date.now() }) + '\n'))
            resetDeadline()
          }
        })
      }))
      try {
        client.connect({ host: data.host, port: Number(data.port), username: data.username, password: data.password, authHandler: ['password'], tryKeyboard: false, readyTimeout: 10000,
          keepaliveInterval: 5000, keepaliveCountMax: 2,
          hostVerifier: (key: Buffer) => { untrusted = !keys.includes(key.toString('base64')); return !untrusted },
        })
      } catch { finish('Unable to start process monitoring.') }
    },
    cancel() { stop() },
  })
}
