export function assertLocalRequest(request: Request, development: boolean) {
  const url = new URL(request.url)
  if (!development || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('SSH management is available only on the local development server.')
  if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('Only same-origin requests are allowed.')
}
