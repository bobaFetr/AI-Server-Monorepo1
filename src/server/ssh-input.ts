export type Coordinates = { host: string; port: string; username: string }
export const commands = {
  overview: "hostname && uptime && free -h && df -h / && uname -sr",
  processes: 'ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu | head -n 31',
  containers: "docker ps -a --format '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}'",
  storage: 'df -h && lsblk',
  services: 'systemctl --no-pager --plain list-units --type=service --state=running',
  journal: 'journalctl --no-pager -n 60',
} as const
export type Operation = keyof typeof commands | 'start' | 'stop' | 'restart'
export type SshInput = Coordinates & { operation: Operation; container?: string }

export function validateInput(input: unknown): SshInput {
  if (!input || typeof input !== 'object') throw new Error('Invalid request.')
  const data = input as Record<string, unknown>
  if (typeof data.host !== 'string' || !/^(?:[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}|::[a-fA-F0-9:]{0,251})$/.test(data.host)) throw new Error('Enter a valid hostname or IP address.')
  if (typeof data.username !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/.test(data.username)) throw new Error('Enter a valid Ubuntu username.')
  if (typeof data.port !== 'string' || !/^\d{1,5}$/.test(data.port) || Number(data.port) < 1 || Number(data.port) > 65535) throw new Error('SSH port must be between 1 and 65535.')
  const operation = data.operation
  if (typeof operation !== 'string' || ![...Object.keys(commands), 'start', 'stop', 'restart'].includes(operation)) throw new Error('Unsupported operation.')
  if (['start', 'stop', 'restart'].includes(operation) && (typeof data.container !== 'string' || !/^[a-f0-9]{12,64}$/.test(data.container))) throw new Error('Enter a container ID from the container list.')
  return { host: data.host, username: data.username, port: data.port, operation: operation as Operation, container: typeof data.container === 'string' ? data.container : undefined }
}
