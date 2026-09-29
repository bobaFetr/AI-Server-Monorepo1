import type { Client, ClientChannel } from 'ssh2'
import { StringDecoder } from 'node:string_decoder'

export const identityCommand = "printf '\\036'; id -un && hostname"

export function readTerminalIdentity(client: Client): Promise<{ username: string; hostname: string }> {
  return new Promise((resolve, reject) => {
    let finished = false
    let channel: ClientChannel | undefined
    const finish = (identity?: { username: string; hostname: string }) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (identity) resolve(identity)
      else { channel?.close(); reject(new Error('Unable to verify the Ubuntu session username and hostname.')) }
    }
    const timer = setTimeout(() => finish(), 5000)
    client.exec(identityCommand, (error, stream) => {
      if (error) { finish(); return }
      if (finished) { stream.close(); return }
      channel = stream
      let output = ''
      const decoder = new StringDecoder('utf8')
      stream.on('data', (chunk: Buffer) => {
        output += decoder.write(chunk)
        if (output.length > 4096) { stream.close(); finish() }
      })
      stream.stderr.on('data', () => {})
      stream.on('error', () => finish())
      stream.on('close', (code: number) => {
        output += decoder.end()
        const marker = output.lastIndexOf('\x1e')
        const lines = output.slice(marker + 1).trim().split(/\r?\n/)
        if (marker === -1 || code !== 0 || lines.length !== 2 || lines.some(line => !/^[^\s\x00-\x1f\x7f]{1,255}$/.test(line))) { finish(); return }
        finish({ username: lines[0], hostname: lines[1] })
      })
    })
  })
}
