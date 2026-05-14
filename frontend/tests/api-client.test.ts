import { describe, it, expect, vi } from 'vitest';
import { apiFetch, ApiError } from '../src/api/client';

function makeFetch(opts: {
  ok: boolean;
  status?: number;
  contentType?: string;
  body: unknown;
}) {
  return vi.fn(async () => ({
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 400),
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type'
          ? opts.contentType ?? 'application/json'
          : null,
    },
    json: async () => opts.body,
    text: async () => (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)),
  })) as unknown as typeof fetch;
}

describe('apiFetch', () => {
  it('成功時はパースしたJSONを返す', async () => {
    const fakeFetch = makeFetch({ ok: true, body: { hello: 'world' } });
    const data = await apiFetch<{ hello: string }>('/api/test', { fetchImpl: fakeFetch });
    expect(data.hello).toBe('world');
  });

  it('credentials: include がついている', async () => {
    const fakeFetch = makeFetch({ ok: true, body: {} });
    await apiFetch('/api/test', { fetchImpl: fakeFetch });
    const [, init] = (fakeFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.credentials).toBe('include');
  });

  it('bodyを渡すとJSON文字列に変換され、Content-Typeが付く', async () => {
    const fakeFetch = makeFetch({ ok: true, body: {} });
    await apiFetch('/api/test', {
      method: 'POST',
      body: { foo: 1 },
      fetchImpl: fakeFetch,
    });
    const [, init] = (fakeFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"foo":1}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('エラー時は ApiError をthrowする', async () => {
    const fakeFetch = makeFetch({
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    });
    await expect(
      apiFetch('/api/test', { fetchImpl: fakeFetch }),
    ).rejects.toBeInstanceOf(ApiError);

    try {
      await apiFetch('/api/test', { fetchImpl: fakeFetch });
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(401);
      expect(err.message).toBe('Unauthorized');
    }
  });
});
