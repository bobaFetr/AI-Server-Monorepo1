import { getRequest } from '@tanstack/react-start/server'
import { commandForInput, type SshInput } from './ssh-input'
import { assertLocalRequest } from './local-request'
import { passwordSsh } from './password-ssh'
import { latestProcessSnapshot } from './process-snapshot'

import { trustedHostKeys } from './known-hosts'
let active = 0
export async function executeSsh(data: SshInput): Promise<{ ok: boolean; output: string }> {
  assertLocalRequest(getRequest(), import.meta.env.DEV)
  if (active >= 4) return { ok: false, output: 'Too many operations. Wait for the current request to finish.' }
  active++
  try {
    let keys: string[]
    try { keys = await trustedHostKeys(data.host, data.port) }
    catch (error) { return { ok: false, output: error instanceof Error ? error.message : 'Host verification failed.' } }
    const command = commandForInput(data)
    const result = await passwordSsh(data, command, keys)
    if (result.ok && data.operation === 'processes') {
      try { return { ok: true, output: latestProcessSnapshot(result.output) } }
      catch { return { ok: false, output: 'The VM did not return a complete process sample. Check that top (procps) is installed.' } }
    }
    return result
  } finally { active-- }
}
