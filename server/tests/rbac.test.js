const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const {
  createUser,
  getToken,
  createDevice,
  createAlert
} = require('./helpers');

describe('RBAC Permissions Matrix', () => {
  let viewer, viewerToken;
  let analyst, analystToken;
  let admin, adminToken;
  let testDevice;
  let testAlert;

  beforeEach(async () => {
    viewer = await createUser('viewer');
    viewerToken = getToken(viewer);

    analyst = await createUser('analyst');
    analystToken = getToken(analyst);

    admin = await createUser('admin');
    adminToken = getToken(admin);

    testDevice = await createDevice({ name: 'RBAC Device' });
    testAlert = await createAlert(testDevice._id);
  });

  describe('Viewer Role Permissions', () => {
    it('gets 200 on GET devices, alerts, and dashboard summary', async () => {
      const devRes = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(devRes.status).toBe(200);

      const alertRes = await request(app)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(alertRes.status).toBe(200);

      const dashRes = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(dashRes.status).toBe(200);
    });

    it('gets 403 on device create, device delete, device update, alert status change, alert note and event ingestion', async () => {
      // Device create
      const createDevRes = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Blocked Dev', ipAddress: '10.0.0.1' });
      expect(createDevRes.status).toBe(403);

      // Device delete
      const delDevRes = await request(app)
        .delete(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(delDevRes.status).toBe(403);

      // Device update
      const updateDevRes = await request(app)
        .put(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'trusted' });
      expect(updateDevRes.status).toBe(403);

      // Alert status change
      const alertStatusRes = await request(app)
        .patch(`/api/alerts/${testAlert._id}/status`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'investigating' });
      expect(alertStatusRes.status).toBe(403);

      // Alert note addition
      const alertNoteRes = await request(app)
        .post(`/api/alerts/${testAlert._id}/notes`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ text: 'Unauthorized note' });
      expect(alertNoteRes.status).toBe(403);

      // Event ingestion
      const eventRes = await request(app)
        .post(`/api/devices/${testDevice._id}/events`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ eventType: 'port_scan' });
      expect(eventRes.status).toBe(403);
    });
  });

  describe('Analyst Role Permissions', () => {
    it('can update a device, ingest events, change alert status and add notes', async () => {
      // Update device
      const updateDevRes = await request(app)
        .put(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'trusted' });
      expect(updateDevRes.status).toBe(200);

      // Ingest events
      const eventRes = await request(app)
        .post(`/api/devices/${testDevice._id}/events`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ eventType: 'port_scan' });
      expect(eventRes.status).toBe(201);

      // Change alert status
      const alertStatusRes = await request(app)
        .patch(`/api/alerts/${testAlert._id}/status`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ status: 'investigating' });
      expect(alertStatusRes.status).toBe(200);

      // Add alert note
      const alertNoteRes = await request(app)
        .post(`/api/alerts/${testAlert._id}/notes`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ text: 'Analyst note added' });
      expect([200, 201]).toContain(alertNoteRes.status);
    });

    it('gets 403 on device create/delete, GET /api/users and GET /api/audit-logs', async () => {
      // Device create
      const createDevRes = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ name: 'Analyst Dev', ipAddress: '10.0.0.2' });
      expect(createDevRes.status).toBe(403);

      // Device delete
      const delDevRes = await request(app)
        .delete(`/api/devices/${testDevice._id}`)
        .set('Authorization', `Bearer ${analystToken}`);
      expect(delDevRes.status).toBe(403);

      // GET /api/users
      const usersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(usersRes.status).toBe(403);

      // GET /api/audit-logs
      const auditRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(auditRes.status).toBe(403);
    });
  });

  describe('Admin Role Permissions', () => {
    it('can perform all actions (create/delete device, update device, view users and audit logs)', async () => {
      // Create device
      const createDevRes = await request(app)
        .post('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Created Dev', ipAddress: '10.0.0.3' });
      expect(createDevRes.status).toBe(201);

      // Update device
      const updateDevRes = await request(app)
        .put(`/api/devices/${createDevRes.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'blocked' });
      expect(updateDevRes.status).toBe(200);

      // Delete device
      const delDevRes = await request(app)
        .delete(`/api/devices/${createDevRes.body._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delDevRes.status).toBe(200);

      // GET /api/users
      const usersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(usersRes.status).toBe(200);

      // GET /api/audit-logs
      const auditRes = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(auditRes.status).toBe(200);
    });
  });

  describe('Immediate Role Changes without Re-login', () => {
    it('takes effect immediately without a new token (promote viewer -> analyst -> success, then demote -> 403)', async () => {
      const subject = await createUser('viewer');
      const subjectToken = getToken(subject);

      // 1. Initially viewer gets 403 on event ingestion
      const initialRes = await request(app)
        .post(`/api/devices/${testDevice._id}/events`)
        .set('Authorization', `Bearer ${subjectToken}`)
        .send({ eventType: 'port_scan' });
      expect(initialRes.status).toBe(403);

      // 2. Admin promotes viewer to analyst
      const promoteRes = await request(app)
        .patch(`/api/users/${subject._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'analyst' });
      expect(promoteRes.status).toBe(200);
      expect(promoteRes.body.role).toBe('analyst');

      // 3. User makes request with the SAME token -> now succeeds with 201!
      const afterPromoteRes = await request(app)
        .post(`/api/devices/${testDevice._id}/events`)
        .set('Authorization', `Bearer ${subjectToken}`)
        .send({ eventType: 'port_scan' });
      expect(afterPromoteRes.status).toBe(201);

      // 4. Admin demotes user back to viewer
      const demoteRes = await request(app)
        .patch(`/api/users/${subject._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });
      expect(demoteRes.status).toBe(200);
      expect(demoteRes.body.role).toBe('viewer');

      // 5. User makes request with the SAME token -> now gets 403!
      const afterDemoteRes = await request(app)
        .post(`/api/devices/${testDevice._id}/events`)
        .set('Authorization', `Bearer ${subjectToken}`)
        .send({ eventType: 'port_scan' });
      expect(afterDemoteRes.status).toBe(403);
    });
  });

  describe('User Management Restrictions', () => {
    it('blocks an admin from changing their own role (400) and returns 400 for an invalid role value', async () => {
      // Self-demotion blocked
      const selfDemoteRes = await request(app)
        .patch(`/api/users/${admin._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'viewer' });
      expect(selfDemoteRes.status).toBe(400);
      expect(selfDemoteRes.body.error).toMatch(/cannot change own role/i);

      // Invalid role value
      const invalidRoleRes = await request(app)
        .patch(`/api/users/${viewer._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'superadmin' });
      expect(invalidRoleRes.status).toBe(400);
      expect(invalidRoleRes.body.error).toMatch(/invalid role value/i);
    });

    it('never returns password hashes in GET /api/users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      res.body.forEach((u) => {
        expect(u.passwordHash).toBeUndefined();
      });
    });
  });

  describe('Unauthenticated Access', () => {
    it('returns 401 with no token for all protected routes', async () => {
      const endpoints = [
        { method: 'get', url: '/api/devices' },
        { method: 'post', url: '/api/devices', body: { name: 'D', ipAddress: '1.1.1.1' } },
        { method: 'get', url: `/api/devices/${testDevice._id}` },
        { method: 'put', url: `/api/devices/${testDevice._id}`, body: { status: 'trusted' } },
        { method: 'delete', url: `/api/devices/${testDevice._id}` },
        { method: 'get', url: '/api/alerts' },
        { method: 'patch', url: `/api/alerts/${testAlert._id}/status`, body: { status: 'resolved' } },
        { method: 'post', url: `/api/alerts/${testAlert._id}/notes`, body: { text: 'hi' } },
        { method: 'get', url: '/api/dashboard/summary' },
        { method: 'get', url: '/api/users' },
        { method: 'patch', url: `/api/users/${viewer._id}/role`, body: { role: 'analyst' } },
        { method: 'get', url: '/api/audit-logs' },
        { method: 'get', url: '/api/auth/me' },
        { method: 'post', url: `/api/devices/${testDevice._id}/events`, body: { eventType: 'port_scan' } }
      ];

      for (const ep of endpoints) {
        let req = request(app)[ep.method](ep.url);
        if (ep.body) {
          req = req.send(ep.body);
        }
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/not authorized/i);
      }
    });
  });
});
