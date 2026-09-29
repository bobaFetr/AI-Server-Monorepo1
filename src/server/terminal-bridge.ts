import { Client, type ClientChannel } from 'ssh2'
import { WebSocket } from 'ws'
import { validateInput } from './ssh-input.ts'
import { readTerminalIdentity } from './terminal-identity.ts'

export function terminalSize(cols: unknown, rows: unknown) {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || Number(cols) < 2 || Number(cols) > 500 || Number(rows) < 1 || Number(rows) > 200) throw new Error('Invalid terminal dimensions.')
  return { cols: Number(cols), rows: Number(rows) }
}

export function attachTerminal(socket: WebSocket, getKeys: (host: string, port: string) => Promise<string[]>) {
  const client = new Client()
  let channel: ClientChannel | undefined
  let phase: 'waiting' | 'connecting' | 'ready' | 'closed' = 'waiting'
  let untrusted = false
  let alive = true
  let pendingOutput = 0
  const send = (message: object) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)) }
  const close = (message?: string) => {
    if (phase === 'closed') return
    phase = 'closed'
    clearTimeout(deadline)
    clearInterval(heartbeat)
    if (message) send({ type: 'error', message })
    channel?.close()
    client.destroy()
    if (socket.readyState === WebSocket.OPEN) socket.close(1000)
  }
  const deadline = setTimeout(() => close('Terminal connection timed out.'), 20000)
  const heartbeat = setInterval(() => {
    if (!alive) { close(); socket.terminate(); return }
    alive = false
    if (socket.readyState === WebSocket.OPEN) socket.ping()
  }, 15000)
  socket.on('pong', () => { alive = true })
  socket.on('close', () => close())
  socket.on('error', () => close())
  client.on('error', (error: Error & { level?: string }) => close(untrusted ? 'VM host key verification failed.' : error.level === 'client-authentication' ? 'Ubuntu rejected the terminal login. Check the username/password.' : 'SSH terminal connection failed.'))
  client.on('close', () => {
    if (phase !== 'closed') { send({ type: 'closed', message: 'SSH session ended.' }); close() }
  })
  socket.on('message', async (raw, binary) => {
    if (phase === 'closed') return
    try {
      const payload = Array.isArray(raw) ? Buffer.concat(raw) : Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
      if (binary || payload.length > 65536) throw new Error('Invalid terminal message.')
      const message = JSON.parse(payload.toString())
      if (!message || typeof message !== 'object') throw new Error('Invalid terminal message.')
      if (message.type === 'connect') {
        if (phase !== 'waiting') throw new Error('Terminal is already connecting.')
        phase = 'connecting'
        const data = validateInput({ ...message.coordinates, operation: 'overview' })
        const size = terminalSize(message.cols, message.rows)
        const keys = await getKeys(data.host, data.port)
        if (socket.readyState !== WebSocket.OPEN) return
        client.once('ready', async () => {
          let identity: { username: string; hostname: string }
          try { identity = await readTerminalIdentity(client) }
          catch { close('Unable to verify the Ubuntu session username and hostname.'); return }
          if (socket.readyState !== WebSocket.OPEN) return
          client.shell({ term: 'xterm-256color', ...size }, (error, stream) => {
            if (error) { close('The VM refused an interactive shell.'); return }
            if (socket.readyState !== WebSocket.OPEN) { stream.close(); return }
            channel = stream
            phase = 'ready'
            clearTimeout(deadline)
            const output = (chunk: Buffer) => {
              if (socket.readyState !== WebSocket.OPEN) return
              pendingOutput += chunk.length
              if (pendingOutput > 2 * 1024 * 1024 || socket.bufferedAmount > 1024 * 1024) { close('Terminal output exceeded the browser buffer limit.'); return }
              socket.send(chunk, { binary: true })
              if (pendingOutput > 128 * 1024) stream.pause()
            }
            stream.on('data', output)
            stream.stderr.on('data', output)
            stream.on('error', () => close('SSH terminal stream failed.'))
            stream.on('close', () => { send({ type: 'closed', message: 'Shell exited.' }); close() })
            send({ type: 'ready', ...identity })
          })
        })
        client.connect({ host: data.host, port: Number(data.port), username: data.username, password: data.password,
          authHandler: ['password'], tryKeyboard: false, readyTimeout: 10000, keepaliveInterval: 10000, keepaliveCountMax: 3,
          hostVerifier: (key: Buffer) => { untrusted = !keys.includes(key.toString('base64')); return !untrusted },
        })
      } else if (phase === 'ready' && channel) {
        if (message.type === 'input') {
          if (typeof message.data !== 'string' || message.data.length > 16384) throw new Error('Terminal input is too large.')
          if (channel.writableLength > 256 * 1024) throw new Error('Terminal input buffer is full.')
          channel.write(message.data)
        } else if (message.type === 'resize') {
          const size = terminalSize(message.cols, message.rows)
          channel.setWindow(size.rows, size.cols, 0, 0)
        } else if (message.type === 'ack') {
          if (!Number.isInteger(message.bytes) || message.bytes <= 0 || message.bytes > pendingOutput) throw new Error('Invalid terminal acknowledgement.')
          pendingOutput -= message.bytes
          if (pendingOutput < 64 * 1024) channel.resume()
        } else throw new Error('Unknown terminal message.')
      } else throw new Error('Terminal is not ready.')
    } catch (error) { close(error instanceof SyntaxError ? 'Invalid terminal message.' : error instanceof Error ? error.message : 'Terminal connection failed.') }
  })
  return close
}
