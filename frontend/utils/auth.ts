const TOKEN_KEY = 'gomoku_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchWithAuth(input: RequestInfo, init: RequestInit = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  } as Record<string, string>;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Prepend backend API URL if configured and input is a string starting with /api/
  let url = input;
  if (typeof input === 'string' && input.startsWith('/api/')) {
    const backendUrl = (globalThis as any).process?.env?.NEXT_PUBLIC_API_URL;
    if (backendUrl) {
      url = `${backendUrl}${input}`;
    }
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
}
