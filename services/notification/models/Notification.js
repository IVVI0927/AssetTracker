const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['alert', 'info', 'warning', 'system', 'asset-update', 'assignment', 'maintenance'],
    index: true
  },
  subject: {
    type: String,
    required: true,
    maxLength: 255
  },
  message: {
    type: String,
    required: true,
    maxLength: 2000
  },
  channels: [{
    type: String,
    enum: ['email', 'sms', 'push', 'in-app']
  }],
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
    index: true
  },
  metadata: {
    templateId: String,
    templateData: mongoose.Schema.Types.Mixed,
    assetId: String,
    actionUrl: String,
    expiresAt: Date
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  lastAttemptAt: Date,
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
notificationSchema.index({ userId: 1, tenantId: 1, status: 1 });
notificationSchema.index({ userId: 1, tenantId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

// Pre-save middleware to update timestamps
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.deliveryAttempts += 1;
  this.lastAttemptAt = new Date();
  this.metadata.lastError = error;
  return this.save();
};

// Static methods
notificationSchema.statics.getUnreadCount = function(userId, tenantId) {
  return this.countDocuments({
    userId,
    tenantId,
    status: { $in: ['pending', 'sent', 'delivered'] }
  });
};

notificationSchema.statics.markAllAsRead = function(userId, tenantId) {
  return this.updateMany(
    { 
      userId,
      tenantId,
      status: { $in: ['pending', 'sent', 'delivered'] }
    },
    { 
      status: 'read',
      readAt: new Date()
    }
  );
};

notificationSchema.statics.getByType = function(userId, tenantId, type, limit = 10) {
  return this.find({
    userId,
    tenantId,
    type
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Notification', notificationSchema);