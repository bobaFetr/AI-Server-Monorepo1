import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDiskScan, diskScanCommand } from '../src/server/disk-scan.ts'
import { diskSegments, ringPath } from '../src/components/disk-chart.ts'

const response = (records, status = 0) => ['NS_DISK_V1', '/data', 'directory', '100000 60000 35000', ...records, `NS_STATUS\t${status}`, ''].join('\0')
test('allocated sizes preserve hierarchy and unusual filenames without double counting', () => {
  const result = parseDiskScan(response(['4096\t/data/folder/file\nwith\ttabs', '8192\t/data/folder', '4096\t/data/file', '16384\t/data']))
  assert.equal(result.root.size, 16384)
  assert.equal(result.root.children[0].children[0].name, 'file\nwith\ttabs')
  assert.equal(result.capacity.available, 35000)
  assert.equal(result.partial, false)
  const segments = diskSegments(result.root)
  assert.equal(segments.length, 3)
  assert.equal(segments[0].end, Math.PI)
  assert.equal(segments[1].end, Math.PI / 2)
})
test('timeout reconstructs only observed sizes and marks partial data', () => {
  const result = parseDiskScan(response(['4096\t/data/folder/file'], 124))
  assert.equal(result.root.size, 4096)
  assert.equal(result.partial, true)
  assert.equal(result.timedOut, true)
  assert.equal(parseDiskScan(response([], 1)).root.size, 0)
  const interrupted = response(['4096\t/data/folder/file'], 124).replace('NS_STATUS', '275165184NS_STATUS')
  assert.equal(parseDiskScan(interrupted).root.size, 4096)
  assert.throws(() => parseDiskScan(interrupted.replace('124', '0')))
})
test('invalid records and unrelated or noncanonical paths are rejected', () => {
  for (const record of ['1\t/elsewhere', '1\t/data/../elsewhere', '1\t/data//file', '9007199254740992\t/data']) assert.throws(() => parseDiskScan(response([record])))
  assert.throws(() => parseDiskScan(response(['1\t/data'], 2)))
  assert.throws(() => parseDiskScan(response(['1\t/data']).replace('100000 60000 35000', '1 2 3')))
})
test('shell paths are quoted and full-circle geometry uses finite arcs', () => {
  assert.ok(diskScanCommand("/tmp/a' ; touch bad").includes("'/tmp/a'\\'' ; touch bad'"))
  const path = ringPath(0, Math.PI * 2, 75, 121)
  assert.equal((path.match(/ A /g) || []).length, 4)
  assert.ok(!path.includes('NaN'))
  const segments = diskSegments({ size: 1, children: [{ path: '/a', name: 'a', size: 2, children: [] }] })
  assert.equal(segments[0].end, Math.PI * 2)
})
