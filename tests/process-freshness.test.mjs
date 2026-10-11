import test from 'node:test'
import assert from 'node:assert/strict'
import { processFreshness } from '../src/components/process-freshness.ts'

test('all sampling options allow normal completion latency and normal time between arrivals', () => {
  for (const interval of [1, 2, 3, 5]) {
    assert.equal(processFreshness(1000, 1000 + interval * 1000, interval, interval * 1000).stale, false)
    assert.equal(processFreshness(1000, 1000 + Math.max(3, interval * 2) * 1000 + 1, interval, interval * 1000).stale, true)
  }
})
test('freshness handles startup and retains real age after a pause', () => {
  assert.deepEqual(processFreshness(null, 100000, 5), { age: null, sinceUpdate: null, stale: false })
  assert.deepEqual(processFreshness(1000, 21000, 5), { age: 20, sinceUpdate: 20, stale: true })
})

test('regular but slower 1-second samples do not flicker delayed solely because of completion latency', () => {
  assert.deepEqual(processFreshness(1000, 3500, 1, 2500), { age: 5, sinceUpdate: 2.5, stale: false })
  assert.equal(processFreshness(3500, 3500, 1, 2500).stale, false)
  assert.equal(processFreshness(3500, 6501, 1, 2500).stale, true)
})

test('old completed frames still report delay even if newly received', () => {
  assert.equal(processFreshness(1000, 1000, 1, 10000).stale, true)
})
