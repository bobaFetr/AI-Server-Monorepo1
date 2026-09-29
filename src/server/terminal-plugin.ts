import type { Plugin } from 'vite'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer } from 'ws'
import { attachTerminal } from './terminal-bridge.ts'
import { trustedHostKeys } from './known-hosts.ts'

export function allowedTerminalUpgrade(request: IncomingMessage) {
  const address = request.socket.remoteAddress
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '')) return false
  try {
    const url = new URL(`http://${request.headers.host}`)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && request.headers.origin === url.origin
  } catch { return false }
}

export function terminalPlugin(): Plugin {
  return {
    name: 'northstar-local-terminal', apply: 'serve',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true, maxPayload: 65536, perMessageDeflate: false })
      const sessions = new Set<() => void>()
      const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (request.url?.split('?')[0] !== '/api/terminal') return
        if (!allowedTerminalUpgrade(request) || sessions.size >= 4) {
          socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
          return
        }
        wss.handleUpgrade(request, socket, head, ws => {
          const close = attachTerminal(ws, trustedHostKeys)
          sessions.add(close)
          ws.once('close', () => sessions.delete(close))
        })
      }
      server.httpServer?.on('upgrade', upgrade)
      const cleanup = () => {
        server.httpServer?.off('upgrade', upgrade)
        for (const close of sessions) close()
        for (const socket of wss.clients) socket.terminate()
        wss.close()
      }
      server.httpServer?.once('close', cleanup)
      const originalClose = server.close.bind(server)
      server.close = async () => { cleanup(); await originalClose() }
    },
  }
}
