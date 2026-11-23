const request = require('supertest');
const app = require('../src/app');
const Alert = require('../src/models/Alert');
const Device = require('../src/models/Device');
const sockets = require('../src/sockets');
const { createUser, getToken, createDevice, createEvent, createAlert } = require('./helpers');

describe('Alerts Lifecycle and Metrics', () => {
  let analystToken;
  let viewerToken;

  beforeEach(async () => {
    const analyst = await createUser('analyst');
    const viewer = await createUser('viewer');

    analystToken = getToken(analyst);
    viewerToken = getToken(viewer);
  });

  afterEach(() => {
    sockets.setIO(null);
    jest.restoreAllMocks();
  });

  describe('Alert Creation & Deduplication', () => {
    it('ingesting a risky event (medium or high severity) creates an alert', async () => {
      const device = await createDevice();

      // port_scan (30) + 3 failed_auth (20) = 50 points -> medium severity (40-69)
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

      const triggerRes = await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'failed_auth' });

      expect(triggerRes.status).toBe(201);

      const alerts = await Alert.find({ device: device._id });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe('open');
      expect(alerts[0].severity).toBe('medium');
    });

    it('a second risky event does not create a duplicate alert while an alert is open or investigating', async () => {
      const device = await createDevice();

      // Create an open alert for the device
      await createAlert(device._id, { status: 'open', severity: 'medium' });

      // Ingest another event that scores medium/high
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' });

      let alerts = await Alert.find({ device: device._id });
      expect(alerts).toHaveLength(1);

      // Now set to investigating
      alerts[0].status = 'investigating';
      await alerts[0].save();

      // Ingest another event
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'location_change' });

      alerts = await Alert.find({ device: device._id });
      expect(alerts).toHaveLength(1);
    });

    it('escalates an existing alert when severity increases from medium to high', async () => {
      const device = await createDevice();

      // Start with medium severity event: port_scan (30) + 3 failed_auth (20) = 50 points (medium)
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

      let alert = await Alert.findOne({ device: device._id });
      expect(alert.severity).toBe('medium');

      // Now add events to push score to high (>= 70): location_change (15) + firmware_change (10) -> 75
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'location_change' });
      await request(app)
        .post(`/api/devices/${device._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'firmware_change' });

      const escalatedAlerts = await Alert.find({ device: device._id });
      expect(escalatedAlerts).toHaveLength(1);
      expect(escalatedAlerts[0].severity).toBe('high');
    });

    it('creates a new alert after previous alert is resolved and a new risky event occurs', async () => {
      const device = await createDevice();

      // Existing resolved alert
      await createAlert(device._id, { status: 'resolved', severity: 'medium' });

      // Ingest events reaching medium severity
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

      const allAlerts = await Alert.find({ device: device._id });
      expect(allAlerts).toHaveLength(2);
      expect(allAlerts.some((a) => a.status === 'resolved')).toBe(true);
      expect(allAlerts.some((a) => a.status === 'open')).toBe(true);
    });
  });

  describe('Alert Status Transitions & Notes', () => {
    it('updates alert status and adds notes, rejecting invalid status with 400', async () => {
      const device = await createDevice();
      const alert = await createAlert(device._id, { status: 'open' });

      // Valid status transition to investigating
      const patchRes = await request(app)
        .patch(`/api/alerts/${alert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'investigating' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('investigating');

      // Adding notes
      const noteRes = await request(app)
        .post(`/api/alerts/${alert._id}/notes`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ text: 'Investigating anomalous port scan' });
      expect([200, 201]).toContain(noteRes.status);
      expect(noteRes.body.notes).toHaveLength(1);
      expect(noteRes.body.notes[0].text).toBe('Investigating anomalous port scan');

      // Invalid status rejected
      const invalidRes = await request(app)
        .patch(`/api/alerts/${alert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'invalid_status' });
      expect(invalidRes.status).toBe(400);
    });
  });

  describe('Device Alert Metrics (openAlertCount & lastAlertAt)', () => {
    it('includes openAlertCount and lastAlertAt across list, detail and summary, dropping openAlertCount on resolution', async () => {
      const device = await createDevice();
      const alert = await createAlert(device._id, { status: 'open' });

      // 1. Device list GET /api/devices
      const listRes = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${viewerToken}`);
      const foundInList = listRes.body.data.find((d) => d._id === device._id.toString());
      expect(foundInList).toBeDefined();
      expect(foundInList.openAlertCount).toBe(1);
      expect(foundInList.lastAlertAt).toBeDefined();

      // 2. Device detail GET /api/devices/:id
      const detailRes = await request(app)
        .get(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.openAlertCount).toBe(1);
      expect(detailRes.body.lastAlertAt).toBeDefined();

      // 3. Dashboard summary GET /api/dashboard/summary
      const summaryRes = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.openAlertCount).toBeGreaterThanOrEqual(1);

      // 4. Resolve the alert
      const resolveRes = await request(app)
        .patch(`/api/alerts/${alert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'resolved' });
      expect(resolveRes.status).toBe(200);

      // Verify openAlertCount drops to 0
      const detailAfterResolve = await request(app)
        .get(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(detailAfterResolve.body.openAlertCount).toBe(0);
    });

    it('resolving an alert triggers a device:updated socket emit', async () => {
      const device = await createDevice();
      const alert = await createAlert(device._id, { status: 'open' });

      const mockEmit = jest.fn();
      sockets.setIO({
        emit: mockEmit,
        to: () => ({ emit: mockEmit }),
        in: () => ({ emit: mockEmit })
      });

      const res = await request(app)
        .patch(`/api/alerts/${alert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'resolved' });

      expect(res.status).toBe(200);

      // Check that sockets.getIO().emit was called with 'device:updated'
      const deviceUpdatedCalls = mockEmit.mock.calls.filter((call) => call[0] === 'device:updated');
      expect(deviceUpdatedCalls.length).toBeGreaterThanOrEqual(1);
      const emittedDevice = deviceUpdatedCalls[0][1];
      expect(emittedDevice._id.toString()).toBe(device._id.toString());
      expect(emittedDevice.openAlertCount).toBe(0);

      jest.restoreAllMocks();
    });
  });
});
