export function sshErrorMessage(error: { code?: string | number | null; killed?: boolean }, stderr: string) {
  if (error.code === 'ENOENT') return 'OpenSSH was not found on this PC. Install the OpenSSH client and make sure ssh is on PATH.'
  if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'Server output exceeded the 512 KB limit. The operation may have completed; refresh before retrying.'
  if (error.killed) return 'SSH operation timed out after 20 seconds. A remote action may still have completed; refresh before retrying.'
  if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/.test(stderr)) return 'SSH host key is not trusted or has changed. Verify the VM fingerprint and connect once from PowerShell with ssh -p PORT USER@HOST.'
  if (/Permission denied \((?:publickey|password|keyboard-interactive)[^)]*\)/.test(stderr)) return 'SSH authentication failed. Configure key authentication or load your key into the local SSH agent. Password prompts are not supported.'
  return stderr.trim() || 'SSH operation failed. Check the VM address, port, and SSH service.'
}
