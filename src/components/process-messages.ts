const maxMessageLength = 1024 * 1024
export type ProcessMessage = { output: string; sampledAt: number } | { error: string }

export function parseProcessMessage(line: string): ProcessMessage {
  if (line.length > maxMessageLength) throw new Error('Process sample exceeded the size limit.')
  let data: unknown
  try { data = JSON.parse(line) } catch { throw new Error('Invalid process monitoring response.') }
  if (!data || typeof data !== 'object') throw new Error('Invalid process monitoring response.')
  const message = data as Record<string, unknown>
  if (typeof message.error === 'string' && message.error.length > 0 && message.error.length <= 4096) return { error: message.error }
  if (typeof message.output !== 'string' || typeof message.sampledAt !== 'number' || !Number.isSafeInteger(message.sampledAt) || message.sampledAt <= 0 || message.sampledAt > 8.64e15) throw new Error('Invalid process monitoring response.')
  return { output: message.output, sampledAt: message.sampledAt }
}

export class ProcessMessageDecoder {
  private decoder = new TextDecoder('utf-8', { fatal: true })
  private buffer = ''

  push(chunk: Uint8Array): ProcessMessage[] {
    this.buffer += this.decoder.decode(chunk, { stream: true })
    const messages: ProcessMessage[] = []
    let newline: number
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      messages.push(parseProcessMessage(this.buffer.slice(0, newline)))
      this.buffer = this.buffer.slice(newline + 1)
    }
    if (this.buffer.length > maxMessageLength) throw new Error('Process sample exceeded the size limit.')
    return messages
  }
}
