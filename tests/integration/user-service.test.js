const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../services/user/models/User');
const Tenant = require('../../services/user/models/Tenant');

describe('User Service Integration Tests', () => {
  let mongoServer;
  let app;
  let testTenant;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory DB
    await mongoose.connect(mongoUri);

    // Import the app after DB connection
    app = require('../../services/user/index');

    // Create test tenant
    testTenant = new Tenant({
      name: 'Test Tenant',
      slug: 'test-tenant',
      subscriptionPlan: 'enterprise',
      subscriptionStatus: 'active'
    });
    await testTenant.save();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up collections before each test
    await User.deleteMany({});
    // Keep the test tenant
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'Test',
      lastName: 'User',
      tenantSlug: 'test-tenant'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.password).toBeUndefined(); // Password should not be returned
      expect(response.body.data.user.roles).toContain('viewer');
    });

    it('should fail with invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should fail with weak password', async () => {
      const weakPasswordData = { ...validUserData, password: '123' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should fail with non-existent tenant', async () => {
      const invalidTenantData = { ...validUserData, tenantSlug: 'non-existent' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidTenantData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Tenant not found');
    });

    it('should fail when user already exists', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        tenantId: testTenant._id,
        isVerified: true
      });
      await testUser.save();
    });

    const validLoginData = {
      identifier: 'test@example.com',
      password: 'SecurePass123!',
      tenantSlug: 'test-tenant'
    };

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      
      authToken = response.body.data.tokens.accessToken;
    });

    it('should fail with invalid password', async () => {
      const invalidData = { ...validLoginData, password: 'wrongpassword' };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should fail with non-existent user', async () => {
      const nonExistentData = { ...validLoginData, identifier: 'nonexistent@example.com' };
      
      const response = await request(app)
        .post('/api/auth/login')
        .send(nonExistentData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should lock account after multiple failed attempts', async () => {
      const invalidData = { ...validLoginData, password: 'wrongpassword' };
      
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(invalidData)
          .expect(401);
      }

      // 6th attempt should return account locked
      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Account locked');
    });
  });

  describe('GET /api/users/profile', () => {
    beforeEach(async () => {
      // Create and login a test user
      testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
        tenantId: testTenant._id,
        isVerified: true
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'test@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-tenant'
        });

      authToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.password).toBeUndefined();
    });

    it('should fail without authentication token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access token required');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid access token');
    });
  });

  describe('MFA Integration', () => {
    beforeEach(async () => {
      testUser = new User({
        username: 'mfauser',
        email: 'mfa@example.com',
        password: 'SecurePass123!',
        firstName: 'MFA',
        lastName: 'User',
        tenantId: testTenant._id,
        isVerified: true
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'mfa@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-tenant'
        });

      authToken = loginResponse.body.data.tokens.accessToken;
    });

    it('should setup MFA successfully', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.data.backupCodes).toBeDefined();
      expect(response.body.data.backupCodes).toHaveLength(10);
    });

    it('should fail to setup MFA when already enabled', async () => {
      // Setup MFA first
      await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Enable MFA (this would normally require a valid token)
      const user = await User.findById(testUser._id);
      user.mfaEnabled = true;
      await user.save();

      // Try to setup again
      const response = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('MFA already enabled');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      const invalidData = {
        identifier: 'test@example.com',
        password: 'wrongpassword',
        tenantSlug: 'test-tenant'
      };

      // Make requests up to the rate limit
      const promises = Array.from({ length: 12 }, () =>
        request(app)
          .post('/api/auth/login')
          .send(invalidData)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Tenant Context', () => {
    beforeEach(async () => {
      // Create second tenant
      const secondTenant = new Tenant({
        name: 'Second Tenant',
        slug: 'second-tenant',
        subscriptionPlan: 'professional',
        subscriptionStatus: 'active'
      });
      await secondTenant.save();

      // Create user in second tenant
      const userInSecondTenant = new User({
        username: 'seconduser',
        email: 'second@example.com',
        password: 'SecurePass123!',
        firstName: 'Second',
        lastName: 'User',
        tenantId: secondTenant._id,
        isVerified: true
      });
      await userInSecondTenant.save();
    });

    it('should isolate users by tenant during login', async () => {
      // Try to login with user from different tenant
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'second@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'test-tenant' // Wrong tenant
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should allow login with correct tenant', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          identifier: 'second@example.com',
          password: 'SecurePass123!',
          tenantSlug: 'second-tenant' // Correct tenant
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenant.slug).toBe('second-tenant');
    });
  });
});