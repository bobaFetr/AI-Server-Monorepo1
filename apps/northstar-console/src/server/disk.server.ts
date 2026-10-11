import { getRequest } from '@tanstack/react-start/server'
import { assertLocalRequest } from './local-request'
import { trustedHostKeys } from './known-hosts'
import { passwordSsh } from './password-ssh'
import { diskScanCommand, parseDiskScan } from './disk-scan'
import type { DiskRequest, DiskResult } from './disk-input'

let scans = 0
export async function scanDisk(data: DiskRequest): Promise<DiskResult> {
  assertLocalRequest(getRequest(), import.meta.env.DEV)
  if (scans >= 2) return { ok: false, error: 'Two disk scans are already running. Wait and retry.' }
  scans++
  try {
    const result = await passwordSsh(data, diskScanCommand(data.path), await trustedHostKeys(data.host, data.port), 60000)
    if (!result.ok) return { ok: false, error: result.output }
    return parseDiskScan(result.output)
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Disk scan failed.' } }
  finally { scans-- }
}
