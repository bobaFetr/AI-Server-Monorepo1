import type { DiskNode } from '../server/disk-input'

export function ringPath(start: number, end: number, inner: number, outer: number) {
  const point = (angle: number, radius: number) => `${200 + radius * Math.sin(angle)} ${200 - radius * Math.cos(angle)}`
  const middle = (start + end) / 2
  // Two arcs also handle a complete circle without a coincident-endpoint SVG arc.
  return `M ${point(start, outer)} A ${outer} ${outer} 0 0 1 ${point(middle, outer)} A ${outer} ${outer} 0 0 1 ${point(end, outer)} L ${point(end, inner)} A ${inner} ${inner} 0 0 0 ${point(middle, inner)} A ${inner} ${inner} 0 0 0 ${point(start, inner)} Z`
}

export function diskSegments(root: DiskNode) {
  const segments: { node: DiskNode; start: number; end: number; level: number; color: number }[] = []
  const total = Math.max(root.size, root.children.reduce((sum, node) => sum + node.size, 0))
  let cursor = 0
  root.children.forEach((node, color) => {
    const end = cursor + (total ? node.size / total * Math.PI * 2 : 0)
    if (end > cursor) segments.push({ node, start: cursor, end, level: 0, color })
    const childTotal = Math.max(node.size, node.children.reduce((sum, child) => sum + child.size, 0))
    let childCursor = cursor
    node.children.forEach(child => {
      const childEnd = childCursor + (childTotal ? child.size / childTotal * (end - cursor) : 0)
      if (childEnd > childCursor) segments.push({ node: child, start: childCursor, end: childEnd, level: 1, color })
      childCursor = childEnd
    })
    cursor = end
  })
  return segments
}

export function diskSize(bytes: number) {
  if (!bytes) return '0 B'
  const unit = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** unit).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][unit]}`
}
