export function trendScale(values: number[]) {
  const valid = values.filter(value => Number.isFinite(value) && value >= 0 && value <= 100)
  if (!valid.length) return { min: 0, max: 100 }
  const low = Math.min(...valid)
  const high = Math.max(...valid)
  const padding = Math.max(0.25, (high - low) * 0.15)
  const min = Math.max(0, Math.floor((low - padding) * 10) / 10)
  const max = Math.min(100, Math.ceil((high + padding) * 10) / 10)
  return { min, max }
}
