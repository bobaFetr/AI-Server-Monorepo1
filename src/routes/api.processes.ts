import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/processes')({
  server: { handlers: { POST: async ({ request }) => {
    const { processMonitor } = await import('../server/process-monitor.server')
    return processMonitor(request)
  } } },
})
