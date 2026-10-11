import test from 'node:test'
import assert from 'node:assert/strict'
import { historyWindow, historyX } from '../src/components/history-window.ts'

test('all sampling intervals use the same rolling 60-second window', () => {
  for (const interval of [1, 2, 3, 5]) {
    const samples = Array.from({ length: 120 }, (_, index) => ({ sampledAt: 1000000 + index * interval * 1000, cpu: index % 100, memory: 30, ioWait: 0 }))
    const window = historyWindow(samples)
    assert.equal(window.end - window.start, 60000)
    assert.equal(window.samples.length, Math.floor(60 / interval) + 1)
    assert.equal(historyX(window.end, window.start), 550)
    assert.equal(historyX(window.start, window.start), 40)
    const next = historyWindow([...samples, { ...samples.at(-1), sampledAt: window.end + interval * 1000 }])
    assert.ok(historyX(window.end, next.start) < historyX(window.end, window.start), 'Previous samples move left')
    assert.ok(next.samples.every(sample => sample.sampledAt >= next.start), 'Old data disappears')
  }
})

test('a long pause expires old history on resume without inventing connecting data', () => {
  const previous = { sampledAt: 100000, breakBefore: true }
  const resumed = { sampledAt: 200000, breakBefore: true }
  assert.deepEqual(historyWindow([previous, resumed]).samples, [resumed])
  assert.deepEqual(historyWindow([]).samples, [])
})
