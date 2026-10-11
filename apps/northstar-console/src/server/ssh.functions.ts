import { createServerFn } from '@tanstack/react-start'
import { validateInput } from './ssh-input'

export const runSsh = createServerFn({ method: 'POST' })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const { executeSsh } = await import('./ssh.server')
    return executeSsh(data)
  })
