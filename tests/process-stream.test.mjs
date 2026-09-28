import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { once } from 'node:events'
import ssh2 from 'ssh2'
import { streamProcesses, monitorCommand } from '../src/server/process-stream.ts'

test('monitor interval is allowlisted', () => {
  assert.match(monitorCommand(3), /-d 3/)
  for (const interval of [0, -1, 100, '3;id']) assert.throws(() => monitorCommand(interval))
})

test('streams complete fresh samples over one authenticated SSH connection and cancels cleanly', async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const key = ssh2.utils.parseKey(privateKey).getPublicSSH().toString('base64')
  let connections = 0
  let commands = 0
  let released = 0
  const clients = new Set()
  const server = new ssh2.Server({ hostKeys: [privateKey] }, client => {
    connections++
    clients.add(client)
    client.on('error', () => {})
    client.on('close', () => clients.delete(client))
    client.on('authentication', ctx => ctx.method === 'password' && ctx.password === 'test-password' ? ctx.accept() : ctx.reject(['password']))
    client.on('ready', () => client.on('session', accept => accept().on('exec', (acceptExec, _reject, info) => {
      commands++
      assert.equal(info.command, monitorCommand(3))
      const channel = acceptExec()
      channel.on('error', () => {})
      // Split frames across network chunks; an initial top frame is never displayed.
      channel.write('top - initial\nold\ntop - sample1\nprocess')
      const first = setTimeout(() => channel.write(' one\n\x1e'), 10)
      const second = setTimeout(() => channel.write('top - initial\nold\ntop - sample2\nprocess two\n\x1e'), 40)
      channel.on('close', () => { clearTimeout(first); clearTimeout(second) })
    })))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { for (const client of clients) client.end(); server.close() })
  const abort = new AbortController()
  const stream = streamProcesses({ host: '127.0.0.1', port: String(server.address().port), username: 'ubuntu', password: 'test-password' }, [key], abort.signal, () => released++)
  const reader = stream.getReader()
  const first = JSON.parse(new TextDecoder().decode((await reader.read()).value))
  const second = JSON.parse(new TextDecoder().decode((await reader.read()).value))
  assert.equal(first.output, 'top - sample1\nprocess one')
  assert.equal(second.output, 'top - sample2\nprocess two')
  assert.equal(connections, 1)
  assert.equal(commands, 1)
  assert.ok(second.sampledAt >= first.sampledAt)
  await reader.cancel()
  abort.abort()
  assert.equal(released, 1)
})
