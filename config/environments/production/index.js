module.exports = {
  environment: 'production',
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 100,
      minPoolSize: 10
    }
  },
  redis: {
    cluster: true,
    nodes: (process.env.REDIS_CLUSTER_NODES || '').split(',').map(node => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port) || 6379 };
    }),
    password: process.env.REDIS_PASSWORD
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m',
    refreshExpiresIn: '7d'
  },
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION,
    cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE,
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    }
  },
  kafka: {
    brokers: process.env.KAFKA_BROKERS.split(','),
    clientId: 'asset-tracker-prod',
    ssl: true,
    sasl: {
      mechanism: 'plain',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD
    }
  },
  logging: {
    level: 'error',
    format: 'json'
  },
  security: {
    rateLimiting: {
      windowMs: 60 * 1000,
      max: 1000
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || []
    }
  }
};