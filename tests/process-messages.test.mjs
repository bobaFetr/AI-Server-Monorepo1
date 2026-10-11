import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProcessMessage, ProcessMessageDecoder } from '../src/components/process-messages.ts'

test('process messages reject malformed types and invalid timestamps', () => {
  for (const value of [null, [], {}, { output: 42, sampledAt: 100 }, { output: 'top', sampledAt: '100' }, { output: 'top', sampledAt: -1 }, { output: 'top', sampledAt: 1.2 }, { output: 'top', sampledAt: 9e15 }]) {
    assert.throws(() => parseProcessMessage(JSON.stringify(value)), /Invalid process/)
  }
  assert.throws(() => parseProcessMessage('{password=secret'), error => !error.message.includes('secret'))
  assert.deepEqual(parseProcessMessage('{"error":"SSH closed"}'), { error: 'SSH closed' })
})
test('process decoder handles Unicode fragmented byte by byte and multiple frames', () => {
  const decoder = new ProcessMessageDecoder()
  const sample = { output: 'top — café 日本語', sampledAt: 123 }
  const bytes = new TextEncoder().encode(JSON.stringify(sample) + '\n')
  const results = []
  for (const byte of bytes) results.push(...decoder.push(new Uint8Array([byte])))
  assert.deepEqual(results, [sample])
  assert.deepEqual(decoder.push(new TextEncoder().encode(JSON.stringify(sample) + '\n' + JSON.stringify(sample) + '\n')), [sample, sample])
})
test('process decoder bounds unfinished and completed messages and rejects invalid UTF-8', () => {
  assert.throws(() => new ProcessMessageDecoder().push(new TextEncoder().encode('x'.repeat(1024 * 1024 + 1))), /size limit/)
  assert.throws(() => parseProcessMessage('x'.repeat(1024 * 1024 + 1)), /size limit/)
  assert.throws(() => new ProcessMessageDecoder().push(new Uint8Array([255])))
})
