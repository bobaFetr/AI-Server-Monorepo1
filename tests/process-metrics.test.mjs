import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProcessMetrics } from '../src/components/process-metrics.ts'

const frame = `top - 12:00:00 up 1 day, 1 user, load average: 0.10, 0.20, 0.30
Tasks: 123 total, 2 running, 121 sleeping, 0 stopped, 0 zombie
%Cpu(s): 10.0 us, 5.0 sy, 0.0 ni, 80.0 id, 4.0 wa, 0.0 hi, 1.0 si, 0.0 st
MiB Mem : 8000.0 total, 2000.0 free, 3000.0 used, 3000.0 buff/cache
MiB Swap: 2000.0 total, 1500.0 free, 500.0 used. 4500.0 avail Mem
 PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND
 1 root 20 0 100 100 100 S 130.0 1.0 0:00 worker`

test('visual metrics use whole-server CPU and summary memory, not process CPU', () => {
  const result = parseProcessMetrics(frame)
  assert.equal(result.cpu, 16)
  assert.equal(result.ioWait, 4)
  assert.equal(result.memory, 37.5)
  assert.equal(result.memoryUsed, 3000 * 1024 ** 2)
  assert.equal(result.cache, 3000 * 1024 ** 2)
  assert.equal(result.swap, 25)
  assert.equal(result.tasks, 123)
  assert.equal(result.runningTasks, 2)
  assert.deepEqual(result.load, [0.1, 0.2, 0.3])
})
test('handles CRLF, memory units and a server without swap', () => {
  const result = parseProcessMetrics(frame.replaceAll('MiB', 'GiB').replace('2000.0 total, 1500.0 free, 500.0 used', '0.0 total, 0.0 free, 0.0 used').replaceAll('\n', '\r\n'))
  assert.equal(result.memoryTotal, 8000 * 1024 ** 3)
  assert.equal(result.swap, 0)
})
test('missing summaries remain unavailable rather than becoming healthy zero readings', () => {
  const result = parseProcessMetrics('top - sample\nprocess list')
  assert.equal(result.cpu, null)
  assert.equal(result.memory, null)
  assert.equal(result.ioWait, null)
  assert.equal(result.tasks, null)
  assert.deepEqual(result.load, [])
})

test('invalid metric values never produce NaN, out-of-range charts or false healthy readings', () => {
  for (const invalid of ['..', '1.2.3', '-80.0', '180.0']) {
    assert.equal(parseProcessMetrics(frame.replace('80.0 id', `${invalid} id`)).cpu, null)
  }
  assert.equal(parseProcessMetrics(frame.replace('3000.0 used', '9000.0 used')).memory, null)
  assert.equal(parseProcessMetrics(frame.replace('4.0 wa', '140.0 wa')).ioWait, null)
  assert.equal(parseProcessMetrics(frame.replace('3000.0 used', '-3000.0 used')).memory, null)
  assert.deepEqual(parseProcessMetrics(frame.replace('0.10, 0.20, 0.30', '0.10, 0.20, 0.30.4')).load, [])
})
test('top thread mode and KiB summaries are supported', () => {
  const result = parseProcessMetrics(frame.replace('Tasks:', 'Threads:').replaceAll('MiB', 'KiB'))
  assert.equal(result.tasks, 123)
  assert.equal(result.memoryTotal, 8000 * 1024)
  assert.equal(result.taskKind, 'Threads')
})

test('I/O-bound and CPU-starved VMs do not falsely show CPU execution', () => {
  const ioBound = frame.replace('%Cpu(s): 10.0 us, 5.0 sy, 0.0 ni, 80.0 id, 4.0 wa, 0.0 hi, 1.0 si, 0.0 st', '%Cpu(s): 0.0 us, 0.0 sy, 0.0 ni, 10.0 id, 90.0 wa, 0.0 hi, 0.0 si, 0.0 st')
  assert.equal(parseProcessMetrics(ioBound).cpu, 0)
  assert.equal(parseProcessMetrics(ioBound).ioWait, 90)
  const stolen = ioBound.replace('90.0 wa', '0.0 wa').replace('0.0 st', '90.0 st')
  assert.equal(parseProcessMetrics(stolen).cpu, 0)
  assert.equal(parseProcessMetrics(stolen).ioWait, 0)
})
test('CPU categories must be complete and consistent within top rounding tolerance', () => {
  assert.equal(parseProcessMetrics(frame.replace('10.0 us', '90.0 us')).cpu, null)
  assert.equal(parseProcessMetrics(frame.replace('1.0 si,', '')).cpu, null)
  assert.equal(parseProcessMetrics(frame.replace('80.0 id', '80.1 id')).cpu, 16)
})
