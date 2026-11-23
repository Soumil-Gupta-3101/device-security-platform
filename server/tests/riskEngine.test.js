const request = require('supertest');
const app = require('../src/app');
const Device = require('../src/models/Device');
const DeviceEvent = require('../src/models/DeviceEvent');
const { calculateRiskScore, getEventAgeWeight } = require('../src/services/riskEngine');
const { createUser, getToken, createDevice, createEvent } = require('./helpers');

describe('Risk Engine', () => {
  let viewerToken;

  beforeEach(async () => {
    const viewer = await createUser('viewer');
    viewerToken = getToken(viewer);
  });

  describe('Individual Risk Rules Contribution', () => {
    it('port_scan event contributes +30 points', async () => {
      const device = await createDevice();
      await createEvent(device._id, { eventType: 'port_scan', timestamp: new Date() });

      const { score, triggeredRules } = await calculateRiskScore(device._id);
      expect(score).toBe(30);
      expect(triggeredRules).toHaveLength(1);
      expect(triggeredRules[0].rule).toBe('port_scan');
      expect(triggeredRules[0].points).toBe(30);
    });

    it('failed_auth contributes +20 points only with 3 or more events', async () => {
      const device = await createDevice();

      // 2 failed_auth events -> 0 points
      await createEvent(device._id, { eventType: 'failed_auth', timestamp: new Date() });
      await createEvent(device._id, { eventType: 'failed_auth', timestamp: new Date() });
      let result = await calculateRiskScore(device._id);
      expect(result.score).toBe(0);

      // 3rd failed_auth event -> +20 points
      await createEvent(device._id, { eventType: 'failed_auth', timestamp: new Date() });
      result = await calculateRiskScore(device._id);
      expect(result.score).toBe(20);
      expect(result.triggeredRules.some((r) => r.rule === 'failed_auth' && r.points === 20)).toBe(true);
    });

    it('firmware_change event contributes +10 points', async () => {
      const device = await createDevice();
      await createEvent(device._id, { eventType: 'firmware_change', timestamp: new Date() });

      const { score, triggeredRules } = await calculateRiskScore(device._id);
      expect(score).toBe(10);
      expect(triggeredRules[0].rule).toBe('firmware_change');
      expect(triggeredRules[0].points).toBe(10);
    });

    it('location_change event contributes +15 points', async () => {
      const device = await createDevice();
      await createEvent(device._id, { eventType: 'location_change', timestamp: new Date() });

      const { score, triggeredRules } = await calculateRiskScore(device._id);
      expect(score).toBe(15);
      expect(triggeredRules[0].rule).toBe('location_change');
      expect(triggeredRules[0].points).toBe(15);
    });

    it('login_attempt with metadata.success=false contributes +15 points only with 2 or more events', async () => {
      const device = await createDevice();

      // 1 failed login attempt -> 0 points
      await createEvent(device._id, {
        eventType: 'login_attempt',
        metadata: { success: false },
        timestamp: new Date()
      });
      let result = await calculateRiskScore(device._id);
      expect(result.score).toBe(0);

      // Successful login attempt should not count
      await createEvent(device._id, {
        eventType: 'login_attempt',
        metadata: { success: true },
        timestamp: new Date()
      });
      result = await calculateRiskScore(device._id);
      expect(result.score).toBe(0);

      // 2nd failed login attempt -> +15 points
      await createEvent(device._id, {
        eventType: 'login_attempt',
        metadata: { success: false },
        timestamp: new Date()
      });
      result = await calculateRiskScore(device._id);
      expect(result.score).toBe(15);
      expect(result.triggeredRules.some((r) => r.rule === 'failed_login_attempts' && r.points === 15)).toBe(true);
    });
  });

  describe('Age Weighting & Decay Calculation', () => {
    it('applies 100% weight for events up to 1 hour old, ~50% at 12.5 hours, and 0% at 24+ hours', () => {
      const now = Date.now();
      const halfHourAgo = now - 30 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;
      const twelveAndHalfHoursAgo = now - 12.5 * 60 * 60 * 1000;
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
      const twentyFiveHoursAgo = now - 25 * 60 * 60 * 1000;

      // <= 1 hour -> 1.0 (100%)
      expect(getEventAgeWeight(halfHourAgo, now)).toBe(1.0);
      expect(getEventAgeWeight(oneHourAgo, now)).toBe(1.0);

      // 12.5 hours -> (24 - 12.5) / 23 = 11.5 / 23 = 0.5 (50%)
      const weight12_5 = getEventAgeWeight(twelveAndHalfHoursAgo, now);
      expect(weight12_5).toBeCloseTo(0.5, 2);

      // >= 24 hours -> 0.0 (0%)
      expect(getEventAgeWeight(twentyFourHoursAgo, now)).toBe(0.0);
      expect(getEventAgeWeight(twentyFiveHoursAgo, now)).toBe(0.0);
    });

    it('scales event points by age weighting in calculateRiskScore', async () => {
      const device = await createDevice();
      const twelveAndHalfHoursAgo = new Date(Date.now() - 12.5 * 60 * 60 * 1000);

      // port_scan has base 30 points. At 12.5 hours old (50% weight), it gives round(30 * 0.5) = 15 points
      await createEvent(device._id, { eventType: 'port_scan', timestamp: twelveAndHalfHoursAgo });

      const { score, triggeredRules } = await calculateRiskScore(device._id);
      expect(score).toBe(15);
      expect(triggeredRules[0].points).toBe(15);
      expect(triggeredRules[0].weight).toBeCloseTo(0.5, 2);
    });

    it('ignores events older than 24 hours', async () => {
      const device = await createDevice();
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      await createEvent(device._id, { eventType: 'port_scan', timestamp: twentyFiveHoursAgo });
      await createEvent(device._id, { eventType: 'firmware_change', timestamp: twentyFiveHoursAgo });

      const { score, triggeredRules } = await calculateRiskScore(device._id);
      expect(score).toBe(0);
      expect(triggeredRules).toHaveLength(0);
    });
  });

  describe('Score Bounds & Clamping', () => {
    it('clamps the score between 0 and 100', async () => {
      const device = await createDevice();

      // Zero events -> score 0
      const emptyResult = await calculateRiskScore(device._id);
      expect(emptyResult.score).toBe(0);

      // Add all rules with fresh events: 30 + 20 + 10 + 15 + 15 = 90
      await createEvent(device._id, { eventType: 'port_scan' });
      await createEvent(device._id, { eventType: 'failed_auth' });
      await createEvent(device._id, { eventType: 'failed_auth' });
      await createEvent(device._id, { eventType: 'failed_auth' });
      await createEvent(device._id, { eventType: 'firmware_change' });
      await createEvent(device._id, { eventType: 'location_change' });
      await createEvent(device._id, { eventType: 'login_attempt', metadata: { success: false } });
      await createEvent(device._id, { eventType: 'login_attempt', metadata: { success: false } });

      const fullResult = await calculateRiskScore(device._id);
      expect(fullResult.score).toBe(90);
      expect(fullResult.score).toBeLessThanOrEqual(100);
      expect(fullResult.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Endpoint Consistency with calculateRiskScore', () => {
    it('returns the same score as GET /api/devices/:id/risk-breakdown for the same device', async () => {
      const device = await createDevice();
      await createEvent(device._id, { eventType: 'port_scan' });
      await createEvent(device._id, { eventType: 'location_change' });

      const { score: directScore, triggeredRules: directRules } = await calculateRiskScore(device._id);

      const res = await request(app)
        .get(`/api/devices/${device._id}/risk-breakdown`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(directScore);
      expect(res.body.triggeredRules).toHaveLength(directRules.length);
      expect(res.body.deviceId).toBe(device._id.toString());
    });
  });
});
