import { validateInput, type Coordinates } from './ssh-input.ts'

export type FileRequest = Coordinates & { path: string; offset: number }
export type FileEntry = { name: string; type: 'directory' | 'file' | 'link' | 'special'; size: number; modified: number; mode: string; uid: number; gid: number }
export type FileResult = { ok: false; error: string } | { ok: true; kind: 'directory'; path: string; entries: FileEntry[]; nextOffset: number | null } | { ok: true; kind: 'file'; path: string; content: string; binary: boolean; truncated: boolean; size: number }

export function validateFileRequest(input: unknown): FileRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid file request.')
  const data = input as Record<string, unknown>
  const coordinates = validateInput({ ...data, operation: 'overview' })
  if (typeof data.path !== 'string' || (data.path !== '.' && !data.path.startsWith('/')) || data.path.length > 4096 || data.path.includes('\0')) throw new Error('Enter an absolute Linux path, or use Home.')
  const offset = data.offset ?? 0
  if (!Number.isInteger(offset) || Number(offset) < 0 || Number(offset) > 1000000) throw new Error('Invalid directory page.')
  return { host: coordinates.host, port: coordinates.port, username: coordinates.username, password: coordinates.password, path: data.path, offset: Number(offset) }
}
