import { createServerFn } from '@tanstack/react-start'
import { validateFileRequest } from './files-input'

export const browseRemoteFiles = createServerFn({ method: 'POST' })
  .inputValidator(validateFileRequest)
  .handler(async ({ data }) => {
    const { browseFiles } = await import('./files.server')
    return browseFiles(data)
  })
