const { Kafka } = require('kafkajs');
const logger = require('./logger');

class KafkaProducer {
  constructor() {
    this.kafka = new Kafka({
      clientId: 'audit-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });

    this.connected = false;
    this.connecting = false;
  }

  async connect() {
    if (this.connected || this.connecting) {
      return;
    }

    try {
      this.connecting = true;
      await this.producer.connect();
      this.connected = true;
      this.connecting = false;
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      this.connecting = false;
      logger.error('Failed to connect Kafka producer', error);
      throw error;
    }
  }

  async disconnect() {
    if (!this.connected) {
      return;
    }

    try {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka producer', error);
    }
  }

  async publishAuditEvent(auditEvent) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        key: auditEvent.eventId,
        value: JSON.stringify({
          ...auditEvent.toObject(),
          publishedAt: new Date().toISOString()
        }),
        partition: this.getPartition(auditEvent.tenantId),
        headers: {
          eventType: auditEvent.eventType,
          tenantId: auditEvent.tenantId.toString(),
          category: auditEvent.category,
          severity: auditEvent.severity
        }
      };

      const result = await this.producer.send({
        topic: 'audit-events',
        messages: [message]
      });

      logger.info('Audit event published to Kafka', {
        eventId: auditEvent.eventId,
        topic: 'audit-events',
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish audit event to Kafka', {
        eventId: auditEvent.eventId,
        error: error.message
      });
      throw error;
    }
  }

  async publishComplianceEvent(event) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        key: event.id || event.eventId,
        value: JSON.stringify({
          ...event,
          publishedAt: new Date().toISOString()
        }),
        headers: {
          eventType: 'compliance',
          tenantId: event.tenantId?.toString() || 'system',
          complianceType: event.complianceType || 'general'
        }
      };

      const result = await this.producer.send({
        topic: 'compliance-events',
        messages: [message]
      });

      logger.info('Compliance event published to Kafka', {
        eventId: event.id || event.eventId,
        topic: 'compliance-events',
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish compliance event to Kafka', {
        eventId: event.id || event.eventId,
        error: error.message
      });
      throw error;
    }
  }

  async publishSecurityEvent(event) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        key: event.eventId || event.id,
        value: JSON.stringify({
          ...event,
          publishedAt: new Date().toISOString()
        }),
        headers: {
          eventType: 'security',
          tenantId: event.tenantId?.toString() || 'system',
          severity: event.severity || 'medium',
          alertRequired: event.alertRequired ? 'true' : 'false'
        }
      };

      const result = await this.producer.send({
        topic: 'security-events',
        messages: [message]
      });

      logger.info('Security event published to Kafka', {
        eventId: event.eventId || event.id,
        topic: 'security-events',
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish security event to Kafka', {
        eventId: event.eventId || event.id,
        error: error.message
      });
      throw error;
    }
  }

  async publishUserActivityEvent(event) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        key: event.userId,
        value: JSON.stringify({
          ...event,
          publishedAt: new Date().toISOString()
        }),
        partition: this.getPartition(event.tenantId),
        headers: {
          eventType: 'user-activity',
          tenantId: event.tenantId?.toString() || 'system',
          userId: event.userId?.toString() || 'anonymous',
          activity: event.activity || 'unknown'
        }
      };

      const result = await this.producer.send({
        topic: 'user-activity',
        messages: [message]
      });

      logger.debug('User activity event published to Kafka', {
        userId: event.userId,
        activity: event.activity,
        topic: 'user-activity',
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish user activity event to Kafka', {
        userId: event.userId,
        activity: event.activity,
        error: error.message
      });
      throw error;
    }
  }

  async publishSystemEvent(event) {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const message = {
        key: event.service || 'system',
        value: JSON.stringify({
          ...event,
          publishedAt: new Date().toISOString()
        }),
        headers: {
          eventType: 'system',
          service: event.service || 'unknown',
          severity: event.severity || 'info',
          component: event.component || 'system'
        }
      };

      const result = await this.producer.send({
        topic: 'system-events',
        messages: [message]
      });

      logger.info('System event published to Kafka', {
        service: event.service,
        component: event.component,
        topic: 'system-events',
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish system event to Kafka', {
        service: event.service,
        component: event.component,
        error: error.message
      });
      throw error;
    }
  }

  // Partition events by tenant for better parallelism
  getPartition(tenantId) {
    if (!tenantId) return 0;
    
    // Simple hash function to distribute tenants across partitions
    const hash = tenantId.toString().split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a; // Convert to 32-bit integer
    }, 0);
    
    return Math.abs(hash) % 3; // Assuming 3 partitions per topic
  }

  async sendBatch(messages, topic = 'audit-events') {
    try {
      if (!this.connected) {
        await this.connect();
      }

      const kafkaMessages = messages.map(msg => ({
        key: msg.key || msg.eventId || msg.id,
        value: JSON.stringify({
          ...msg,
          publishedAt: new Date().toISOString()
        }),
        partition: msg.tenantId ? this.getPartition(msg.tenantId) : 0,
        headers: msg.headers || {}
      }));

      const result = await this.producer.send({
        topic,
        messages: kafkaMessages
      });

      logger.info(`Batch of ${messages.length} messages published to Kafka`, {
        topic,
        messageCount: messages.length,
        partitions: result.map(r => r.partition)
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish batch to Kafka', {
        topic,
        messageCount: messages.length,
        error: error.message
      });
      throw error;
    }
  }

  // Health check method
  async healthCheck() {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const metadata = await admin.fetchTopicMetadata();
      await admin.disconnect();
      
      return {
        status: 'healthy',
        connected: this.connected,
        topics: metadata.topics.length,
        brokers: metadata.brokers.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: this.connected,
        error: error.message
      };
    }
  }
}

// Singleton instance
let kafkaProducer = null;

const getKafkaProducer = () => {
  if (!kafkaProducer) {
    kafkaProducer = new KafkaProducer();
  }
  return kafkaProducer;
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
  }
});

process.on('SIGINT', async () => {
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
  }
});

module.exports = {
  KafkaProducer,
  getKafkaProducer
};