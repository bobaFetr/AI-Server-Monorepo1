// Browser monotonic times measure silence independently of wall-clock changes.
// Frame completion latency is measured entirely on the server, never by subtracting
// timestamps from different machines. Display latency must not count as stream silence.
export function processFreshness(receivedAt: number | null, now: number, interval: number, completionDelayMs = 0) {
  if (receivedAt === null) return { age: null, sinceUpdate: null, stale: false }
  const sinceUpdate = Math.max(0, (now - receivedAt) / 1000)
  const completionDelay = Math.max(0, completionDelayMs / 1000)
  return {
    age: completionDelay + sinceUpdate,
    sinceUpdate,
    stale: sinceUpdate > Math.max(3, interval * 2) || completionDelay > interval * 2 + 2,
  }
}
