const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all tenant routes
router.use(authMiddleware.authenticate);

// Get current tenant info
router.get('/current', (req, res) => {
  res.json({
    success: true,
    data: req.tenant
  });
});

// Update tenant settings (admin only)
router.put('/settings',
  authMiddleware.authorize(['tenant-admin'], ['settings:update']),
  (req, res) => {
    res.json({
      success: true,
      message: 'Tenant settings update endpoint - implementation needed'
    });
  }
);

module.exports = router;