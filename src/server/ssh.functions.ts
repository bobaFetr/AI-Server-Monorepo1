import { createServerFn } from '@tanstack/react-start'
import { validateInput } from './ssh-input'
import { executeSsh } from './ssh.server'

export const runSsh = createServerFn({ method: 'POST' })
  .inputValidator(validateInput)
  .handler(({ data }) => executeSsh(data))
