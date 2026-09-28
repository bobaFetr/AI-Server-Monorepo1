import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { getRequest } from '@tanstack/react-start/server'
import { commands, type SshInput } from './ssh-input'
import { assertLocalRequest } from './local-request'
import { passwordSsh } from './password-ssh'
import { latestProcessSnapshot } from './process-snapshot'

const execFileAsync = promisify(execFile)
let active = 0
export async function executeSsh(data: SshInput): Promise<{ ok: boolean; output: string }> {
  assertLocalRequest(getRequest(), import.meta.env.DEV)
  if (active >= 4) return { ok: false, output: 'Too many operations. Wait for the current request to finish.' }
  active++
  try {
    const host = Number(data.port) === 22 ? data.host : `[${data.host}]:${Number(data.port)}`
    let keys: string[]
    try {
      const { stdout } = await execFileAsync('ssh-keygen', ['-F', host, '-f', join(homedir(), '.ssh', 'known_hosts')], { windowsHide: true, timeout: 5000, maxBuffer: 512 * 1024 })
      keys = stdout.split(/\r?\n/).filter(line => line && !line.startsWith('#') && !line.startsWith('@')).map(line => line.trim().split(/\s+/)[2]).filter(Boolean)
    } catch { return { ok: false, output: 'Verify the VM host key first: connect once in PowerShell with ssh -p PORT USER@HOST. OpenSSH and its default known_hosts file are required.' } }
    const command = Object.hasOwn(commands, data.operation) ? commands[data.operation as keyof typeof commands] : `docker ${data.operation} ${data.container}`
    const result = await passwordSsh(data, command, keys)
    if (result.ok && data.operation === 'processes') {
      try { return { ok: true, output: latestProcessSnapshot(result.output) } }
      catch { return { ok: false, output: 'The VM did not return a complete process sample. Check that top (procps) is installed.' } }
    }
    return result
  } finally { active-- }
}
