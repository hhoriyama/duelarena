const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/**
 * Cookie認証付きの fetch ラッパー
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, fetchImpl = fetch } = options;
  const res = await fetchImpl(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let payload: unknown = null;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await res.json();
  } else {
    payload = await res.text();
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string; message?: string })?.error ??
      (payload as { message?: string })?.message ??
      `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
}

export const apiBaseUrl = BASE_URL;
