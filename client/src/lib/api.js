export async function apiRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let data
  try {
    data = await response.json()
  } catch {
    // An HTML page instead of JSON means no API is running behind this address
    const error = new Error('The sign-in server is not available right now.')
    error.code = 'NO_API'
    throw error
  }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}
