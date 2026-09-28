import { assertLocalRequest } from './local-request'
import { validateInput } from './ssh-input'
import { trustedHostKeys } from './known-hosts'
import { streamProcesses } from './process-stream'

let monitors = 0
export async function processMonitor(request: Request) {
  try { assertLocalRequest(request, import.meta.env.DEV) }
  catch { return Response.json({ error: 'Only local, same-origin monitoring is allowed.' }, { status: 403 }) }
  if (monitors >= 4) return Response.json({ error: 'Too many active monitors. Close another monitor and retry.' }, { status: 429 })
  monitors++
  let released = false
  const release = () => { if (!released) { released = true; monitors-- } }
  try {
    const body = await request.text()
    if (body.length > 8192) throw new Error('Monitoring request is too large.')
    const input = JSON.parse(body)
    const interval = input.interval ?? 3
    if (![1, 2, 3, 5].includes(interval)) throw new Error('Unsupported sampling interval.')
    const data = validateInput({ ...input, operation: 'processes' })
    const keys = await trustedHostKeys(data.host, data.port)
    return new Response(streamProcesses(data, keys, request.signal, release, interval), {
      headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    })
  } catch (error) {
    release()
    return Response.json({ error: error instanceof SyntaxError ? 'Invalid monitoring request.' : error instanceof Error ? error.message : 'Unable to start monitoring.' }, { status: 400 })
  }
}
