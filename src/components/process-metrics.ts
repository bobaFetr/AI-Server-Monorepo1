export type ProcessMetrics = {
  cpu: number | null
  ioWait: number | null
  memory: number | null
  memoryUsed: number | null
  memoryTotal: number | null
  cache: number | null
  swap: number | null
  tasks: number | null
  runningTasks: number | null
  taskKind: 'Processes' | 'Threads' | null
  load: number[]
}

// Parse LC_ALL=C top summaries; unknown fields remain unavailable, never zero.
export function parseProcessMetrics(output: string): ProcessMetrics {
  const cpuLine = output.split('\n').find(line => /%?Cpu\(s\)/.test(line)) ?? ''
  const numberToken = '(?:\\d+(?:\\.\\d+)?|\\.\\d+)'
  const finiteNumber = (value: string | undefined) => {
    if (value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  const cpuField = (field: string) => {
    const match = cpuLine.match(new RegExp(`(?:^|[,:\\s])(${numberToken})\\s*${field}\\b`))
    const value = finiteNumber(match?.[1])
    return value !== null && value <= 100 ? value : null
  }
  const idle = cpuField('id')
  const activeFields = ['us', 'sy', 'ni', 'hi', 'si'].map(cpuField)
  const ioWait = cpuField('wa')
  const steal = cpuField('st')
  const active = activeFields.every(value => value !== null) ? (activeFields as number[]).reduce((sum, value) => sum + value, 0) : null
  // top rounds each CPU category to one decimal; allow that rounding, not impossible totals.
  const cpuTotal = active !== null && idle !== null && ioWait !== null ? active + idle + ioWait + (steal ?? 0) : null
  const cpuValid = cpuTotal !== null && Math.abs(cpuTotal - 100) <= 0.5
  const memoryLine = output.match(/([KMGTPE]iB)\s+Mem\s*:\s*([^\n]+)/i)
  const swapLine = output.match(/([KMGTPE]iB)\s+Swap\s*:\s*([^\n]+)/i)
  const readMemory = (match: RegExpMatchArray | null, field: string) => {
    if (!match) return null
    const value = match[2].match(new RegExp(`(?:^|[,\\s])(${numberToken})\\s+${field.replace('/', '\\/')}\\b`))
    const power = 'KMGTPE'.indexOf(match[1][0].toUpperCase()) + 1
    const parsed = finiteNumber(value?.[1])
    const bytes = parsed === null ? null : parsed * 1024 ** power
    return bytes !== null && Number.isFinite(bytes) ? bytes : null
  }
  const memoryUsed = readMemory(memoryLine, 'used')
  const memoryTotal = readMemory(memoryLine, 'total')
  const swapUsed = readMemory(swapLine, 'used')
  const swapTotal = readMemory(swapLine, 'total')
  const tasks = output.match(/(Tasks|Threads):\s*(\d+)\s+total,\s*(\d+)\s+running/)
  const load = output.match(new RegExp(`load average:\\s*(${numberToken}),\\s*(${numberToken}),\\s*(${numberToken})(?:\\s|$)`))
  const loads = load ? load.slice(1).map(finiteNumber) : []
  const percentage = (used: number | null, total: number | null) => used !== null && total !== null && total > 0 && used <= total ? used / total * 100 : null
  return {
    cpu: cpuValid && active !== null ? Math.min(100, active) : null,
    ioWait: cpuValid ? ioWait : null, memory: percentage(memoryUsed, memoryTotal), memoryUsed, memoryTotal,
    cache: readMemory(memoryLine, 'buff/cache'),
    swap: swapTotal === 0 && swapUsed === 0 ? 0 : percentage(swapUsed, swapTotal),
    tasks: tasks && Number.isSafeInteger(Number(tasks[2])) ? Number(tasks[2]) : null,
    runningTasks: tasks && Number.isSafeInteger(Number(tasks[3])) && Number(tasks[3]) <= Number(tasks[2]) ? Number(tasks[3]) : null,
    taskKind: tasks ? tasks[1] === 'Threads' ? 'Threads' : 'Processes' : null,
    load: loads.length === 3 && loads.every(value => value !== null) ? loads as number[] : [],
  }
}

export type PerformanceSample = ProcessMetrics & { sampledAt: number; breakBefore?: boolean }
