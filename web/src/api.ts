/** fetch の薄いラッパ。エラー時は Backend の error メッセージを投げる。 */

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export function getJson<T>(path: string): Promise<T> {
  return fetch(path, { credentials: 'same-origin' }).then((r) => handle<T>(r));
}

export function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  }).then((r) => handle<T>(r));
}
