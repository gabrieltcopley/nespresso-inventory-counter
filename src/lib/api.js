async function request(method, path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    return { data: null, error: 'Could not reach the server.', status: 0 }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { data: null, error: data.error || 'Request failed.', status: res.status, body: data }
  return { data, error: null, status: res.status }
}

export const api = {
  get: path => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body),
  delete: path => request('DELETE', path),
}
