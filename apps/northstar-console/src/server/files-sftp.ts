import { Client } from 'ssh2'
import { StringDecoder } from 'node:string_decoder'
import type { FileEntry, FileRequest, FileResult } from './files-input.ts'

const pageSize = 200
const previewLimit = 64 * 1024
export function browseSftp(data: FileRequest, keys: string[]): Promise<FileResult> {
  return new Promise(resolve => {
    const client = new Client()
    let done = false
    let untrusted = false
    const finish = (result: FileResult) => {
      if (done) return
      done = true; clearTimeout(timer); client.destroy(); resolve(result)
    }
    const fail = (error: (Error & { code?: number }) | null | undefined) => finish({ ok: false, error: error?.code === 3 ? 'Permission denied. Your Ubuntu account cannot read this path.' : error?.code === 2 ? 'This path no longer exists, or its symbolic-link target is missing.' : 'Unable to read this path through SFTP.' })
    const timer = setTimeout(() => finish({ ok: false, error: 'File request timed out. Try again.' }), 20000)
    client.on('error', (error: Error & { level?: string }) => finish({ ok: false, error: untrusted ? 'VM host key verification failed.' : error.level === 'client-authentication' ? 'Ubuntu rejected the username/password.' : 'SSH connection failed. Check the VM address and SSH service.' }))
    client.on('close', () => { if (!done) finish({ ok: false, error: 'SSH closed before the file request completed.' }) })
    client.on('ready', () => client.sftp((error, sftp) => {
      if (error) { finish({ ok: false, error: 'The VM does not provide SFTP access.' }); return }
      sftp.realpath(data.path, (error, path) => {
        if (error) { fail(error); return }
        sftp.stat(path, (error, stat) => {
          if (error) { fail(error); return }
          if (stat.isDirectory()) {
            sftp.opendir(path, (error, handle) => {
              if (error) { fail(error); return }
              let skipped = 0
              const entries: FileEntry[] = []
              const complete = (nextOffset: number | null) => sftp.close(handle, () => finish({ ok: true, kind: 'directory', path, entries, nextOffset }))
              const next = () => {
                if (done) return
                sftp.readdir(handle, (error, list) => {
                  if ((error as (Error & { code?: number }) | undefined)?.code === 1) { complete(null); return }
                  if (error) { sftp.close(handle, () => fail(error)); return }
                  if (!list || list.length === 0) { complete(null); return }
                  for (const item of list) {
                    if (item.filename === '.' || item.filename === '..') continue
                    if (skipped++ < data.offset) continue
                    if (entries.length === pageSize) { complete(data.offset + pageSize); return }
                    const a = item.attrs
                    entries.push({ name: item.filename, type: a.isDirectory() ? 'directory' : a.isSymbolicLink() ? 'link' : a.isFile() ? 'file' : 'special', size: a.size, modified: a.mtime * 1000, mode: (a.mode & 0o7777).toString(8).padStart(4, '0'), uid: a.uid, gid: a.gid })
                  }
                  next()
                })
              }
              next()
            })
          } else if (stat.isFile()) {
            sftp.open(path, 'r', (error, handle) => {
              if (error) { fail(error); return }
              const buffer = Buffer.alloc(previewLimit + 1)
              let position = 0
              const complete = () => sftp.close(handle, () => {
                const bytes = buffer.subarray(0, Math.min(position, previewLimit))
                const binary = bytes.includes(0)
                const truncated = position > previewLimit || stat.size > previewLimit
                const decoder = new StringDecoder('utf8')
                // A bounded preview may end inside a character; retain only complete characters.
                const content = binary ? '' : decoder.write(bytes) + (truncated ? '' : decoder.end())
                finish({ ok: true, kind: 'file', path, content, binary, truncated, size: stat.size })
              })
              const read = () => {
                if (done) return
                sftp.read(handle, buffer, position, buffer.length - position, position, (error, count) => {
                  if ((error as (Error & { code?: number }) | undefined)?.code === 1) { complete(); return }
                  if (error) { sftp.close(handle, () => fail(error)); return }
                  position += count
                  if (count === 0 || position === buffer.length) complete()
                  else read()
                })
              }
              read()
            })
          } else finish({ ok: false, error: 'This is a device, socket, or other special file. Only regular files can be previewed.' })
        })
      })
    }))
    try {
      client.connect({ host: data.host, port: Number(data.port), username: data.username, password: data.password, authHandler: ['password'], tryKeyboard: false, readyTimeout: 10000,
        hostVerifier: (key: Buffer) => { untrusted = !keys.includes(key.toString('base64')); return !untrusted },
      })
    } catch { finish({ ok: false, error: 'Unable to start the SFTP connection.' }) }
  })
}
