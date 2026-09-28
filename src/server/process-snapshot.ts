// top's initial frame is not an interval sample. Keep only its second frame.
export function latestProcessSnapshot(output: string): string {
  const frames = output.split(/(?=^top - )/m).filter(frame => frame.startsWith('top - '))
  if (frames.length < 2) throw new Error('The VM did not return a complete process sample.')
  return frames[frames.length - 1].trim()
}
