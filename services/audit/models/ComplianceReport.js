const mongoose = require('mongoose');

const complianceReportSchema = new mongoose.Schema({
  // Report Identification
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Tenant Context
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  
  // Report Configuration
  reportType: {
    type: String,
    required: true,
    enum: ['gdpr_data_export', 'gdpr_deletion', 'sox_financial', 'hipaa_access', 'iso27001_security', 'audit_trail', 'custom']
  },
  complianceFramework: {
    type: String,
    required: true,
    enum: ['gdpr', 'hipaa', 'sox', 'pci_dss', 'iso27001', 'ccpa', 'ferpa']
  },
  
  // Report Parameters
  parameters: {
    dateRange: {
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      }
    },
    filters: {
      eventTypes: [String],
      categories: [String],
      users: [String],
      resources: [String]
    },
    includePersonalData: {
      type: Boolean,
      default: false
    },
    anonymizeData: {
      type: Boolean,
      default: true
    }
  },
  
  // Report Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Report Results
  results: {
    totalEvents: Number,
    processedEvents: Number,
    filteredEvents: Number,
    summary: {
      eventsByType: Map,
      eventsByCategory: Map,
      eventsByUser: Map,
      complianceViolations: [{
        type: String,
        description: String,
        severity: String,
        count: Number,
        events: [String] // Event IDs
      }]
    }
  },
  
  // File Information
  files: [{
    filename: String,
    format: {
      type: String,
      enum: ['json', 'csv', 'pdf', 'xml']
    },
    size: Number,
    path: String,
    hash: String,
    encryptionKey: String,
    downloadCount: {
      type: Number,
      default: 0
    },
    lastDownloaded: Date
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestedBy: {
    name: String,
    email: String,
    role: String
  },
  
  // Processing Information
  processingStarted: Date,
  processingCompleted: Date,
  processingDuration: Number, // milliseconds
  processingErrors: [String],
  
  // Compliance and Legal
  legalBasis: String,
  dataSubject: {
    type: String, // For GDPR reports
    email: String
  },
  retentionUntil: Date,
  
  // Digital Signature
  signature: String,
  signedAt: Date,
  signedBy: String
}, {
  timestamps: true,
  collection: 'compliance_reports'
});

// Indexes
complianceReportSchema.index({ tenantId: 1, createdAt: -1 });
complianceReportSchema.index({ tenantId: 1, reportType: 1, createdAt: -1 });
complianceReportSchema.index({ tenantId: 1, status: 1 });
complianceReportSchema.index({ retentionUntil: 1 });
complianceReportSchema.index({ createdBy: 1 });

// TTL index for automatic cleanup
complianceReportSchema.index(
  { "retentionUntil": 1 },
  { expireAfterSeconds: 0 }
);

// Pre-save middleware
complianceReportSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate unique report ID
    if (!this.reportId) {
      this.reportId = `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Set retention date (default 1 year for reports)
    if (!this.retentionUntil) {
      const retentionDate = new Date();
      retentionDate.setFullYear(retentionDate.getFullYear() + 1);
      this.retentionUntil = retentionDate;
    }
  }
  
  next();
});

// Instance methods
complianceReportSchema.methods.canDownload = function(userId) {
  // Check if user has permission to download
  return this.createdBy.toString() === userId.toString() || 
         this.status === 'completed';
};

complianceReportSchema.methods.incrementDownloadCount = function(filename) {
  const file = this.files.find(f => f.filename === filename);
  if (file) {
    file.downloadCount += 1;
    file.lastDownloaded = new Date();
    return this.save();
  }
  return Promise.resolve();
};

complianceReportSchema.methods.markExpired = function() {
  this.status = 'expired';
  return this.save();
};

complianceReportSchema.methods.generateSignature = function() {
  const crypto = require('crypto');
  const data = {
    reportId: this.reportId,
    tenantId: this.tenantId,
    reportType: this.reportType,
    createdAt: this.createdAt,
    results: this.results
  };
  
  this.signature = crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
  
  this.signedAt = new Date();
  return this.signature;
};

// Static methods
complianceReportSchema.statics.createGDPRExport = function(tenantId, userId, parameters) {
  return new this({
    tenantId,
    reportType: 'gdpr_data_export',
    complianceFramework: 'gdpr',
    parameters: {
      ...parameters,
      includePersonalData: true,
      anonymizeData: false
    },
    createdBy: userId,
    legalBasis: 'GDPR Article 20 - Right to data portability'
  });
};

complianceReportSchema.statics.createAuditTrail = function(tenantId, userId, parameters) {
  return new this({
    tenantId,
    reportType: 'audit_trail',
    complianceFramework: parameters.framework || 'iso27001',
    parameters: {
      ...parameters,
      includePersonalData: false,
      anonymizeData: true
    },
    createdBy: userId
  });
};

complianceReportSchema.statics.findPending = function() {
  return this.find({ 
    status: 'pending',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
  });
};

complianceReportSchema.statics.findExpired = function() {
  return this.find({ 
    status: { $in: ['completed', 'failed'] },
    createdAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Older than 7 days
  });
};

module.exports = mongoose.model('ComplianceReport', complianceReportSchema);