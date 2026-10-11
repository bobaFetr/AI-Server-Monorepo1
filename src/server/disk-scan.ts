import type { DiskNode, DiskScan } from './disk-input'

const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`
export function diskScanCommand(path: string) {
  return [
    // Sentinel prevents command substitution from stripping newlines in a filename.
    `target=$(realpath -e -- ${quote(path)} && printf '.') || exit 1`,
    'target=${target%.}',
    "target=${target%'\n'}",
    'if test -d "$target"; then kind=directory; elif test -f "$target"; then kind=file; else printf "Only directories and regular files can be scanned.\\n" >&2; exit 1; fi',
    'capacity=$(LC_ALL=C df -B1 --output=size,used,avail -- "$target") || exit 1',
    "printf 'NS_DISK_V1\\0%s\\0%s\\0' \"$target\" \"$kind\"",
    "printf '%s\\n' \"$capacity\" | awk 'NR == 2 { printf \"%s %s %s%c\", $1, $2, $3, 0 }'",
    'LC_ALL=C timeout 45s du -a -x -B1 --max-depth=2 --null -- "$target" 2>/dev/null',
    "printf 'NS_STATUS\\t%s\\0' \"$?\"",
  ].join('\n')
}

export function parseDiskScan(output: string): DiskScan {
  const trailer = output.match(/NS_STATUS\t(\d+)\0$/)
  if (!trailer) throw new Error('Incomplete disk scan response.')
  const trailerStart = trailer.index!
  if (output[trailerStart - 1] !== '\0') {
    if (trailer[1] === '0') throw new Error('Incomplete disk size record.')
    // timeout can terminate du halfway through a buffered NUL-delimited record.
    output = output.slice(0, output.lastIndexOf('\0', trailerStart - 1) + 1) + trailer[0]
  }
  const fields = output.split('\0')
  if (fields.shift() !== 'NS_DISK_V1') throw new Error('Invalid disk scan response.')
  const path = fields.shift()!
  const kind = fields.shift()
  const capacityFields = fields.shift()?.trim().split(/\s+/)
  const canonical = (value: string) => value === '/' || (value.startsWith('/') && value.slice(1).split('/').every(part => part !== '' && part !== '.' && part !== '..'))
  if (!canonical(path) || !['directory', 'file'].includes(kind ?? '') || capacityFields?.length !== 3) throw new Error('Invalid disk scan response.')
  const [total, used, available] = capacityFields.map(Number)
  if (![total, used, available].every(value => Number.isSafeInteger(value) && value >= 0) || total <= 0 || used > total || available > total) throw new Error('Invalid filesystem capacity.')
  if (fields.at(-1) === '') fields.pop()
  const statusField = fields.pop()
  if (!/^NS_STATUS\t\d+$/.test(statusField ?? '')) throw new Error('Incomplete disk scan response.')
  const status = Number(statusField!.split('\t')[1])
  if (![0, 1, 124].includes(status)) throw new Error('Disk scan failed. GNU du and timeout are required.')
  if (fields.length > 5000) throw new Error('Too many disk entries. Scan a smaller folder.')
  const nodes = new Map<string, DiskNode>()
  const makeNode = (nodePath: string): DiskNode => {
    let node = nodes.get(nodePath)
    if (!node) { node = { path: nodePath, name: nodePath === '/' ? '/' : nodePath.slice(nodePath.lastIndexOf('/') + 1), size: 0, children: [] }; nodes.set(nodePath, node) }
    return node
  }
  const root = makeNode(path)
  const recorded = new Set<string>()
  for (const field of fields) {
    const match = field.match(/^(\d+)\t([\s\S]+)$/)
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error('Invalid disk size record.')
    const nodePath = match[2]
    if (!canonical(nodePath) || (nodePath !== path && !nodePath.startsWith(path === '/' ? '/' : path + '/'))) throw new Error('Disk scan returned an unrelated path.')
    const node = makeNode(nodePath)
    node.size = Number(match[1]); recorded.add(nodePath)
    let current = node
    while (current !== root) {
      const parentPath = current.path.slice(0, current.path.lastIndexOf('/')) || '/'
      const parent = makeNode(parentPath)
      if (!parent.children.includes(current)) parent.children.push(current)
      current = parent
    }
  }
  let inconsistent = false
  const finalize = (node: DiskNode) => {
    node.children.forEach(finalize)
    if (!recorded.has(node.path)) node.size = node.children.reduce((sum, child) => sum + child.size, 0)
    else if (node.children.reduce((sum, child) => sum + child.size, 0) > node.size) inconsistent = true
    node.children.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
  }
  finalize(root)
  if (!recorded.has(path) && status === 0) throw new Error('Disk scan returned no directory total.')
  return { ok: true, root, kind: kind as 'directory' | 'file', capacity: { total, used, available }, partial: status !== 0 || inconsistent, timedOut: status === 124, scannedAt: Date.now() }
}
