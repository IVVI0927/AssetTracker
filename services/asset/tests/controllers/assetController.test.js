const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const AssetController = require('../../controllers/assetController');
const Asset = require('../../models/Asset');
const User = require('../../models/User');

// Mock logger
jest.mock('../../logger/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('AssetController', () => {
  let app;
  let mongoServer;
  let testUser;
  let testTenantId;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = testUser;
      req.tenantId = testTenantId;
      next();
    });

    // Define routes
    app.get('/assets', (req, res) => AssetController.getAssets(req, res));
    app.post('/assets', (req, res) => AssetController.createAsset(req, res));
    app.get('/assets/:id', (req, res) => AssetController.getAssetById(req, res));
    app.put('/assets/:id', (req, res) => AssetController.updateAsset(req, res));
    app.delete('/assets/:id', (req, res) => AssetController.deleteAsset(req, res));
    app.post('/assets/:id/transfer', (req, res) => AssetController.transferAsset(req, res));
    app.get('/assets/search', (req, res) => AssetController.searchAssets(req, res));
  });

  beforeEach(async () => {
    // Clean database before each test
    await Asset.deleteMany({});
    await User.deleteMany({});
    
    // Create test tenant and user
    testTenantId = new mongoose.Types.ObjectId();
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      tenantId: testTenantId,
      roles: ['manager'],
      permissions: ['assets:read', 'assets:write', 'assets:delete']
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('GET /assets', () => {
    beforeEach(async () => {
      // Create test assets
      const assets = [
        {
          name: 'MacBook Pro 16"',
          category: 'Laptops',
          status: 'active',
          serialNumber: 'MBP001',
          purchaseDate: new Date('2023-01-15'),
          purchasePrice: 2499.99,
          tenantId: testTenantId,
          tags: ['electronics', 'mobile'],
          customFields: { warranty: '3 years' }
        },
        {
          name: 'Dell Monitor',
          category: 'Monitors',
          status: 'active',
          serialNumber: 'MON001',
          purchaseDate: new Date('2023-02-01'),
          purchasePrice: 299.99,
          tenantId: testTenantId,
          tags: ['electronics', 'stationary']
        },
        {
          name: 'Office Chair',
          category: 'Furniture',
          status: 'maintenance',
          purchaseDate: new Date('2022-12-01'),
          purchasePrice: 199.99,
          tenantId: testTenantId,
          tags: ['furniture']
        }
      ];

      await Asset.insertMany(assets);
    });

    it('should return all assets for tenant', async () => {
      const response = await request(app)
        .get('/assets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter assets by category', async () => {
      const response = await request(app)
        .get('/assets?category=Laptops')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(1);
      expect(response.body.data.assets[0].category).toBe('Laptops');
    });

    it('should filter assets by status', async () => {
      const response = await request(app)
        .get('/assets?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(2);
      expect(response.body.data.assets.every(asset => asset.status === 'active')).toBe(true);
    });

    it('should search assets by name', async () => {
      const response = await request(app)
        .get('/assets?search=MacBook')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(1);
      expect(response.body.data.assets[0].name).toContain('MacBook');
    });

    it('should sort assets by purchase price descending', async () => {
      const response = await request(app)
        .get('/assets?sortBy=purchasePrice&sortOrder=desc')
        .expect(200);

      expect(response.body.success).toBe(true);
      const assets = response.body.data.assets;
      expect(assets[0].purchasePrice).toBeGreaterThan(assets[1].purchasePrice);
    });

    it('should paginate results correctly', async () => {
      const response = await request(app)
        .get('/assets?page=1&limit=2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNextPage).toBe(true);
    });

    it('should return empty results for non-matching filters', async () => {
      const response = await request(app)
        .get('/assets?category=NonExistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assets).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });
  });

  describe('POST /assets', () => {
    it('should create a new asset successfully', async () => {
      const assetData = {
        name: 'iPhone 14 Pro',
        category: 'Mobile Devices',
        serialNumber: 'IP001',
        purchaseDate: '2023-03-15',
        purchasePrice: 999.99,
        location: {
          building: 'HQ',
          floor: '2',
          room: '201'
        },
        tags: ['mobile', 'electronics'],
        customFields: {
          color: 'Space Gray',
          storage: '256GB'
        }
      };

      const response = await request(app)
        .post('/assets')
        .send(assetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(assetData.name);
      expect(response.body.data.category).toBe(assetData.category);
      expect(response.body.data.tenantId).toBe(testTenantId.toString());
      expect(response.body.data.status).toBe('active'); // Default status

      // Verify asset was created in database
      const asset = await Asset.findById(response.body.data._id);
      expect(asset).toBeTruthy();
      expect(asset.name).toBe(assetData.name);
      expect(asset.customFields.color).toBe(assetData.customFields.color);
    });

    it('should reject asset creation with missing required fields', async () => {
      const invalidAssetData = {
        // Missing name and category
        purchasePrice: 100
      };

      const response = await request(app)
        .post('/assets')
        .send(invalidAssetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should reject asset creation with invalid data types', async () => {
      const invalidAssetData = {
        name: 'Test Asset',
        category: 'Test Category',
        purchasePrice: 'invalid-price', // Should be number
        purchaseDate: 'invalid-date'   // Should be valid date
      };

      const response = await request(app)
        .post('/assets')
        .send(invalidAssetData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should create asset with minimal required data', async () => {
      const minimalAssetData = {
        name: 'Minimal Asset',
        category: 'Test Category'
      };

      const response = await request(app)
        .post('/assets')
        .send(minimalAssetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(minimalAssetData.name);
      expect(response.body.data.status).toBe('active');
    });
  });

  describe('GET /assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await Asset.create({
        name: 'Test Asset',
        category: 'Test Category',
        status: 'active',
        serialNumber: 'TEST001',
        tenantId: testTenantId,
        assignedTo: testUser._id
      });
    });

    it('should return asset by ID', async () => {
      const response = await request(app)
        .get(`/assets/${testAsset._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testAsset._id.toString());
      expect(response.body.data.name).toBe(testAsset.name);
      expect(response.body.data.assignedTo).toBeDefined();
      expect(response.body.data.assignedTo.username).toBe(testUser.username);
    });

    it('should return 404 for non-existent asset', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/assets/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Asset not found');
    });

    it('should return 400 for invalid asset ID format', async () => {
      const response = await request(app)
        .get('/assets/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid asset ID format');
    });
  });

  describe('PUT /assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await Asset.create({
        name: 'Original Asset',
        category: 'Original Category',
        status: 'active',
        serialNumber: 'ORIG001',
        tenantId: testTenantId,
        purchasePrice: 100
      });
    });

    it('should update asset successfully', async () => {
      const updateData = {
        name: 'Updated Asset Name',
        status: 'maintenance',
        purchasePrice: 150,
        location: {
          building: 'Building A',
          floor: '3'
        }
      };

      const response = await request(app)
        .put(`/assets/${testAsset._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.status).toBe(updateData.status);
      expect(response.body.data.purchasePrice).toBe(updateData.purchasePrice);
      expect(response.body.data.location.building).toBe(updateData.location.building);

      // Verify changes persisted to database
      const updatedAsset = await Asset.findById(testAsset._id);
      expect(updatedAsset.name).toBe(updateData.name);
      expect(updatedAsset.status).toBe(updateData.status);
    });

    it('should update only provided fields', async () => {
      const partialUpdate = {
        status: 'retired'
      };

      const response = await request(app)
        .put(`/assets/${testAsset._id}`)
        .send(partialUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('retired');
      expect(response.body.data.name).toBe(testAsset.name); // Should remain unchanged
      expect(response.body.data.category).toBe(testAsset.category); // Should remain unchanged
    });

    it('should reject update with invalid data', async () => {
      const invalidUpdate = {
        status: 'invalid-status',
        purchasePrice: -100 // Negative price
      };

      const response = await request(app)
        .put(`/assets/${testAsset._id}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent asset', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/assets/${nonExistentId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Asset not found');
    });
  });

  describe('DELETE /assets/:id', () => {
    let testAsset;

    beforeEach(async () => {
      testAsset = await Asset.create({
        name: 'Asset to Delete',
        category: 'Test Category',
        status: 'active',
        tenantId: testTenantId
      });
    });

    it('should delete asset successfully', async () => {
      const response = await request(app)
        .delete(`/assets/${testAsset._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Asset deleted successfully');

      // Verify asset was deleted from database
      const deletedAsset = await Asset.findById(testAsset._id);
      expect(deletedAsset).toBeNull();
    });

    it('should return 404 for non-existent asset', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/assets/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Asset not found');
    });
  });

  describe('POST /assets/:id/transfer', () => {
    let testAsset;
    let targetUser;

    beforeEach(async () => {
      testAsset = await Asset.create({
        name: 'Transfer Asset',
        category: 'Test Category',
        status: 'active',
        tenantId: testTenantId
      });

      targetUser = await User.create({
        username: 'targetuser',
        email: 'target@example.com',
        firstName: 'Target',
        lastName: 'User',
        tenantId: testTenantId,
        roles: ['operator']
      });
    });

    it('should transfer asset to user successfully', async () => {
      const transferData = {
        assignedTo: targetUser._id.toString(),
        transferReason: 'Employee assignment'
      };

      const response = await request(app)
        .post(`/assets/${testAsset._id}/transfer`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Asset transferred successfully');
      expect(response.body.data.assignedTo._id).toBe(targetUser._id.toString());

      // Verify transfer persisted to database
      const transferredAsset = await Asset.findById(testAsset._id);
      expect(transferredAsset.assignedTo.toString()).toBe(targetUser._id.toString());
    });

    it('should unassign asset when assignedTo is null', async () => {
      // First assign asset to a user
      testAsset.assignedTo = testUser._id;
      await testAsset.save();

      const transferData = {
        assignedTo: null,
        transferReason: 'Returned to inventory'
      };

      const response = await request(app)
        .post(`/assets/${testAsset._id}/transfer`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedTo).toBeNull();

      // Verify unassignment persisted to database
      const unassignedAsset = await Asset.findById(testAsset._id);
      expect(unassignedAsset.assignedTo).toBeNull();
    });

    it('should reject transfer to non-existent user', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();
      const transferData = {
        assignedTo: nonExistentUserId.toString(),
        transferReason: 'Test assignment'
      };

      const response = await request(app)
        .post(`/assets/${testAsset._id}/transfer`)
        .send(transferData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Target user not found');
    });
  });
});