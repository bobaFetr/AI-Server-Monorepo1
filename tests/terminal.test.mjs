import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { once } from 'node:events'
import ssh2 from 'ssh2'
import { WebSocket, WebSocketServer } from 'ws'
import { attachTerminal, terminalSize } from '../src/server/terminal-bridge.ts'
import { allowedTerminalUpgrade } from '../src/server/terminal-plugin.ts'
import { identityCommand } from '../src/server/terminal-identity.ts'
import { terminalInputChunks } from '../src/components/terminal-input.ts'

test('large pastes preserve Unicode characters across input frames', () => {
  const text = 'x'.repeat(4095) + '\u{1f600}' + 'test'.repeat(3000)
  const chunks = terminalInputChunks(text)
  assert.equal(chunks.map(chunk => Buffer.from(chunk).toString()).join(''), text)
  assert.ok(chunks.every(chunk => chunk.length <= 4096))
})

async function waitFor(check) {
  const deadline = Date.now() + 4000
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for terminal event')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

test('terminal only accepts loopback peers and matching browser origin', () => {
  const request = (origin, address = '127.0.0.1', host = '127.0.0.1:3000') => ({ headers: { host, origin }, socket: { remoteAddress: address } })
  assert.equal(allowedTerminalUpgrade(request('http://127.0.0.1:3000')), true)
  assert.equal(allowedTerminalUpgrade(request('https://evil.example')), false)
  assert.equal(allowedTerminalUpgrade(request(undefined)), false)
  assert.equal(allowedTerminalUpgrade(request('http://127.0.0.1:3000', '192.168.1.2')), false)
  assert.equal(allowedTerminalUpgrade(request('http://evil.example', '127.0.0.1', 'evil.example')), false)
  assert.deepEqual(terminalSize(80, 24), { cols: 80, rows: 24 })
  assert.throws(() => terminalSize(-1, 24))
  assert.throws(() => terminalSize(80, '24'))
})

test('SSH terminal authenticates, allocates a PTY, relays input/output, resizes and closes', async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const key = ssh2.utils.parseKey(privateKey).getPublicSSH().toString('base64')
  let shells = 0
  let pty
  let resized
  let typed = ''
  let shellClosed = false
  let identityOutput = 'Ubuntu login banner\n\x1evboxuser\nLinuxServer\n'
  let trusted = true
  const peers = new Set()
  const ssh = new ssh2.Server({ hostKeys: [privateKey] }, client => {
    peers.add(client)
    client.on('error', () => {})
    client.on('close', () => { peers.delete(client); shellClosed = true })
    client.on('authentication', ctx => ctx.method === 'password' && ctx.username === 'ubuntu' && ctx.password === 'test-secret' ? ctx.accept() : ctx.reject(['password']))
    client.on('ready', () => client.on('session', accept => {
      const session = accept()
      session.on('exec', (acceptExec, _reject, info) => {
        assert.equal(info.command, identityCommand)
        const stream = acceptExec()
        // Deliberately differs from the submitted login to catch UI/backend fallbacks.
        stream.write(identityOutput)
        stream.exit(0)
        stream.end()
      })
      session.on('pty', (acceptPty, _reject, info) => { pty = info; acceptPty() })
      session.on('window-change', (acceptResize, _reject, info) => { resized = info; acceptResize?.() })
      session.on('shell', acceptShell => {
        shells++
        const stream = acceptShell()
        stream.on('error', () => {})
        stream.on('data', data => { typed += data.toString(); stream.write(data) })
        stream.write('\x1b[32mUbuntu shell\x1b[0m\r\n$ ')
      })
    }))
  })
  ssh.listen(0, '127.0.0.1')
  await once(ssh, 'listening')
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  wss.on('connection', ws => attachTerminal(ws, async () => trusted ? [key] : ['changed-host-key']))
  await once(wss, 'listening')
  t.after(() => { for (const ws of wss.clients) ws.terminate(); wss.close(); for (const peer of peers) peer.end(); ssh.close() })
  const connect = async password => {
    const socket = new WebSocket(`ws://127.0.0.1:${wss.address().port}`)
    const messages = []
    let output = ''
    socket.on('message', (data, binary) => {
      if (binary) { output += data.toString(); socket.send(JSON.stringify({ type: 'ack', bytes: data.length })) }
      else messages.push(JSON.parse(data.toString()))
    })
    await once(socket, 'open')
    socket.send(JSON.stringify({ type: 'connect', coordinates: { host: '127.0.0.1', port: String(ssh.address().port), username: 'ubuntu', password }, cols: 80, rows: 24 }))
    return { socket, messages, output: () => output }
  }
  const good = await connect('test-secret')
  await waitFor(() => good.messages.some(m => m.type === 'ready') && good.output().includes('Ubuntu shell'))
  assert.equal(pty.term, 'xterm-256color')
  assert.deepEqual(good.messages.find(m => m.type === 'ready'), { type: 'ready', username: 'vboxuser', hostname: 'LinuxServer' })
  assert.equal(pty.cols, 80)
  good.socket.send(JSON.stringify({ type: 'input', data: 'cd /tmp\rpwd\r\x03' }))
  await waitFor(() => typed.endsWith('\x03'))
  assert.equal(typed, 'cd /tmp\rpwd\r\x03')
  good.socket.send(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }))
  await waitFor(() => resized?.cols === 120)
  assert.equal(resized.rows, 40)
  good.socket.close()
  await waitFor(() => shellClosed)
  const wrong = await connect('incorrect')
  await waitFor(() => wrong.messages.some(m => m.type === 'error'))
  assert.match(wrong.messages.find(m => m.type === 'error').message, /rejected/)
  assert.equal(shells, 1, 'Incorrect credentials must not open another shell')
  identityOutput = '\x1einvalid identity\n'
  const invalidIdentity = await connect('test-secret')
  await waitFor(() => invalidIdentity.messages.some(m => m.type === 'error'))
  assert.match(invalidIdentity.messages.find(m => m.type === 'error').message, /verify/)
  assert.equal(shells, 1, 'Failed identity verification must not open a shell')
  trusted = false
  const changedHost = await connect('test-secret')
  await waitFor(() => changedHost.messages.some(m => m.type === 'error'))
  assert.match(changedHost.messages.find(m => m.type === 'error').message, /host key/)
  assert.equal(shells, 1, 'Untrusted host keys must not open a shell')
})
