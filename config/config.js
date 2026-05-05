const path = require('path');
const winston = require('winston');

// Logger for configuration
const configLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.config = this.loadConfig();
    this.validateConfig();
  }

  loadConfig() {
    const baseConfig = {
      // Environment
      nodeEnv: this.env,
      
      // Server Configuration
      server: {
        port: parseInt(process.env.PORT) || 3001,
        host: process.env.HOST || '0.0.0.0',
        cors: {
          origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
          credentials: true
        },
        rateLimit: {
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
        },
        bodyLimit: process.env.BODY_LIMIT || '10mb'
      },

      // Database Configuration
      database: {
        mongodb: {
          uri: process.env.MONGO_URI || 'mongodb://localhost:27017/asset_tracker',
          options: {
            maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE) || 10,
            serverSelectionTimeoutMS: parseInt(process.env.MONGO_TIMEOUT) || 5000,
            socketTimeoutMS: 45000,
            family: 4,
            tls: process.env.MONGO_TLS === 'true'
          }
        },
        redis: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
          password: process.env.REDIS_PASSWORD,
          maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
          retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100
        }
      },

      // Security Configuration
      security: {
        jwt: {
          secret: process.env.JWT_SECRET,
          expiresIn: process.env.JWT_EXPIRY || '15m',
          refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
          issuer: process.env.JWT_ISSUER || 'asset-tracker',
          audience: process.env.JWT_AUDIENCE || 'asset-tracker-users'
        },
        session: {
          secret: process.env.SESSION_SECRET,
          maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000,
          secure: this.env === 'production',
          httpOnly: true,
          sameSite: 'strict'
        },
        encryption: {
          algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
          key: process.env.ENCRYPTION_KEY
        },
        bcrypt: {
          saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
        }
      },

      // Multi-tenancy Configuration
      multiTenancy: {
        enabled: process.env.ENABLE_MULTI_TENANCY === 'true',
        defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
        isolationLevel: process.env.TENANT_ISOLATION_LEVEL || 'strict'
      },

      // Notification Services
      notifications: {
        email: {
          enabled: !!process.env.SMTP_HOST,
          smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: {
            name: process.env.SMTP_FROM_NAME || 'Asset Tracker',
            email: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
          }
        },
        sms: {
          enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
          twilio: {
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            fromNumber: process.env.TWILIO_FROM_NUMBER
          }
        },
        push: {
          enabled: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
          firebase: {
            serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY
          }
        }
      },

      // File Storage
      storage: {
        type: process.env.STORAGE_TYPE || 'local',
        local: {
          uploadPath: process.env.UPLOAD_PATH || './uploads',
          maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
          allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(',')
        },
        s3: {
          bucket: process.env.AWS_S3_BUCKET,
          region: process.env.AWS_S3_REGION || 'us-east-1',
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      },

      // External Services
      external: {
        elasticsearch: {
          enabled: !!process.env.ELASTICSEARCH_URL,
          url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
          index: process.env.ELASTICSEARCH_INDEX || 'asset-tracker'
        },
        kafka: {
          enabled: !!process.env.KAFKA_BROKER,
          brokers: process.env.KAFKA_BROKER?.split(',') || ['localhost:9092'],
          clientId: process.env.KAFKA_CLIENT_ID || 'asset-tracker',
          groupId: process.env.KAFKA_GROUP_ID || 'asset-tracker-group'
        }
      },

      // Logging Configuration
      logging: {
        level: process.env.LOG_LEVEL || (this.env === 'production' ? 'info' : 'debug'),
        format: process.env.LOG_FORMAT || 'json',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        directory: process.env.LOG_DIRECTORY || './logs'
      },

      // Monitoring Configuration
      monitoring: {
        prometheus: {
          enabled: process.env.PROMETHEUS_METRICS_ENABLED === 'true',
          port: parseInt(process.env.PROMETHEUS_PORT) || 9090,
          path: process.env.PROMETHEUS_PATH || '/metrics'
        },
        health: {
          endpoint: process.env.HEALTH_ENDPOINT || '/health',
          detailed: process.env.HEALTH_DETAILED === 'true'
        }
      },

      // Feature Flags
      features: {
        audit: process.env.FEATURE_AUDIT_ENABLED !== 'false',
        analytics: process.env.FEATURE_ANALYTICS_ENABLED !== 'false',
        mlPrediction: process.env.FEATURE_ML_PREDICTION_ENABLED === 'true',
        realTimeUpdates: process.env.FEATURE_REAL_TIME_UPDATES_ENABLED !== 'false',
        advancedReporting: process.env.FEATURE_ADVANCED_REPORTING_ENABLED === 'true'
      },

      // Performance Configuration
      performance: {
        caching: {
          enabled: process.env.CACHING_ENABLED !== 'false',
          defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL) || 300, // 5 minutes
          maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000
        },
        compression: {
          enabled: process.env.COMPRESSION_ENABLED !== 'false',
          level: parseInt(process.env.COMPRESSION_LEVEL) || 6
        },
        pagination: {
          defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 20,
          maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT) || 100
        }
      }
    };

    // Environment-specific overrides
    const envConfigPath = path.join(__dirname, 'environments', this.env, 'index.js');
    try {
      const envConfig = require(envConfigPath);
      return this.deepMerge(baseConfig, envConfig);
    } catch (error) {
      configLogger.warn(`No environment config found for ${this.env}, using base config`);
      return baseConfig;
    }
  }

  validateConfig() {
    const requiredEnvVars = [
      'JWT_SECRET',
      'MONGO_URI'
    ];

    const productionRequiredVars = [
      'SESSION_SECRET',
      'ENCRYPTION_KEY'
    ];

    const missing = [];

    // Check required variables
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missing.push(envVar);
      }
    });

    // Check production-specific variables
    if (this.env === 'production') {
      productionRequiredVars.forEach(envVar => {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      });
    }

    if (missing.length > 0) {
      const errorMessage = `Missing required environment variables: ${missing.join(', ')}`;
      configLogger.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Validate specific configurations
    this.validateJWTConfig();
    this.validateDatabaseConfig();
    this.validateSecurityConfig();

    configLogger.info('Configuration validation passed', {
      environment: this.env,
      features: Object.keys(this.config.features).filter(key => this.config.features[key])
    });
  }

  validateJWTConfig() {
    const { secret } = this.config.security.jwt;
    if (secret && secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  validateDatabaseConfig() {
    const { uri } = this.config.database.mongodb;
    if (!uri || !uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      throw new Error('MONGO_URI must be a valid MongoDB connection string');
    }
  }

  validateSecurityConfig() {
    if (this.env === 'production') {
      if (!this.config.security.session.secure) {
        configLogger.warn('Session secure flag should be true in production');
      }
      
      if (this.config.server.cors.origins.includes('*')) {
        throw new Error('Wildcard CORS origins not allowed in production');
      }
    }
  }

  deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  getConfig() {
    return this.config;
  }

  isDevelopment() {
    return this.env === 'development';
  }

  isProduction() {
    return this.env === 'production';
  }

  isTest() {
    return this.env === 'test';
  }

  // Get service-specific configuration
  getDatabaseConfig() {
    return this.config.database;
  }

  getSecurityConfig() {
    return this.config.security;
  }

  getNotificationConfig() {
    return this.config.notifications;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  // Feature flag helpers
  isFeatureEnabled(featureName) {
    return this.config.features[featureName] === true;
  }

  // Configuration reload (for development)
  reload() {
    if (this.isDevelopment()) {
      // Clear require cache for environment configs
      const envConfigPath = path.join(__dirname, 'environments', this.env, 'index.js');
      delete require.cache[require.resolve(envConfigPath)];
      
      this.config = this.loadConfig();
      this.validateConfig();
      
      configLogger.info('Configuration reloaded');
    } else {
      configLogger.warn('Configuration reload is only allowed in development mode');
    }
  }
}

// Export singleton instance
const configManager = new ConfigManager();

module.exports = configManager;