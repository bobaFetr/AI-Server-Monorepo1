import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { once } from 'node:events'
import ssh2 from 'ssh2'
import { browseSftp } from '../src/server/files-sftp.ts'
import { validateFileRequest } from '../src/server/files-input.ts'

const credentials = { host: '127.0.0.1', port: '22', username: 'ubuntu', password: 'test-password' }
test('file paths are treated as data and request limits are validated', () => {
  assert.equal(validateFileRequest({ ...credentials, path: '/a b;$(id)' }).path, '/a b;$(id)')
  for (const path of ['', 'relative/file', '/bad\0name']) assert.throws(() => validateFileRequest({ ...credentials, path }))
  assert.throws(() => validateFileRequest({ ...credentials, path: '/', offset: -1 }))
  assert.throws(() => validateFileRequest({ ...credentials, path: '/', password: '' }))
})

test('SFTP lists hidden entries, paginates, follows links, previews files and respects permissions', async t => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const key = ssh2.utils.parseKey(privateKey).getPublicSSH().toString('base64')
  const clients = new Set()
  const attrs = (mode, size = 0) => ({ mode, size, uid: 1000, gid: 1000, atime: 1700000000, mtime: 1700000000 })
  const regular = attrs(0o100644)
  const dir = attrs(0o40755)
  const listing = [
    { filename: '.', attrs: dir }, { filename: '..', attrs: dir },
    { filename: '.hidden', attrs: regular }, { filename: 'folder', attrs: dir },
    { filename: 'a b;$(id)', attrs: regular }, { filename: 'link', attrs: attrs(0o120777) },
    ...Array.from({ length: 201 }, (_, index) => ({ filename: `file-${index}`, attrs: regular })),
  ]
  const contents = { '/text': Buffer.from('Hello from Ubuntu\n'), '/binary': Buffer.from([0, 1, 2]), '/large': Buffer.alloc(70000, 65), '/empty': Buffer.alloc(0), '/a b;$(id)': Buffer.from('literal filename') }
  contents['/unicode-boundary'] = Buffer.concat([Buffer.alloc(65535, 65), Buffer.from('日本語')])
  let shellRequests = 0
  const ssh = new ssh2.Server({ hostKeys: [privateKey] }, client => {
    clients.add(client); client.on('error', () => {}); client.on('close', () => clients.delete(client))
    client.on('authentication', ctx => ctx.method === 'password' && ctx.password === credentials.password ? ctx.accept() : ctx.reject(['password']))
    client.on('ready', () => client.on('session', accept => {
      const session = accept()
      session.on('exec', (_accept, reject) => { shellRequests++; reject() })
      session.on('sftp', acceptSftp => {
        const sftp = acceptSftp()
        sftp.on('error', () => {})
        const handles = new Map()
        let nextHandle = 0
        const makeHandle = (id, value) => { const handle = Buffer.from(String(nextHandle++)); handles.set(handle.toString(), value); sftp.handle(id, handle) }
        sftp.on('REALPATH', (id, path) => sftp.name(id, [{ filename: path === '.' ? '/home/ubuntu' : path === '/link' ? '/text' : path, longname: '', attrs: {} }]))
        sftp.on('STAT', (id, path) => {
          if (path === '/denied') sftp.status(id, 3)
          else if (path === '/' || path === '/home/ubuntu' || path === '/emptydir') sftp.attrs(id, dir)
          else if (path === '/device') sftp.attrs(id, attrs(0o20666))
          else if (contents[path]) sftp.attrs(id, attrs(0o100644, contents[path].length))
          else sftp.status(id, 2)
        })
        sftp.on('OPENDIR', (id, path) => makeHandle(id, { path, index: 0 }))
        sftp.on('READDIR', (id, handle) => {
          const state = handles.get(handle.toString())
          const all = state.path === '/' ? listing : []
          const batch = all.slice(state.index, state.index + 45)
          state.index += batch.length
          if (!batch.length) sftp.status(id, 1)
          else sftp.name(id, batch.map(item => ({ ...item, longname: item.filename })))
        })
        sftp.on('OPEN', (id, path, flags) => { assert.equal(flags, 1); makeHandle(id, { path }) })
        sftp.on('READ', (id, handle, offset, length) => {
          const bytes = contents[handles.get(handle.toString()).path]
          if (offset >= bytes.length) sftp.status(id, 1)
          else sftp.data(id, bytes.subarray(offset, offset + Math.min(length, 4096)))
        })
        sftp.on('CLOSE', (id, handle) => { handles.delete(handle.toString()); sftp.status(id, 0) })
      })
    }))
  })
  ssh.listen(0, '127.0.0.1'); await once(ssh, 'listening')
  t.after(() => { for (const client of clients) client.end(); ssh.close() })
  const browse = (path, offset = 0, password = credentials.password, keys = [key]) => browseSftp({ ...credentials, port: String(ssh.address().port), password, path, offset }, keys)
  const first = await browse('/')
  assert.equal(first.ok, true); assert.equal(first.kind, 'directory'); assert.equal(first.entries.length, 200); assert.equal(first.nextOffset, 200)
  assert.ok(first.entries.some(e => e.name === '.hidden'))
  assert.equal(first.entries.find(e => e.name === 'link').type, 'link')
  const second = await browse('/', 200)
  assert.equal(second.entries.length, 5); assert.equal(second.nextOffset, null)
  assert.equal(new Set([...first.entries, ...second.entries].map(e => e.name)).size, 205)
  assert.equal((await browse('.')).path, '/home/ubuntu')
  assert.equal((await browse('/emptydir')).entries.length, 0)
  assert.equal((await browse('/link')).content, 'Hello from Ubuntu\n')
  assert.equal((await browse('/a b;$(id)')).content, 'literal filename')
  assert.equal((await browse('/binary')).binary, true)
  assert.equal((await browse('/empty')).content, '')
  const large = await browse('/large'); assert.equal(large.truncated, true); assert.equal(large.content.length, 65536)
  const unicode = await browse('/unicode-boundary')
  assert.equal(unicode.truncated, true)
  assert.equal(unicode.content, 'A'.repeat(65535), 'Preview must not manufacture a replacement character at the byte limit')
  assert.match((await browse('/denied')).error, /Permission denied/)
  assert.match((await browse('/missing')).error, /no longer exists/)
  assert.match((await browse('/device')).error, /special file/)
  assert.equal((await browse('/', 0, 'wrong')).ok, false)
  assert.match((await browse('/', 0, credentials.password, ['wrong-key'])).error, /host key/)
  assert.equal(shellRequests, 0)
})
