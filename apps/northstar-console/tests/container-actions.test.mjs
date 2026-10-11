import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { once } from 'node:events'
import ssh2 from 'ssh2'
import { passwordSsh } from '../src/server/password-ssh.ts'
import { commandForInput } from '../src/server/ssh-input.ts'

test('container actions send only validated commands and propagate Docker failures', async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const key = ssh2.utils.parseKey(privateKey).getPublicSSH().toString('base64')
  const peers = new Set()
  const executed = []
  const server = new ssh2.Server({ hostKeys: [privateKey] }, client => {
    peers.add(client); client.on('error', () => {}); client.on('close', () => peers.delete(client))
    client.on('authentication', ctx => ctx.method === 'password' && ctx.password === 'test' ? ctx.accept() : ctx.reject(['password']))
    client.on('ready', () => client.on('session', accept => accept().on('exec', (acceptExec, _reject, info) => {
      executed.push(info.command)
      const stream = acceptExec()
      stream.on('error', () => {})
      if (info.command.endsWith('ffffffffffff')) { stream.stderr.write('Docker permission denied'); stream.exit(1) }
      else { stream.write('012345abcdef\n'); stream.exit(0) }
      stream.end()
    })))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { for (const peer of peers) peer.end(); server.close() })
  const credentials = { host: '127.0.0.1', port: String(server.address().port), username: 'ubuntu', password: 'test' }
  for (const operation of ['start', 'stop', 'restart']) {
    const command = commandForInput({ ...credentials, operation, container: '012345abcdef' })
    assert.equal(command, `docker ${operation} 012345abcdef`)
    assert.deepEqual(await passwordSsh(credentials, command, [key]), { ok: true, output: '012345abcdef' })
  }
  const command = commandForInput({ ...credentials, operation: 'restart', container: 'ffffffffffff' })
  assert.deepEqual(await passwordSsh(credentials, command, [key]), { ok: false, output: 'Docker permission denied' })
  for (const patch of [{ operation: 'remove', container: '012345abcdef' }, { operation: 'stop', container: '--all' }, { operation: 'start', container: '012345abcdef; id' }]) {
    assert.throws(() => commandForInput({ ...credentials, ...patch }))
  }
  assert.deepEqual(executed, ['docker start 012345abcdef', 'docker stop 012345abcdef', 'docker restart 012345abcdef', 'docker restart ffffffffffff'])
})
