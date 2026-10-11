import type { PerformanceSample } from './process-metrics'

export const historyWindowMs = 60_000

export function historyWindow(samples: PerformanceSample[]) {
  const end = samples.at(-1)?.sampledAt ?? 0
  const start = end - historyWindowMs
  return { start, end, samples: samples.filter(sample => sample.sampledAt >= start && sample.sampledAt <= end) }
}

export function historyX(sampledAt: number, start: number) {
  return 40 + (sampledAt - start) / historyWindowMs * 510
}
