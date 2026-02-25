import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { app } = await import('../../server.js');

describe('Register API', () => {
  const queryMock = vi.fn();

  beforeEach(() => {
    queryMock.mockReset();
    app.locals.dbPool = { query: queryMock };
  });

  it('creates a user with role Player', async () => {
    queryMock
      .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // CREATE TABLE
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 1,
            email: 'test@example.com',
            role: 'Player',
            created_at: '2026-01-01T00:00:00.000Z'
          }
        ]
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.role).toBe('Player');
  });

  it('returns 409 when email already exists', async () => {
    queryMock.mockRejectedValueOnce({ code: '23505' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('returns 503 when db is not configured', async () => {
    app.locals.dbPool = null;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/DATABASE_URL/i);
  });
});
