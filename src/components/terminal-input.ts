// Keep UTF-16 surrogate pairs together when splitting browser paste events.
export function terminalInputChunks(data: string): string[] {
  const chunks: string[] = []
  for (let offset = 0; offset < data.length;) {
    let end = Math.min(offset + 4096, data.length)
    const last = data.charCodeAt(end - 1)
    if (end < data.length && last >= 0xd800 && last <= 0xdbff) end--
    chunks.push(data.slice(offset, end))
    offset = end
  }
  return chunks
}
