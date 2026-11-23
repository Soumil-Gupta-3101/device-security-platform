const request = require('supertest');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const { createUser, getToken, createDevice, createAlert } = require('./helpers');

describe('Audit Logging System', () => {
  let admin;
  let adminToken;
  let analyst;
  let analystToken;
  let viewer;
  let viewerToken;

  beforeEach(async () => {
    admin = await createUser('admin', { email: 'admin_audit@test.com' });
    analyst = await createUser('analyst', { email: 'analyst_audit@test.com' });
    viewer = await createUser('viewer', { email: 'viewer_audit@test.com' });

    adminToken = getToken(admin);
    analystToken = getToken(analyst);
    viewerToken = getToken(viewer);
  });

  describe('Action Generation for User and Entity Operations', () => {
    it('records user.registered on registration', async () => {
      const email = `reg_audit_${Date.now()}@test.com`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Reg Audit User', email, password: 'password123' });

      expect(res.status).toBe(201);
      const audit = await AuditLog.findOne({ action: 'user.registered', targetId: res.body.user.id });
      expect(audit).toBeDefined();
      expect(audit.targetType).toBe('User');
    });

    it('records user.login on login', async () => {
      const email = `login_audit_${Date.now()}@test.com`;
      await createUser('viewer', { email, password: 'password123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'password123' });

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'user.login', targetId: res.body.user.id });
      expect(audit).toBeDefined();
    });

    it('records device.created on device creation', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Audit Device', ipAddress: '192.168.10.10' });

      expect(res.status).toBe(201);
      const audit = await AuditLog.findOne({ action: 'device.created', targetId: res.body._id });
      expect(audit).toBeDefined();
      expect(audit.targetType).toBe('Device');
    });

    it('records device.updated on device update without status change', async () => {
      const device = await createDevice({ deviceType: 'laptop' });

      const res = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deviceType: 'server' });

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'device.updated', targetId: device._id });
      expect(audit).toBeDefined();
    });

    it('records device.status_changed on status update with metadata', async () => {
      const device = await createDevice({ status: 'normal' });

      const res = await request(app)
        .put(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'blocked', reason: 'Compromised asset' });

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'device.status_changed', targetId: device._id });
      expect(audit).toBeDefined();
      expect(audit.metadata.oldStatus).toBe('normal');
      expect(audit.metadata.newStatus).toBe('blocked');
      expect(audit.metadata.reason).toBe('Compromised asset');
    });

    it('records device.deleted on device deletion', async () => {
      const device = await createDevice();

      const res = await request(app)
        .delete(`/api/devices/${device._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'device.deleted', targetId: device._id });
      expect(audit).toBeDefined();
    });

    it('records alert.status_changed on alert status transition', async () => {
      const device = await createDevice();
      const alert = await createAlert(device._id, { status: 'open' });

      const res = await request(app)
        .patch(`/api/alerts/${alert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'investigating' });

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'alert.status_changed', targetId: alert._id });
      expect(audit).toBeDefined();
      expect(audit.metadata.oldStatus).toBe('open');
      expect(audit.metadata.newStatus).toBe('investigating');
    });

    it('records alert.note_added on adding an alert note', async () => {
      const device = await createDevice();
      const alert = await createAlert(device._id, { status: 'open' });

      const res = await request(app)
        .post(`/api/alerts/${alert._id}/notes`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ text: 'Noted strange traffic pattern' });

      expect([200, 201]).toContain(res.status);
      const audit = await AuditLog.findOne({ action: 'alert.note_added', targetId: alert._id });
      expect(audit).toBeDefined();
    });

    it('records user.role_changed on role change', async () => {
      const targetUser = await createUser('viewer');

      const res = await request(app)
        .patch(`/api/users/${targetUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'analyst' });

      expect(res.status).toBe(200);
      const audit = await AuditLog.findOne({ action: 'user.role_changed', targetId: targetUser._id });
      expect(audit).toBeDefined();
      expect(audit.metadata.oldRole).toBe('viewer');
      expect(audit.metadata.newRole).toBe('analyst');
    });
  });

  describe('GET /api/audit-logs Access, Pagination & Filtering', () => {
    beforeEach(async () => {
      await AuditLog.deleteMany({});
      // Seed some audit logs
      for (let i = 1; i <= 5; i++) {
        await AuditLog.create({
          user: admin._id,
          action: i % 2 === 0 ? 'user.login' : 'device.created',
          targetType: i % 2 === 0 ? 'User' : 'Device',
          targetId: admin._id
        });
      }
    });

    it('enforces admin-only access (403 for analyst and viewer)', async () => {
      const viewerRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(viewerRes.status).toBe(403);

      const analystRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(analystRes.status).toBe(403);

      const adminRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
    });

    it('paginates correctly', async () => {
      const res = await request(app)
        .get('/api/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.total).toBe(5);
      expect(res.body.totalPages).toBe(3);
    });

    it('filters by action', async () => {
      const res = await request(app)
        .get('/api/audit-logs?action=user.login')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((entry) => entry.action === 'user.login')).toBe(true);
    });
  });

  describe('Resilience When AuditLog Write Fails', () => {
    it('allows original request to succeed even if AuditLog.create throws an error', async () => {
      const spy = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(new Error('Audit DB write error'));

      // Test with device creation
      const res = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Resilience Test Device', ipAddress: '10.50.50.50' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Resilience Test Device');

      spy.mockRestore();
    });
  });
});
