import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  const app = createApp();

  it('200を返し、status=okを含む', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('duel-arena-backend');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('未定義のパス', () => {
  const app = createApp();

  it('404を返す', async () => {
    const res = await request(app).get('/api/this-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
