const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  resource: {
    type: String,
    required: true,
    enum: [
      'users', 'assets', 'tenants', 'reports', 'integrations', 
      'settings', 'audit-logs', 'notifications', 'analytics'
    ]
  },
  actions: [{
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'export', 'import', 'manage']
  }]
});

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['super-admin', 'tenant-admin', 'manager', 'operator', 'viewer']
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  permissions: [permissionSchema],
  isSystemRole: {
    type: Boolean,
    default: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    sparse: true // Allow null for system roles
  }
}, {
  timestamps: true
});

// Indexes
roleSchema.index({ name: 1, tenantId: 1 });

// Static method to get default roles
roleSchema.statics.getDefaultRoles = function() {
  return [
    {
      name: 'super-admin',
      displayName: 'Super Administrator',
      description: 'Full system access across all tenants',
      permissions: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'assets', actions: ['create', 'read', 'update', 'delete', 'export', 'import', 'manage'] },
        { resource: 'tenants', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
        { resource: 'integrations', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'settings', actions: ['read', 'update', 'manage'] },
        { resource: 'audit-logs', actions: ['read', 'export'] },
        { resource: 'notifications', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'analytics', actions: ['read', 'export'] }
      ],
      isSystemRole: true
    },
    {
      name: 'tenant-admin',
      displayName: 'Tenant Administrator',
      description: 'Full access within tenant scope',
      permissions: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'assets', actions: ['create', 'read', 'update', 'delete', 'export', 'import'] },
        { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
        { resource: 'integrations', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'settings', actions: ['read', 'update'] },
        { resource: 'audit-logs', actions: ['read', 'export'] },
        { resource: 'notifications', actions: ['create', 'read', 'update', 'delete'] },
        { resource: 'analytics', actions: ['read', 'export'] }
      ],
      isSystemRole: true
    },
    {
      name: 'manager',
      displayName: 'Manager',
      description: 'Manage assets and view reports',
      permissions: [
        { resource: 'users', actions: ['read'] },
        { resource: 'assets', actions: ['create', 'read', 'update', 'delete', 'export'] },
        { resource: 'reports', actions: ['create', 'read', 'export'] },
        { resource: 'audit-logs', actions: ['read'] },
        { resource: 'analytics', actions: ['read'] }
      ],
      isSystemRole: true
    },
    {
      name: 'operator',
      displayName: 'Operator',
      description: 'Create and manage assets',
      permissions: [
        { resource: 'assets', actions: ['create', 'read', 'update'] },
        { resource: 'reports', actions: ['read'] }
      ],
      isSystemRole: true
    },
    {
      name: 'viewer',
      displayName: 'Viewer',
      description: 'Read-only access to assets',
      permissions: [
        { resource: 'assets', actions: ['read'] },
        { resource: 'reports', actions: ['read'] }
      ],
      isSystemRole: true
    }
  ];
};

// Instance methods
roleSchema.methods.hasPermission = function(resource, action) {
  const permission = this.permissions.find(p => p.resource === resource);
  return permission ? permission.actions.includes(action) : false;
};

module.exports = mongoose.model('Role', roleSchema);