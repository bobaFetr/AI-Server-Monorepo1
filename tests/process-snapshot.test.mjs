import test from 'node:test'
import assert from 'node:assert/strict'
import { latestProcessSnapshot } from '../src/server/process-snapshot.ts'

test('discards initial CPU averages and returns the fresh interval frame', () => {
  const initial = 'top - 10:00:00 up 1 day\n PID USER %CPU COMMAND\n 1 root 1.0 systemd\n'
  const fresh = 'top - 10:00:01 up 1 day\n PID USER %CPU COMMAND\n 42 ubuntu 99.0 worker\n'
  assert.equal(latestProcessSnapshot(initial + '\n' + fresh), fresh.trim())
  assert.equal(latestProcessSnapshot((initial + fresh).replaceAll('\n', '\r\n')), fresh.trim().replaceAll('\n', '\r\n'))
})
test('rejects partial and missing process samples instead of showing old averages', () => {
  assert.throws(() => latestProcessSnapshot('top - 10:00:00\ninitial frame'))
  assert.throws(() => latestProcessSnapshot('top: command not found'))
})
