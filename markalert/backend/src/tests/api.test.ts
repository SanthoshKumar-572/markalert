import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { config } from '../config';

describe('MarkAlert v2 API Integration Tests', () => {
  it('GET /api/v1/health should return 200 with service metadata', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('MarkAlert API');
    expect(res.body.version).toBe('2.0.0');
    expect(res.body.mode).toBe('MOCK_PROVIDERS');
  });

  it('GET /api/v1/unknown-route should return 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login with invalid email format should fail validation with 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.issues).toBeDefined();
  });

  it('Protected routes should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/batches');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/webhooks/whatsapp should respond to Meta hub.challenge verification', async () => {
    const res = await request(app)
      .get('/api/v1/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': config.whatsapp.verifyToken,
        'hub.challenge': 'CHALLENGE_ACCEPTED_123',
      });
    expect(res.status).toBe(200);
    expect(res.text).toBe('CHALLENGE_ACCEPTED_123');
  });
});

