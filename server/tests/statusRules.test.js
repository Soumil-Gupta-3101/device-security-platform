const request = require('supertest');
const app = require('../src/app');
const Device = require('../src/models/Device');
const AuditLog = require('../src/models/AuditLog');
const { recomputeAllDevicesRisk } = require('../src/services/riskDecayService');
const { createUser, getToken, createDevice, createEvent } = require('./helpers');

describe('Status Rules and Device Status Management', () => {
  let adminToken;
  let analystToken;
  let viewerToken;

  beforeEach(async () => {
    const admin = await createUser('admin');
    const analyst = await createUser('analyst');
    const viewer = await createUser('viewer');

    adminToken = getToken(admin);
    analystToken = getToken(analyst);
    viewerToken = getToken(viewer);
  });

  describe('Derived Status Thresholds (>= 70 -> suspicious, < 70 -> normal)', () => {
    it('sets status to "suspicious" when score >= 70, and "normal" when score < 70 on event ingestion', async () => {
      const device = await createDevice({ status: 'normal', riskScore: 0 });

      // Ingest events to reach score 75: port_scan (30) + 3 failed_auth (20) + location_change (15) + firmware_change (10) = 75
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'location_change' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'firmware_change' });

      const updatedDeviceHigh = await Device.findById(device._id);
      expect(updatedDeviceHigh.riskScore).toBe(75);
      expect(updatedDeviceHigh.status).toBe('suspicious');

      // Now create a device with score < 70
      const deviceLow = await createDevice({ status: 'unknown' });
      await request(app)
        .post(`/api/devices/${deviceLow._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' }); // 30 points < 70

      const updatedDeviceLow = await Device.findById(deviceLow._id);
      expect(updatedDeviceLow.riskScore).toBe(30);
      expect(updatedDeviceLow.status).toBe('normal');
    });

    it('sets status to "suspicious" (>= 70) or "normal" (< 70) during decay job recomputation', async () => {
      // Device with 0 events but previously marked suspicious
      const device = await createDevice({ status: 'suspicious', riskScore: 80, firstSeen: new Date() });
      await recomputeAllDevicesRisk();

      const afterDecay = await Device.findById(device._id);
      expect(afterDecay.riskScore).toBe(0);
      expect(afterDecay.status).toBe('normal');
    });
  });

  describe('Unknown Device Lifecycle', () => {
    it('an "unknown" device with no events stays "unknown"; after first event it follows derived rules', async () => {
      // Create unknown device with no firstSeen / lastSeen
      const device = await createDevice({ status: 'unknown', riskScore: 0, firstSeen: null, lastSeen: null });

      // Run decay job -> must remain "unknown"
      await recomputeAllDevicesRisk();
      let dbDevice = await Device.findById(device._id);
      expect(dbDevice.status).toBe('unknown');

      // Ingest its first event (low risk)
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'firmware_change' }); // 10 points < 70

      dbDevice = await Device.findById(device._id);
      expect(dbDevice.riskScore).toBe(10);
      expect(dbDevice.status).toBe('normal');
      expect(dbDevice.firstSeen).toBeDefined();
    });
  });

  describe('Manual Statuses ("trusted" and "blocked") Invariance', () => {
    it('"trusted" device keeps status when score crosses threshold in either direction, but riskScore still updates', async () => {
      const device = await createDevice({ status: 'trusted', riskScore: 0 });

      // Ingest high-risk events to reach 75
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'location_change' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'firmware_change' });

      let dbDevice = await Device.findById(device._id);
      expect(dbDevice.riskScore).toBe(75);
      expect(dbDevice.status).toBe('trusted'); // Still trusted despite score 75

      // In the decay job, risk score should decay without changing status
      // Delete events to simulate aging past 24h
      const DeviceEvent = require('../src/models/DeviceEvent');
      await DeviceEvent.deleteMany({ device: device._id });

      await recomputeAllDevicesRisk();
      dbDevice = await Device.findById(device._id);
      expect(dbDevice.riskScore).toBe(0);
      expect(dbDevice.status).toBe('trusted'); // Still trusted
    });

    it('"blocked" device keeps status when score crosses threshold in either direction, but riskScore still updates', async () => {
      const device = await createDevice({ status: 'blocked', riskScore: 0 });

      // Ingest high-risk event
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' });

      let dbDevice = await Device.findById(device._id);
      expect(dbDevice.riskScore).toBe(30);
      expect(dbDevice.status).toBe('blocked');

      // Decay job
      const DeviceEvent = require('../src/models/DeviceEvent');
      await DeviceEvent.deleteMany({ device: device._id });

      await recomputeAllDevicesRisk();
      dbDevice = await Device.findById(device._id);
      expect(dbDevice.riskScore).toBe(0);
      expect(dbDevice.status).toBe('blocked');
    });
  });

  describe('Manual Status Change Route Restrictions & Audit Logging', () => {
    it('allows analyst and admin to set "trusted" and "blocked"', async () => {
      const device = await createDevice({ status: 'normal' });

      // Analyst sets "trusted"
      const res1 = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'trusted' });
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('trusted');

      // Admin sets "blocked"
      const res2 = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'blocked' });
      expect(res2.status).toBe(200);
      expect(res2.body.status).toBe('blocked');
    });

    it('denies viewer with 403 on manual status change', async () => {
      const device = await createDevice({ status: 'normal' });

      const res = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'trusted' });
      expect(res.status).toBe(403);
    });

    it('rejects "suspicious" or "normal" as manual values with 400', async () => {
      const device = await createDevice({ status: 'normal' });

      const resSuspicious = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'suspicious' });
      expect(resSuspicious.status).toBe(400);

      const resNormal = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'normal' });
      expect(resNormal.status).toBe(400);
    });

    it('"Reset to Automatic" sets the status to the value derived from the current score', async () => {
      // Device with high risk score (>= 70) manually set to "trusted"
      const deviceHigh = await createDevice({ status: 'trusted', riskScore: 0 });
      await createEvent(deviceHigh._id, { eventType: 'port_scan' }); // 30
      await createEvent(deviceHigh._id, { eventType: 'failed_auth' });
      await createEvent(deviceHigh._id, { eventType: 'failed_auth' });
      await createEvent(deviceHigh._id, { eventType: 'failed_auth' }); // +20 = 50
      await createEvent(deviceHigh._id, { eventType: 'location_change' }); // +15 = 65
      await createEvent(deviceHigh._id, { eventType: 'firmware_change' }); // +10 = 75

      const resetHighRes = await request(app)
        .put(`/api/devices/${deviceHigh._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'reset' });

      expect(resetHighRes.status).toBe(200);
      expect(resetHighRes.body.status).toBe('suspicious');

      // Device with low score (< 70) manually set to "blocked"
      const deviceLow = await createDevice({ status: 'blocked', riskScore: 0 });
      await createEvent(deviceLow._id, { eventType: 'port_scan' }); // 30 < 70

      const resetLowRes = await request(app)
        .put(`/api/devices/${deviceLow._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'reset' });

      expect(resetLowRes.status).toBe(200);
      expect(resetLowRes.body.status).toBe('normal');
    });

    it('writes a "device.status_changed" audit entry with old and new status in metadata', async () => {
      const device = await createDevice({ status: 'normal' });

      await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'trusted', reason: 'Verified corporate hardware' });

      const auditEntry = await AuditLog.findOne({
        targetId: device._id,
        action: 'device.status_changed'
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry.metadata.oldStatus).toBe('normal');
      expect(auditEntry.metadata.newStatus).toBe('trusted');
      expect(auditEntry.metadata.reason).toBe('Verified corporate hardware');
    });
  });
});
