const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[a-z0-9-]+$/
  },
  description: {
    type: String,
    maxlength: 500
  },
  
  // Subscription & Billing
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'starter', 'professional', 'enterprise'],
    default: 'trial'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'suspended', 'cancelled', 'expired'],
    default: 'active'
  },
  subscriptionExpires: Date,
  billingEmail: String,
  
  // Limits and Quotas
  limits: {
    users: {
      type: Number,
      default: 5
    },
    assets: {
      type: Number,
      default: 1000
    },
    storage: {
      type: Number,
      default: 1024 * 1024 * 1024 // 1GB in bytes
    },
    apiRequests: {
      type: Number,
      default: 1000 // per hour
    }
  },
  
  // Current Usage
  usage: {
    users: {
      type: Number,
      default: 0
    },
    assets: {
      type: Number,
      default: 0
    },
    storage: {
      type: Number,
      default: 0
    }
  },
  
  // Configuration
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'YYYY-MM-DD'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    allowUserRegistration: {
      type: Boolean,
      default: false
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    },
    mfaRequired: {
      type: Boolean,
      default: false
    },
    passwordPolicy: {
      minLength: {
        type: Number,
        default: 8
      },
      requireUppercase: {
        type: Boolean,
        default: true
      },
      requireLowercase: {
        type: Boolean,
        default: true
      },
      requireNumbers: {
        type: Boolean,
        default: true
      },
      requireSpecialChars: {
        type: Boolean,
        default: true
      },
      maxAge: {
        type: Number,
        default: 90 // days
      }
    }
  },
  
  // Contact Information
  contactInfo: {
    primaryContact: {
      name: String,
      email: String,
      phone: String
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  
  // Integration Settings
  integrations: {
    sso: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: {
        type: String,
        enum: ['saml', 'oidc', 'ldap']
      },
      config: mongoose.Schema.Types.Mixed
    },
    webhook: {
      enabled: {
        type: Boolean,
        default: false
      },
      url: String,
      secret: String,
      events: [String]
    }
  },
  
  // Security
  isActive: {
    type: Boolean,
    default: true
  },
  encryptionKey: {
    type: String,
    required: true
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
tenantSchema.index({ slug: 1 });
tenantSchema.index({ subscriptionStatus: 1 });
tenantSchema.index({ subscriptionExpires: 1 });

// Pre-save middleware to generate encryption key
tenantSchema.pre('save', function(next) {
  if (!this.encryptionKey) {
    this.encryptionKey = require('crypto').randomBytes(32).toString('hex');
  }
  next();
});

// Instance methods
tenantSchema.methods.isWithinLimits = function(resource) {
  return this.usage[resource] < this.limits[resource];
};

tenantSchema.methods.incrementUsage = function(resource, amount = 1) {
  this.usage[resource] += amount;
  return this.save();
};

tenantSchema.methods.decrementUsage = function(resource, amount = 1) {
  this.usage[resource] = Math.max(0, this.usage[resource] - amount);
  return this.save();
};

tenantSchema.methods.canCreateUser = function() {
  return this.isActive && 
         this.subscriptionStatus === 'active' && 
         this.isWithinLimits('users');
};

tenantSchema.methods.canCreateAsset = function() {
  return this.isActive && 
         this.subscriptionStatus === 'active' && 
         this.isWithinLimits('assets');
};

module.exports = mongoose.model('Tenant', tenantSchema);