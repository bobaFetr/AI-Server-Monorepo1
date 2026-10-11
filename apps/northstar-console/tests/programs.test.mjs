import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { commands, validateInput } from '../src/server/ssh-input.ts'

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/sh'
const options = { skip: !existsSync(shell) && 'A POSIX shell is required to exercise the remote command.' }
function run(prefix) {
  const result = spawnSync(shell, ['-c', `${prefix}\n${commands.programs}`], { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  return result
}

test('Programs lists only installed packages and includes optional package managers', options, () => {
  assert.equal(validateInput({ host: 'localhost', port: '22', username: 'ubuntu', password: 'test', operation: 'programs' }).operation, 'programs')
  const result = run(`
dpkg-query() { printf 'installed\\tapp\\t1.2\\tamd64\\nconfig-files\\tremoved\\t1.0\\tamd64\\ninstalled\\tlibfoo\\t2.0\\tall\\n'; }
snap() { printf 'snap-app 3.0\\n'; }
flatpak() { printf 'org.example.App 4.0\\n'; }
`)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /app\t1\.2\tamd64/)
  assert.match(result.stdout, /libfoo\t2\.0\tall/)
  assert.doesNotMatch(result.stdout, /removed/)
  assert.match(result.stdout, /snap-app 3\.0/)
  assert.match(result.stdout, /org\.example\.App 4\.0/)
})

test('Programs propagates DPKG failures instead of reporting success', options, () => {
  const result = run(`dpkg-query() { printf 'Package database unavailable\\n' >&2; return 2; }`)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Package database unavailable/)
  assert.doesNotMatch(result.stdout, /APT \/ DPKG/)
})

test('Programs preserves the package list when optional managers are unavailable or fail', options, () => {
  const result = run(`
dpkg-query() { printf 'installed\\tapp\\t1.0\\tamd64\\n'; }
snap() { return 1; }
command() { if [ "$2" = snap ]; then return 0; fi; return 1; }
`)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /app\t1\.0\tamd64/)
  assert.match(result.stdout, /Unable to list Snap/)
  assert.doesNotMatch(result.stdout, /FLATPAK/)
})
