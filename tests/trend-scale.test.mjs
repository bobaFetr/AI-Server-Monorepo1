import test from 'node:test'
import assert from 'node:assert/strict'
import { trendScale } from '../src/components/trend-scale.ts'

test('small RAM and I/O changes use a visible, accurately labelled range', () => {
  for (const values of [[31.2, 31.3, 31.4], [0, 0.1, 0.2]]) {
    const { min, max } = trendScale(values)
    assert.ok(min <= Math.min(...values) && max >= Math.max(...values))
    assert.ok(max - min < 2)
  }
})
test('constant samples have a nonzero range and never invent movement', () => {
  for (const value of [0, 31.2, 100]) {
    const { min, max } = trendScale([value, value])
    assert.ok(min <= value && max >= value && max > min)
  }
  assert.deepEqual(trendScale([]), { min: 0, max: 100 })
})
