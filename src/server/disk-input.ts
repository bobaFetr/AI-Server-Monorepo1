import { validateInput, type Coordinates } from './ssh-input'

export type DiskRequest = Coordinates & { path: string }
export type DiskNode = { path: string; name: string; size: number; children: DiskNode[] }
export type DiskScan = { ok: true; root: DiskNode; kind: 'directory' | 'file'; capacity: { total: number; used: number; available: number }; partial: boolean; timedOut: boolean; scannedAt: number }
export type DiskResult = DiskScan | { ok: false; error: string }

export function validateDiskRequest(input: unknown): DiskRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid disk scan request.')
  const data = input as Record<string, unknown>
  const coordinates = validateInput({ ...data, operation: 'overview' })
  if (typeof data.path !== 'string' || (data.path !== '.' && !data.path.startsWith('/')) || data.path.includes('\0') || data.path.length > 4096) throw new Error('Enter an absolute server path, or use Home.')
  return { host: coordinates.host, port: coordinates.port, username: coordinates.username, password: coordinates.password, path: data.path }
}
