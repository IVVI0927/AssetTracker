const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  // Event Identification
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  correlationId: {
    type: String,
    index: true
  },
  parentEventId: {
    type: String,
    index: true
  },
  
  // Event Classification
  eventType: {
    type: String,
    required: true,
    enum: [
      'user.created', 'user.updated', 'user.deleted', 'user.login', 'user.logout',
      'asset.created', 'asset.updated', 'asset.deleted', 'asset.transferred',
      'tenant.created', 'tenant.updated', 'tenant.settings_changed',
      'auth.mfa_enabled', 'auth.password_changed', 'auth.failed_login',
      'compliance.data_export', 'compliance.data_deletion', 'compliance.retention_policy_applied',
      'security.permission_changed', 'security.role_assigned', 'security.access_denied',
      'system.backup_created', 'system.maintenance', 'system.error'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: ['user', 'asset', 'tenant', 'auth', 'compliance', 'security', 'system']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Actor Information
  actor: {
    type: {
      type: String,
      enum: ['user', 'system', 'service', 'api_key'],
      required: true
    },
    id: String,
    name: String,
    email: String,
    ip: String,
    userAgent: String,
    service: String // For system/service actors
  },
  
  // Tenant Context
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Resource Information
  resource: {
    type: {
      type: String,
      enum: ['user', 'asset', 'tenant', 'role', 'permission', 'setting', 'report'],
      required: true
    },
    id: String,
    name: String,
    path: String
  },
  
  // Event Details
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'login', 'logout', 'export', 'import', 'transfer', 'assign', 'revoke']
  },
  description: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Change Tracking
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  
  // Context and Metadata
  metadata: {
    requestId: String,
    sessionId: String,
    apiVersion: String,
    clientVersion: String,
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: [Number] // [longitude, latitude]
    }
  },
  
  // Status and Processing
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed', 'archived'],
    default: 'pending'
  },
  processingErrors: [String],
  
  // Compliance and Retention
  complianceFlags: [{
    type: String,
    enum: ['gdpr', 'hipaa', 'sox', 'pci_dss', 'iso27001']
  }],
  retentionPolicy: {
    type: String,
    enum: ['standard', 'extended', 'permanent', 'gdpr_deletion'],
    default: 'standard'
  },
  retentionUntil: Date,
  
  // Immutability and Integrity
  hash: {
    type: String,
    required: true,
    index: true
  },
  previousHash: String,
  signature: String, // Digital signature for non-repudiation
  
  // Timing
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  processedAt: Date,
  archivedAt: Date
}, {
  timestamps: true,
  collection: 'audit_events'
});

// Compound indexes for performance
auditEventSchema.index({ tenantId: 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, eventType: 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, category: 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, 'actor.id': 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, 'resource.type': 1, 'resource.id': 1 });
auditEventSchema.index({ correlationId: 1, timestamp: 1 });
auditEventSchema.index({ retentionUntil: 1 });
auditEventSchema.index({ complianceFlags: 1 });

// TTL index for automatic deletion based on retention policy
auditEventSchema.index(
  { "retentionUntil": 1 },
  { expireAfterSeconds: 0 }
);

// Pre-save middleware to generate hash and ensure immutability
auditEventSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate unique event ID if not provided
    if (!this.eventId) {
      this.eventId = require('uuid').v4();
    }
    
    // Calculate hash for integrity
    this.hash = this.calculateHash();
    
    // Set retention date based on policy
    this.setRetentionDate();
  } else {
    // Prevent modification of existing events (immutability)
    const error = new Error('Audit events are immutable and cannot be modified');
    error.name = 'ImmutabilityError';
    return next(error);
  }
  
  next();
});

// Instance methods
auditEventSchema.methods.calculateHash = function() {
  const crypto = require('crypto');
  const data = {
    eventId: this.eventId,
    eventType: this.eventType,
    timestamp: this.timestamp,
    actor: this.actor,
    resource: this.resource,
    action: this.action,
    tenantId: this.tenantId,
    previousHash: this.previousHash || ''
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
};

auditEventSchema.methods.setRetentionDate = function() {
  const now = new Date();
  
  switch (this.retentionPolicy) {
    case 'standard':
      // 7 years for standard compliance
      this.retentionUntil = new Date(now.setFullYear(now.getFullYear() + 7));
      break;
    case 'extended':
      // 10 years for extended compliance
      this.retentionUntil = new Date(now.setFullYear(now.getFullYear() + 10));
      break;
    case 'permanent':
      // No expiration
      this.retentionUntil = null;
      break;
    case 'gdpr_deletion':
      // 30 days for GDPR deletion requests
      this.retentionUntil = new Date(now.setDate(now.getDate() + 30));
      break;
    default:
      this.retentionUntil = new Date(now.setFullYear(now.getFullYear() + 7));
  }
};

auditEventSchema.methods.verifyIntegrity = function() {
  return this.hash === this.calculateHash();
};

auditEventSchema.methods.toCompliantExport = function(complianceType = 'gdpr') {
  const exported = this.toObject();
  
  // Remove sensitive fields based on compliance requirements
  if (complianceType === 'gdpr') {
    delete exported.actor.ip;
    delete exported.metadata.location;
    if (exported.actor.type === 'user') {
      exported.actor.name = '[REDACTED]';
      exported.actor.email = '[REDACTED]';
    }
  }
  
  return exported;
};

// Static methods
auditEventSchema.statics.createEvent = async function(eventData) {
  // Get the last event hash for chaining
  const lastEvent = await this.findOne({
    tenantId: eventData.tenantId
  }).sort({ timestamp: -1 });
  
  if (lastEvent) {
    eventData.previousHash = lastEvent.hash;
  }
  
  // Set correlation ID if not provided
  if (!eventData.correlationId) {
    eventData.correlationId = require('uuid').v4();
  }
  
  return new this(eventData);
};

auditEventSchema.statics.findByTimeRange = function(tenantId, startDate, endDate, options = {}) {
  const query = {
    tenantId,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (options.eventType) {
    query.eventType = options.eventType;
  }
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.actorId) {
    query['actor.id'] = options.actorId;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 1000);
};

auditEventSchema.statics.verifyChain = async function(tenantId) {
  const events = await this.find({ tenantId }).sort({ timestamp: 1 });
  
  for (let i = 1; i < events.length; i++) {
    const currentEvent = events[i];
    const previousEvent = events[i - 1];
    
    // Verify hash integrity
    if (!currentEvent.verifyIntegrity()) {
      return {
        valid: false,
        error: `Hash integrity failed for event ${currentEvent.eventId}`,
        eventId: currentEvent.eventId
      };
    }
    
    // Verify chain integrity
    if (currentEvent.previousHash !== previousEvent.hash) {
      return {
        valid: false,
        error: `Chain integrity failed between events ${previousEvent.eventId} and ${currentEvent.eventId}`,
        eventId: currentEvent.eventId
      };
    }
  }
  
  return { valid: true };
};

module.exports = mongoose.model('AuditEvent', auditEventSchema);