const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../index');
const Asset = require('../../models/Asset');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');

describe('Asset Controller', () => {
  let mongoServer;
  let testUser;
  let authToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);

    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      tenantId: 'test-tenant',
      role: 'admin'
    });
    await testUser.save();

    // Generate auth token
    authToken = jwt.sign(
      { 
        userId: testUser._id.toString(),
        tenantId: testUser.tenantId,
        role: testUser.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear assets before each test
    await Asset.deleteMany({});
  });

  describe('POST /api/assets', () => {
    it('should create a new asset', async () => {
      const assetData = {
        name: 'Test Laptop',
        description: 'Dell Latitude 5520',
        category: 'IT Equipment',
        location: 'Office Floor 2',
        serialNumber: 'DL123456',
        value: 1200.00,
        status: 'active'
      };

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.asset.name).toBe(assetData.name);
      expect(response.body.asset.serialNumber).toBe(assetData.serialNumber);
      expect(response.body.asset.tenantId).toBe(testUser.tenantId);
      expect(response.body.asset.createdBy).toBe(testUser._id.toString());
    });

    it('should return 400 for invalid asset data', async () => {
      const invalidAssetData = {
        // Missing required fields
        description: 'Missing name field'
      };

      const response = await request(app)
        .post('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAssetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 401 for unauthorized requests', async () => {
      const assetData = {
        name: 'Test Asset',
        category: 'Test Category'
      };

      await request(app)
        .post('/api/assets')
        .send(assetData)
        .expect(401);
    });
  });

  describe('GET /api/assets', () => {
    beforeEach(async () => {
      // Create test assets
      const assets = [
        {
          name: 'Laptop 1',
          category: 'IT Equipment',
          location: 'Office 1',
          serialNumber: 'L001',
          tenantId: testUser.tenantId,
          createdBy: testUser._id
        },
        {
          name: 'Laptop 2',
          category: 'IT Equipment',
          location: 'Office 2',
          serialNumber: 'L002',
          tenantId: testUser.tenantId,
          createdBy: testUser._id
        },
        {
          name: 'Different Tenant Asset',
          category: 'IT Equipment',
          location: 'Office 3',
          serialNumber: 'L003',
          tenantId: 'different-tenant',
          createdBy: testUser._id
        }
      ];

      await Asset.insertMany(assets);
    });

    it('should get all assets for the tenant', async () => {
      const response = await request(app)
        .get('/api/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(2); // Only tenant assets
      expect(response.body.assets[0].tenantId).toBe(testUser.tenantId);
      expect(response.body.assets[1].tenantId).toBe(testUser.tenantId);
    });

    it('should filter assets by category', async () => {
      // Add asset with different category
      await new Asset({
        name: 'Office Chair',
        category: 'Furniture',
        location: 'Office 1',
        serialNumber: 'F001',
        tenantId: testUser.tenantId,
        createdBy: testUser._id
      }).save();

      const response = await request(app)
        .get('/api/assets?category=IT Equipment')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(2);
      expect(response.body.assets.every(asset => asset.category === 'IT Equipment')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/assets?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
      expect(response.body.pagination.total).toBe(2);
    });
  });

  describe('GET /api/assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = new Asset({
        name: 'Test Asset',
        category: 'Test Category',
        location: 'Test Location',
        serialNumber: 'TEST001',
        tenantId: testUser.tenantId,
        createdBy: testUser._id
      });
      await testAsset.save();
    });

    it('should get asset by ID', async () => {
      const response = await request(app)
        .get(`/api/assets/${testAsset._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.asset._id).toBe(testAsset._id.toString());
      expect(response.body.asset.name).toBe(testAsset.name);
    });

    it('should return 404 for non-existent asset', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/assets/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid asset ID', async () => {
      const response = await request(app)
        .get('/api/assets/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = new Asset({
        name: 'Original Name',
        category: 'Original Category',
        location: 'Original Location',
        serialNumber: 'ORIG001',
        tenantId: testUser.tenantId,
        createdBy: testUser._id
      });
      await testAsset.save();
    });

    it('should update asset successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        category: 'Updated Category',
        location: 'Updated Location'
      };

      const response = await request(app)
        .put(`/api/assets/${testAsset._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.asset.name).toBe(updateData.name);
      expect(response.body.asset.category).toBe(updateData.category);
      expect(response.body.asset.location).toBe(updateData.location);
      expect(response.body.asset.updatedBy).toBe(testUser._id.toString());
    });

    it('should not allow updating assets from different tenant', async () => {
      // Create asset for different tenant
      const otherAsset = new Asset({
        name: 'Other Asset',
        category: 'Other Category',
        location: 'Other Location',
        serialNumber: 'OTHER001',
        tenantId: 'different-tenant',
        createdBy: testUser._id
      });
      await otherAsset.save();

      const updateData = { name: 'Hacked Name' };

      const response = await request(app)
        .put(`/api/assets/${otherAsset._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = new Asset({
        name: 'Asset to Delete',
        category: 'Test Category',
        location: 'Test Location',
        serialNumber: 'DEL001',
        tenantId: testUser.tenantId,
        createdBy: testUser._id
      });
      await testAsset.save();
    });

    it('should delete asset successfully', async () => {
      const response = await request(app)
        .delete(`/api/assets/${testAsset._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify asset is actually deleted
      const deletedAsset = await Asset.findById(testAsset._id);
      expect(deletedAsset).toBeNull();
    });

    it('should return 404 for non-existent asset', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/assets/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/assets/transfer', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = new Asset({
        name: 'Asset to Transfer',
        category: 'IT Equipment',
        location: 'Office 1',
        serialNumber: 'TRANS001',
        assignedTo: testUser._id,
        tenantId: testUser.tenantId,
        createdBy: testUser._id
      });
      await testAsset.save();
    });

    it('should transfer asset to new user', async () => {
      // Create another user
      const newUser = new User({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'hashedpassword',
        tenantId: testUser.tenantId
      });
      await newUser.save();

      const transferData = {
        assetId: testAsset._id,
        newAssignee: newUser._id,
        reason: 'Employee transfer',
        notes: 'Asset transferred due to department change'
      };

      const response = await request(app)
        .post('/api/assets/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.asset.assignedTo).toBe(newUser._id.toString());
      expect(response.body.asset.transferHistory).toHaveLength(1);
      
      const transfer = response.body.asset.transferHistory[0];
      expect(transfer.fromUser).toBe(testUser._id.toString());
      expect(transfer.toUser).toBe(newUser._id.toString());
      expect(transfer.reason).toBe(transferData.reason);
    });

    it('should return 400 for invalid transfer data', async () => {
      const invalidTransferData = {
        assetId: testAsset._id
        // Missing newAssignee
      };

      const response = await request(app)
        .post('/api/assets/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTransferData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Asset Search', () => {
    beforeEach(async () => {
      const assets = [
        {
          name: 'MacBook Pro 13',
          category: 'IT Equipment',
          location: 'Development Team',
          serialNumber: 'MBP001',
          tenantId: testUser.tenantId,
          createdBy: testUser._id,
          tags: ['laptop', 'apple', 'development']
        },
        {
          name: 'Dell Monitor 24"',
          category: 'IT Equipment',
          location: 'Development Team',
          serialNumber: 'MON001',
          tenantId: testUser.tenantId,
          createdBy: testUser._id,
          tags: ['monitor', 'dell', 'display']
        },
        {
          name: 'Office Chair Ergonomic',
          category: 'Furniture',
          location: 'HR Department',
          serialNumber: 'CHAIR001',
          tenantId: testUser.tenantId,
          createdBy: testUser._id,
          tags: ['furniture', 'ergonomic', 'office']
        }
      ];

      await Asset.insertMany(assets);
    });

    it('should search assets by name', async () => {
      const response = await request(app)
        .get('/api/assets/search?q=MacBook')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(1);
      expect(response.body.assets[0].name).toContain('MacBook');
    });

    it('should search assets by serial number', async () => {
      const response = await request(app)
        .get('/api/assets/search?q=MON001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(1);
      expect(response.body.assets[0].serialNumber).toBe('MON001');
    });

    it('should search assets by tags', async () => {
      const response = await request(app)
        .get('/api/assets/search?q=apple')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(1);
      expect(response.body.assets[0].tags).toContain('apple');
    });

    it('should return empty results for non-matching search', async () => {
      const response = await request(app)
        .get('/api/assets/search?q=nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.assets).toHaveLength(0);
    });
  });

  describe('Asset Statistics', () => {
    beforeEach(async () => {
      const assets = [
        {
          name: 'Asset 1',
          category: 'IT Equipment',
          status: 'active',
          tenantId: testUser.tenantId,
          createdBy: testUser._id
        },
        {
          name: 'Asset 2',
          category: 'IT Equipment',
          status: 'maintenance',
          tenantId: testUser.tenantId,
          createdBy: testUser._id
        },
        {
          name: 'Asset 3',
          category: 'Furniture',
          status: 'active',
          tenantId: testUser.tenantId,
          createdBy: testUser._id
        }
      ];

      await Asset.insertMany(assets);
    });

    it('should get asset statistics', async () => {
      const response = await request(app)
        .get('/api/assets/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats.total).toBe(3);
      expect(response.body.stats.byCategory['IT Equipment']).toBe(2);
      expect(response.body.stats.byCategory['Furniture']).toBe(1);
      expect(response.body.stats.byStatus.active).toBe(2);
      expect(response.body.stats.byStatus.maintenance).toBe(1);
    });
  });
});