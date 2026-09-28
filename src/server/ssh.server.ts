import { execFile } from 'node:child_process'
import { getRequest } from '@tanstack/react-start/server'
import { commands, type SshInput } from './ssh-input'
import { assertLocalRequest } from './local-request'
import { sshErrorMessage } from './ssh-errors'

let active = 0
export async function executeSsh(data: SshInput): Promise<{ ok: boolean; output: string }> {
  assertLocalRequest(getRequest(), import.meta.env.DEV)
  if (active >= 4) return { ok: false, output: 'Too many operations. Wait for the current request to finish.' }
  const command = data.operation in commands ? commands[data.operation as keyof typeof commands] : `docker ${data.operation} ${data.container}`
  const args = ['-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=8', '-o', 'ConnectionAttempts=1', '-o', 'ClearAllForwardings=yes', '-o', 'PermitLocalCommand=no', '-p', data.port, '-l', data.username, data.host, command]
  active++
  try {
    return await new Promise((resolve) => {
      execFile('ssh', args, { timeout: 20000, maxBuffer: 512 * 1024, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
        if (!error) return resolve({ ok: true, output: stdout.trim() || 'Operation completed.' })
        resolve({ ok: false, output: sshErrorMessage(error, stderr) })
      })
    })
  } finally { active-- }
}
