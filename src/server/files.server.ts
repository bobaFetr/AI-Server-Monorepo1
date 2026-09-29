import { getRequest } from '@tanstack/react-start/server'
import { assertLocalRequest } from './local-request'
import { trustedHostKeys } from './known-hosts'
import { browseSftp } from './files-sftp'
import type { FileRequest, FileResult } from './files-input'

let active = 0
export async function browseFiles(data: FileRequest): Promise<FileResult> {
  assertLocalRequest(getRequest(), import.meta.env.DEV)
  if (active >= 4) return { ok: false, error: 'Too many file requests. Wait and try again.' }
  active++
  try { return await browseSftp(data, await trustedHostKeys(data.host, data.port)) }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to browse files.' } }
  finally { active-- }
}
