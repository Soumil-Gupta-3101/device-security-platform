const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { createUser, getToken } = require('./helpers');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('creates a user with role viewer even when role "admin" is sent in the body', async () => {
      const payload = {
        name: 'Register User',
        email: 'register_viewer@test.com',
        password: 'password123',
        role: 'admin' // Attempting privilege escalation
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('viewer');
      expect(res.body.user.email).toBe('register_viewer@test.com');
      expect(res.body.token).toBeDefined();

      // Verify in the database directly
      const savedUser = await User.findById(res.body.user.id);
      expect(savedUser).toBeDefined();
      expect(savedUser.role).toBe('viewer');
    });

    it('rejects a duplicate email', async () => {
      await createUser('viewer', { email: 'duplicate@test.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'duplicate@test.com',
          password: 'password123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/email already registered/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('succeeds with correct credentials and fails with a wrong password', async () => {
      const email = 'login_test@test.com';
      await createUser('viewer', { email, password: 'correctpassword' });

      // Correct password
      const successRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'correctpassword' });

      expect(successRes.status).toBe(200);
      expect(successRes.body.token).toBeDefined();
      expect(successRes.body.user).toBeDefined();
      expect(successRes.body.user.email).toBe(email);
      expect(successRes.body.user.passwordHash).toBeUndefined();

      // Wrong password
      const failRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' });

      expect(failRes.status).toBe(401);
      expect(failRes.body.error).toMatch(/invalid credentials/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user without a password hash, and 401 without a token or with a garbage token', async () => {
      const user = await createUser('viewer', {
        name: 'Me User',
        email: 'me_test@test.com',
        role: 'viewer'
      });
      const token = getToken(user);

      // Valid token
      const validRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(validRes.status).toBe(200);
      expect(validRes.body.id.toString()).toBe(user._id.toString());
      expect(validRes.body.name).toBe('Me User');
      expect(validRes.body.email).toBe('me_test@test.com');
      expect(validRes.body.role).toBe('viewer');
      expect(validRes.body.passwordHash).toBeUndefined();

      // Without a token
      const noTokenRes = await request(app).get('/api/auth/me');
      expect(noTokenRes.status).toBe(401);
      expect(noTokenRes.body.error).toMatch(/not authorized/i);

      // With a garbage token
      const garbageRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer this.is.garbage.token');
      expect(garbageRes.status).toBe(401);
      expect(garbageRes.body.error).toMatch(/not authorized/i);
    });

    it('rejects a token for a deleted user with 401', async () => {
      const user = await createUser('viewer', { email: 'deleted_user@test.com' });
      const token = getToken(user);

      // Delete the user from the database
      await User.findByIdAndDelete(user._id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not authorized/i);
    });
  });
});
