import test from 'node:test'
import assert from 'node:assert/strict'
import { validateInput } from '../src/server/ssh-input.ts'
import { assertLocalRequest } from '../src/server/local-request.ts'
import { sshErrorMessage } from '../src/server/ssh-errors.ts'

test('distinguishes SSH authentication from remote command permissions', () => {
  assert.match(sshErrorMessage({}, 'ubuntu@host: Permission denied (publickey).'), /authentication failed/)
  const denied = 'Permission denied: cannot access Docker socket'
  assert.equal(sshErrorMessage({}, denied), denied)
  assert.match(sshErrorMessage({ code: 'ENOENT' }, ''), /OpenSSH was not found/)
  assert.match(sshErrorMessage({ killed: true }, ''), /may still have completed/)
  assert.match(sshErrorMessage({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, ''), /512 KB/)
  assert.match(sshErrorMessage({}, 'Host key verification failed.'), /fingerprint/)
})

test('SSH gateway rejects production, remote hosts, and cross-origin requests', () => {
  const local = 'http://127.0.0.1:3000'
  assert.doesNotThrow(() => assertLocalRequest(new Request(local, { headers: { origin: local } }), true))
  assert.throws(() => assertLocalRequest(new Request(local, { headers: { origin: local } }), false))
  assert.throws(() => assertLocalRequest(new Request(local), true))
  assert.throws(() => assertLocalRequest(new Request(local, { headers: { origin: 'https://example.com' } }), true))
  assert.throws(() => assertLocalRequest(new Request('http://192.168.1.2', { headers: { origin: 'http://192.168.1.2' } }), true))
})

const valid = { host: '127.0.0.1', port: '2222', username: 'ubuntu', operation: 'overview' }
test('accepts VM coordinates including forwarded SSH ports and IPv6', () => {
  assert.deepEqual(validateInput(valid), { ...valid, container: undefined })
  assert.equal(validateInput({ ...valid, host: 'fe80::1' }).host, 'fe80::1')
  assert.equal(validateInput({ ...valid, host: '::1' }).host, '::1')
})
test('rejects option injection, shell input, invalid ports, and arbitrary operations', () => {
  for (const patch of [{ host: '-oProxyCommand=bad' }, { host: 'localhost;whoami' }, { username: 'ubuntu;id' }, { port: '0' }, { port: '65536' }, { port: '22 -v' }, { operation: 'toString' }, { operation: 'rm -rf /' }]) {
    assert.throws(() => validateInput({ ...valid, ...patch }))
  }
  assert.throws(() => validateInput(null))
})
test('container changes require a validated container ID', () => {
  for (const container of ['', '--all', 'abc;id', 'container name']) assert.throws(() => validateInput({ ...valid, operation: 'stop', container }))
  assert.equal(validateInput({ ...valid, operation: 'restart', container: '012345abcdef' }).container, '012345abcdef')
})
