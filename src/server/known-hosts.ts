import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export async function trustedHostKeys(hostname: string, port: string): Promise<string[]> {
  const host = Number(port) === 22 ? hostname : `[${hostname}]:${Number(port)}`
  try {
    const { stdout } = await execFileAsync('ssh-keygen', ['-F', host, '-f', join(homedir(), '.ssh', 'known_hosts')], { windowsHide: true, timeout: 5000, maxBuffer: 512 * 1024 })
    const lines = stdout.split(/\r?\n/).filter(line => line && !line.startsWith('#'))
    if (lines.some(line => line.startsWith('@revoked'))) throw new Error('Revoked host key')
    const keys = lines.filter(line => !line.startsWith('@')).map(line => line.trim().split(/\s+/)[2]).filter(Boolean)
    if (!keys.length) throw new Error('No trusted host keys')
    return keys
  } catch { throw new Error('Verify the VM host key first: connect once in PowerShell with ssh -p PORT USER@HOST. OpenSSH and its default known_hosts file are required.') }
}
