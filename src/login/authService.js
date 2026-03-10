async function requestAuth(path, options = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      ...options,
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

export async function registerAuth(username, password) {
  return requestAuth('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function loginAuth(username, password) {
  return requestAuth('/api/auth', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function logoutAuth() {
  await requestAuth('/api/auth', { method: 'DELETE' });
}

export async function getMe() {
  return requestAuth('/api/user/me', { method: 'GET' });
}
