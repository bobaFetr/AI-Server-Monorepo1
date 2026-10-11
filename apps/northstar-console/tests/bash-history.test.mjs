import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : '/bin/bash'
const scriptPath = resolve('scripts/bash-history-sync.bash').replaceAll('\\', '/')
const quote = value => `'${value.replaceAll("'", "'\\''")}'`
function run(history, script) {
  const result = spawnSync(bash, ['--noprofile', '--norc', '-i', '-c', `HISTFILE=${quote(history.replaceAll('\\', '/'))}; ${script}`], { encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

test('Bash sessions append shared history without overwriting or executing old entries', { skip: !existsSync(bash) }, t => {
  const directory = mkdtempSync(join(tmpdir(), 'northstar-history-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const history = join(directory, 'history')
  const sentinel = join(directory, 'must-not-exist').replaceAll('\\', '/')
  writeFileSync(history, `printf old-marker\ntouch ${quote(sentinel)}\n`)
  run(history, `source ${quote(scriptPath)}; builtin history -c; builtin history -r; builtin history -s 'printf northstar-marker'; _northstar_history_sync`)
  run(history, `source ${quote(scriptPath)}; builtin history -c; builtin history -r; builtin history -s 'printf console-marker'; _northstar_history_sync`)
  const output = run(history, `source ${quote(scriptPath)}; _northstar_history_sync; builtin history`)
  assert.match(output, /old-marker/)
  assert.match(output, /northstar-marker/)
  assert.match(output, /console-marker/)
  assert.equal(existsSync(sentinel), false)
  const file = readFileSync(history, 'utf8')
  assert.equal(file.match(/^printf northstar-marker$/gm)?.length, 1, file)
  assert.equal(file.match(/^printf console-marker$/gm)?.length, 1, file)
})

test('history hook is idempotent, preserves prompt hooks and command exit status', { skip: !existsSync(bash) }, t => {
  const directory = mkdtempSync(join(tmpdir(), 'northstar-history-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const history = join(directory, 'history')
  writeFileSync(history, '')
  const output = run(history, `PROMPT_COMMAND='printf existing-hook'; source ${quote(scriptPath)}; source ${quote(scriptPath)}; printf '%s\\n' "$PROMPT_COMMAND"; false; _northstar_history_sync; printf 'STATUS=%s\\n' "$?"; PROMPT_COMMAND=('printf array-one' 'printf array-two'); source ${quote(scriptPath)}; source ${quote(scriptPath)}; declare -p PROMPT_COMMAND; printf 'LIMITS=%s/%s\\n' "$HISTSIZE" "$HISTFILESIZE"`)
  assert.equal(output.split('_northstar_history_sync').length - 1, 2)
  assert.match(output, /existing-hook/)
  assert.match(output, /array-one/)
  assert.match(output, /array-two/)
  assert.match(output, /STATUS=1/)
  assert.match(output, /LIMITS=-1\/-1/)
})
