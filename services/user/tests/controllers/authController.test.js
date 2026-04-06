const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const AuthController = require('../../controllers/authController');
const User = require('../../models/User');
const Tenant = require('../../models/Tenant');
const redis = require('../../utils/redis');

// Mock Redis
jest.mock('../../utils/redis', () => ({
  setex: jest.fn(),
  del: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('AuthController', () => {
  let app;
  let mongoServer;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock middleware for tenant resolution
    app.use((req, res, next) => {
      req.tenantId = 'test-tenant-id';
      next();
    });

    // Define routes
    app.post('/register', (req, res) => AuthController.register(req, res));
    app.post('/login', (req, res) => AuthController.login(req, res));
    app.post('/refresh', (req, res) => AuthController.refreshToken(req, res));
    app.post('/logout', (req, res, next) => {
      // Mock authenticated user middleware
      req.user = { _id: 'user123', tenantId: 'tenant123' };
      next();
    }, (req, res) => AuthController.logout(req, res));
  });

  beforeEach(async () => {
    // Clean database before each test
    await User.deleteMany({});
    await Tenant.deleteMany({});
    
    // Reset Redis mocks
    redis.setex.mockClear();
    redis.del.mockClear();
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('POST /register', () => {
    let testTenant;

    beforeEach(async () => {
      // Create a test tenant
      testTenant = await Tenant.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        isActive: true,
        settings: {
          requireEmailVerification: false,
          passwordMinLength: 8,
          sessionTimeout: 3600,
          mfaRequired: false,
          allowUserRegistration: true
        },
        limits: {
          users: 100,
          assets: 1000,
          storage: 1024 * 1024 * 1024 // 1GB
        },
        usage: {
          users: 0,
          assets: 0,
          storage: 0,
          apiCalls: 0
        }
      });
    });

    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined();

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.username).toBe(userData.username);
      expect(user.tenantId.toString()).toBe(testTenant._id.toString());
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123', // Too weak
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject registration for non-existent tenant', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'non-existent-tenant'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Tenant not found or inactive');
    });

    it('should reject duplicate user registration', async () => {
      // Create first user
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        tenantId: testTenant._id,
        roles: ['viewer']
      });

      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists with this email or username');
    });
  });

  describe('POST /login', () => {
    let testTenant;
    let testUser;

    beforeEach(async () => {
      testTenant = await Tenant.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        isActive: true,
        settings: {
          requireEmailVerification: false,
          passwordMinLength: 8,
          sessionTimeout: 3600,
          mfaRequired: false
        }
      });

      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!', // Will be hashed by pre-save middleware
        firstName: 'Test',
        lastName: 'User',
        tenantId: testTenant._id,
        roles: ['viewer'],
        isActive: true,
        isVerified: true
      });
    });

    it('should login user successfully with username', async () => {
      const loginData = {
        identifier: 'testuser',
        password: 'Password123!',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(redis.setex).toHaveBeenCalled();
    });

    it('should login user successfully with email', async () => {
      const loginData = {
        identifier: 'test@example.com',
        password: 'Password123!',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        identifier: 'testuser',
        password: 'wrongpassword',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login for non-existent user', async () => {
      const loginData = {
        identifier: 'nonexistent',
        password: 'Password123!',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should reject login for inactive user', async () => {
      testUser.isActive = false;
      await testUser.save();

      const loginData = {
        identifier: 'testuser',
        password: 'Password123!',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account deactivated');
    });

    it('should handle account lockout after failed attempts', async () => {
      // Simulate failed login attempts
      testUser.loginAttempts = 5;
      testUser.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes from now
      await testUser.save();

      const loginData = {
        identifier: 'testuser',
        password: 'Password123!',
        tenantSlug: 'test-tenant'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Account locked due to too many failed attempts');
    });
  });

  describe('POST /refresh', () => {
    let testUser;

    beforeEach(async () => {
      const testTenant = await Tenant.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
        isActive: true
      });

      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        tenantId: testTenant._id,
        roles: ['viewer'],
        refreshTokens: [
          {
            token: 'valid-refresh-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            deviceInfo: 'test-device'
          }
        ]
      });
    });

    it('should refresh token successfully', async () => {
      const refreshData = {
        refreshToken: 'valid-refresh-token'
      };

      const response = await request(app)
        .post('/refresh')
        .send(refreshData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.expiresIn).toBe(900);
    });

    it('should reject invalid refresh token', async () => {
      const refreshData = {
        refreshToken: 'invalid-token'
      };

      const response = await request(app)
        .post('/refresh')
        .send(refreshData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      // Update token to be expired
      testUser.refreshTokens[0].expiresAt = new Date(Date.now() - 1000);
      await testUser.save();

      const refreshData = {
        refreshToken: 'valid-refresh-token'
      };

      const response = await request(app)
        .post('/refresh')
        .send(refreshData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token expired');
    });
  });

  describe('POST /logout', () => {
    it('should logout user successfully', async () => {
      const logoutData = {
        refreshToken: 'test-refresh-token'
      };

      const response = await request(app)
        .post('/logout')
        .send(logoutData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('Token generation methods', () => {
    let testTenant;

    beforeEach(async () => {
      testTenant = await Tenant.create({
        name: 'Test Tenant',
        slug: 'test-tenant'
      });
    });

    it('should generate valid access token', () => {
      const user = {
        _id: 'user123',
        roles: ['viewer'],
        permissions: ['assets:read']
      };

      const token = AuthController.generateAccessToken(user, testTenant);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token structure
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(user._id);
      expect(decoded.tenantId).toBe(testTenant._id.toString());
      expect(decoded.roles).toEqual(user.roles);
      expect(decoded.permissions).toEqual(user.permissions);
    });

    it('should generate refresh token', () => {
      const token = AuthController.generateRefreshToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(80); // 40 bytes in hex
    });

    it('should generate temporary token', () => {
      const userId = 'user123';
      const token = AuthController.generateTempToken(userId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(userId);
      expect(decoded.temp).toBe(true);
    });
  });
});