const request = require('supertest');
const app = require('../src/app');
const Device = require('../src/models/Device');
const { createUser, getToken, createDevice } = require('./helpers');

describe('Event Ingestion Endpoints', () => {
  let analystToken;

  beforeEach(async () => {
    const analyst = await createUser('analyst');
    analystToken = getToken(analyst);
  });

  it('returns 201 and sets firstSeen on the first event only, without overwriting on second event', async () => {
    const device = await createDevice({ firstSeen: null, lastSeen: null });

    // First event
    const firstRes = await request(app)
      .post(`/api/devices/${device._id}/events`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ eventType: 'port_scan' });

    expect(firstRes.status).toBe(201);
    expect(firstRes.body.eventType).toBe('port_scan');

    const deviceAfterFirst = await Device.findById(device._id);
    expect(deviceAfterFirst.firstSeen).toBeDefined();
    expect(deviceAfterFirst.lastSeen).toBeDefined();
    const initialFirstSeenTime = new Date(deviceAfterFirst.firstSeen).getTime();

    // Artificial delay to guarantee distinct timestamp
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Second event
    const secondRes = await request(app)
      .post(`/api/devices/${device._id}/events`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ eventType: 'firmware_change' });

    expect(secondRes.status).toBe(201);

    const deviceAfterSecond = await Device.findById(device._id);
    const subsequentFirstSeenTime = new Date(deviceAfterSecond.firstSeen).getTime();
    const subsequentLastSeenTime = new Date(deviceAfterSecond.lastSeen).getTime();

    // firstSeen should remain unchanged
    expect(subsequentFirstSeenTime).toBe(initialFirstSeenTime);
    // lastSeen should be updated to a later or equal time
    expect(subsequentLastSeenTime).toBeGreaterThanOrEqual(initialFirstSeenTime);
  });

  it('returns 404 for a nonexistent valid 24-hex device ID', async () => {
    const nonexistentId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post(`/api/devices/${nonexistentId}/events`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ eventType: 'port_scan' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 for a malformed device ID', async () => {
    const malformedId = 'not-a-valid-hex-id-123';

    const res = await request(app)
      .post(`/api/devices/${malformedId}/events`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ eventType: 'port_scan' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid id/i);
  });
});
