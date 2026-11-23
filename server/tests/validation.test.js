const request = require('supertest');
const app = require('../src/app');
const { createUser, getToken } = require('./helpers');

describe('Validation and Error Handling', () => {
  let admin, adminToken;

  beforeEach(async () => {
    admin = await createUser('admin');
    adminToken = getToken(admin);
  });

  const malformedIds = [
    '123',
    'zzzzzzzzzzzzzzzzzzzzzzzz', // 24-char non-hex
    '123456789012'              // 12-char string
  ];

  describe('Malformed ID Validation (400)', () => {
    it.each(malformedIds)('returns 400 for malformed ID "%s" on devices route', async (badId) => {
      const res = await request(app)
        .get(`/api/devices/${badId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid id');
    });

    it.each(malformedIds)('returns 400 for malformed ID "%s" on alerts routes', async (badId) => {
      // GET /api/alerts/:id
      const getRes = await request(app)
        .get(`/api/alerts/${badId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(400);
      expect(getRes.body.error).toBe('Invalid id');

      // PATCH /api/alerts/:id/status
      const patchRes = await request(app)
        .patch(`/api/alerts/${badId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'investigating' });
      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error).toBe('Invalid id');

      // POST /api/alerts/:id/notes
      const postNoteRes = await request(app)
        .post(`/api/alerts/${badId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Note text' });
      expect(postNoteRes.status).toBe(400);
      expect(postNoteRes.body.error).toBe('Invalid id');
    });

    it.each(malformedIds)('returns 400 for malformed device ID "%s" on device events route', async (badId) => {
      const res = await request(app)
        .post(`/api/devices/${badId}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ eventType: 'port_scan' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid id');
    });

    it.each(malformedIds)('returns 400 for malformed ID "%s" on users role route', async (badId) => {
      const res = await request(app)
        .patch(`/api/users/${badId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'analyst' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid id');
    });
  });

  describe('Nonexistent Valid 24-Hex ID (404)', () => {
    const nonexistentId = '507f1f77bcf86cd799439011';

    it('returns 404 for a valid 24-hex ID that does not exist', async () => {
      // Device get
      const devRes = await request(app)
        .get(`/api/devices/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(devRes.status).toBe(404);

      // Alert get
      const alertRes = await request(app)
        .get(`/api/alerts/${nonexistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(alertRes.status).toBe(404);

      // User role update
      const userRes = await request(app)
        .patch(`/api/users/${nonexistentId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'analyst' });
      expect(userRes.status).toBe(404);

      // Device event ingestion
      const eventRes = await request(app)
        .post(`/api/devices/${nonexistentId}/events`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ eventType: 'port_scan' });
      expect(eventRes.status).toBe(404);
    });
  });

  describe('Unknown Routes (404)', () => {
    it('returns a JSON 404 for unknown routes', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-route-xyz');

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.error).toBeDefined();
    });
  });
});
