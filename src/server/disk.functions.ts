import { createServerFn } from '@tanstack/react-start'
import { validateDiskRequest } from './disk-input'

export const scanDiskUsage = createServerFn({ method: 'POST' })
  .inputValidator(validateDiskRequest)
  .handler(async ({ data }) => {
    const { scanDisk } = await import('./disk.server')
    return scanDisk(data)
  })
