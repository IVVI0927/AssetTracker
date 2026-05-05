module.exports = {
  server: {
    port: parseInt(process.env.PORT) || 3001,
    cors: {
      origins: process.env.ALLOWED_ORIGINS?.split(',') || [],
      credentials: true
    },
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 1000    // Higher limit for production
    }
  },

  database: {
    mongodb: {
      options: {
        maxPoolSize: 100,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4,
        tls: true,
        retryWrites: true,
        w: 'majority',
        readPreference: 'primary',
        readConcern: { level: 'majority' }
      }
    },
    redis: {
      cluster: true,
      nodes: (process.env.REDIS_CLUSTER_NODES || '').split(',').map(node => {
        const [host, port] = node.split(':');
        return { host, port: parseInt(port) || 6379 };
      }),
      password: process.env.REDIS_PASSWORD,
      maxRetries: 5,
      retryDelayOnFailover: 200,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    }
  },

  security: {
    jwt: {
      expiresIn: '15m',
      refreshExpiresIn: '7d'
    },
    session: {
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 12 * 60 * 60 * 1000 // 12 hours
    },
    bcrypt: {
      saltRounds: 14
    }
  },

  storage: {
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN
    }
  },

  external: {
    elasticsearch: {
      url: process.env.ELASTICSEARCH_NODE,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      },
      ssl: {
        rejectUnauthorized: true
      },
      requestTimeout: 30000,
      maxRetries: 3
    },
    kafka: {
      brokers: process.env.KAFKA_BROKERS?.split(',') || [],
      clientId: 'asset-tracker-prod',
      ssl: true,
      sasl: {
        mechanism: 'plain',
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD
      },
      connectionTimeout: 3000,
      requestTimeout: 30000,
      enforceRequestTimeout: true,
      retry: {
        initialRetryTime: 300,
        retries: 10
      }
    }
  },

  logging: {
    level: 'warn',
    format: 'json',
    maxFiles: 10,
    maxSize: '20m',
    compress: true,
    datePattern: 'YYYY-MM-DD',
    transports: [
      {
        type: 'file',
        filename: 'error.log',
        level: 'error'
      },
      {
        type: 'file',
        filename: 'combined.log'
      },
      {
        type: 'file',
        filename: 'audit.log',
        level: 'info',
        audit: true
      }
    ]
  },

  monitoring: {
    prometheus: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      collectDefaultMetrics: true,
      timeout: 10000
    },
    health: {
      detailed: false,
      timeout: 5000
    },
    apm: {
      enabled: process.env.APM_ENABLED === 'true',
      serviceName: 'asset-tracker',
      environment: 'production'
    }
  },

  performance: {
    caching: {
      enabled: true,
      defaultTtl: 600, // 10 minutes
      maxSize: 10000,
      compression: true
    },
    compression: {
      enabled: true,
      level: 9,
      threshold: 1024
    },
    clustering: {
      enabled: process.env.CLUSTER_ENABLED === 'true',
      workers: parseInt(process.env.CLUSTER_WORKERS) || require('os').cpus().length
    }
  },

  features: {
    audit: true,
    analytics: true,
    mlPrediction: process.env.FEATURE_ML_PREDICTION_ENABLED === 'true',
    realTimeUpdates: true,
    advancedReporting: true,
    maintenance: true
  },

  // Production-specific settings
  production: {
    trustProxy: true,
    gracefulShutdownTimeout: 30000,
    healthCheckInterval: 30000,
    memoryThreshold: 0.9,
    cpuThreshold: 0.8
  }
};