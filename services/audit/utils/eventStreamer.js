const { getKafkaProducer } = require('./kafkaProducer');
const logger = require('./logger');

class EventStreamer {
  constructor() {
    this.kafkaProducer = getKafkaProducer();
    this.retryQueue = [];
    this.isProcessingRetries = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async streamAuditEvent(auditEvent) {
    try {
      // Stream to Kafka
      await this.kafkaProducer.publishAuditEvent(auditEvent);
      
      // Stream to real-time consumers (WebSocket, SSE, etc.)
      await this.streamToRealTimeClients(auditEvent);
      
      // Stream to analytics pipeline
      await this.streamToAnalytics(auditEvent);
      
      logger.debug('Audit event streamed successfully', {
        eventId: auditEvent.eventId,
        eventType: auditEvent.eventType
      });
    } catch (error) {
      logger.error('Failed to stream audit event', {
        eventId: auditEvent.eventId,
        error: error.message
      });
      
      // Add to retry queue
      this.addToRetryQueue({
        type: 'audit',
        data: auditEvent,
        attempts: 0,
        timestamp: new Date()
      });
    }
  }

  async streamSecurityEvent(event) {
    try {
      // Security events get higher priority
      await this.kafkaProducer.publishSecurityEvent(event);
      
      // Immediate notification for critical security events
      if (event.severity === 'critical' || event.severity === 'high') {
        await this.triggerSecurityAlert(event);
      }
      
      // Stream to SIEM systems
      await this.streamToSIEM(event);
      
      logger.info('Security event streamed successfully', {
        eventId: event.eventId,
        severity: event.severity
      });
    } catch (error) {
      logger.error('Failed to stream security event', {
        eventId: event.eventId,
        error: error.message
      });
      
      this.addToRetryQueue({
        type: 'security',
        data: event,
        attempts: 0,
        timestamp: new Date(),
        priority: 'high'
      });
    }
  }

  async streamUserActivity(event) {
    try {
      await this.kafkaProducer.publishUserActivityEvent(event);
      
      // Stream to real-time dashboard
      await this.updateUserActivityDashboard(event);
      
      logger.debug('User activity event streamed', {
        userId: event.userId,
        activity: event.activity
      });
    } catch (error) {
      logger.error('Failed to stream user activity', {
        userId: event.userId,
        error: error.message
      });
      
      this.addToRetryQueue({
        type: 'user-activity',
        data: event,
        attempts: 0,
        timestamp: new Date()
      });
    }
  }

  async streamComplianceEvent(event) {
    try {
      await this.kafkaProducer.publishComplianceEvent(event);
      
      // Stream to compliance monitoring systems
      await this.streamToComplianceSystem(event);
      
      logger.info('Compliance event streamed successfully', {
        eventId: event.eventId,
        complianceType: event.complianceType
      });
    } catch (error) {
      logger.error('Failed to stream compliance event', {
        eventId: event.eventId,
        error: error.message
      });
      
      this.addToRetryQueue({
        type: 'compliance',
        data: event,
        attempts: 0,
        timestamp: new Date(),
        priority: 'high'
      });
    }
  }

  async streamSystemEvent(event) {
    try {
      await this.kafkaProducer.publishSystemEvent(event);
      
      // Stream to monitoring systems
      await this.streamToMonitoring(event);
      
      logger.debug('System event streamed successfully', {
        service: event.service,
        component: event.component
      });
    } catch (error) {
      logger.error('Failed to stream system event', {
        service: event.service,
        error: error.message
      });
      
      this.addToRetryQueue({
        type: 'system',
        data: event,
        attempts: 0,
        timestamp: new Date()
      });
    }
  }

  // Real-time streaming methods
  async streamToRealTimeClients(event) {
    // Implementation would depend on your real-time infrastructure
    // This could be WebSocket, Server-Sent Events, or other real-time solutions
    
    try {
      // Example: Publish to Redis for real-time subscribers
      const redis = require('../utils/redis');
      const channel = `audit:${event.tenantId}`;
      
      await redis.publish(channel, JSON.stringify({
        type: 'audit-event',
        data: event,
        timestamp: new Date().toISOString()
      }));
      
      // Also publish to general audit channel
      await redis.publish('audit:all', JSON.stringify({
        type: 'audit-event',
        data: {
          eventId: event.eventId,
          eventType: event.eventType,
          tenantId: event.tenantId,
          severity: event.severity,
          timestamp: event.timestamp
        }
      }));
      
    } catch (error) {
      logger.warn('Failed to stream to real-time clients', error);
    }
  }

  async streamToAnalytics(event) {
    try {
      // Stream to analytics pipeline (could be Elasticsearch, ClickHouse, etc.)
      const analyticsPayload = {
        eventId: event.eventId,
        eventType: event.eventType,
        category: event.category,
        tenantId: event.tenantId,
        timestamp: event.timestamp,
        actorType: event.actor?.type,
        actorId: event.actor?.id,
        resourceType: event.resource?.type,
        resourceId: event.resource?.id,
        action: event.action,
        severity: event.severity,
        // Metadata for analytics
        hour: new Date(event.timestamp).getHours(),
        dayOfWeek: new Date(event.timestamp).getDay(),
        month: new Date(event.timestamp).getMonth() + 1
      };
      
      // Send to analytics queue
      const redis = require('../utils/redis');
      await redis.lpush('analytics:queue', JSON.stringify(analyticsPayload));
      
    } catch (error) {
      logger.warn('Failed to stream to analytics', error);
    }
  }

  async triggerSecurityAlert(event) {
    try {
      // Send immediate notifications for critical security events
      const alertPayload = {
        alertId: `security-${event.eventId}`,
        type: 'security-alert',
        severity: event.severity,
        title: `Security Event: ${event.eventType}`,
        description: event.description,
        tenantId: event.tenantId,
        actor: event.actor,
        timestamp: event.timestamp,
        requiresImmedateAction: event.severity === 'critical'
      };
      
      // Send to notification service
      const redis = require('../utils/redis');
      await redis.lpush('notifications:security', JSON.stringify(alertPayload));
      
      // Log critical security events
      logger.warn('Critical security event triggered alert', {
        eventId: event.eventId,
        severity: event.severity,
        tenantId: event.tenantId
      });
      
    } catch (error) {
      logger.error('Failed to trigger security alert', error);
    }
  }

  async streamToSIEM(event) {
    try {
      // Format for SIEM consumption (Splunk, ELK, etc.)
      const siemEvent = {
        timestamp: event.timestamp,
        source: 'asset-tracker-audit',
        eventType: event.eventType,
        severity: event.severity,
        tenantId: event.tenantId,
        actor: event.actor,
        resource: event.resource,
        action: event.action,
        description: event.description,
        metadata: event.metadata,
        hash: event.hash // For integrity verification
      };
      
      // Send to SIEM queue
      const redis = require('../utils/redis');
      await redis.lpush('siem:queue', JSON.stringify(siemEvent));
      
    } catch (error) {
      logger.warn('Failed to stream to SIEM', error);
    }
  }

  async streamToComplianceSystem(event) {
    try {
      // Format for compliance monitoring
      const compliancePayload = {
        eventId: event.eventId,
        complianceType: event.complianceType,
        tenantId: event.tenantId,
        timestamp: event.timestamp,
        dataSubject: event.dataSubject,
        action: event.action,
        legalBasis: event.legalBasis,
        retentionPeriod: event.retentionPeriod
      };
      
      // Send to compliance queue
      const redis = require('../utils/redis');
      await redis.lpush('compliance:queue', JSON.stringify(compliancePayload));
      
    } catch (error) {
      logger.warn('Failed to stream to compliance system', error);
    }
  }

  async streamToMonitoring(event) {
    try {
      // Format for monitoring systems (Prometheus, Grafana, etc.)
      const monitoringPayload = {
        service: event.service,
        component: event.component,
        severity: event.severity,
        message: event.message,
        timestamp: event.timestamp,
        metadata: event.metadata
      };
      
      // Send to monitoring queue
      const redis = require('../utils/redis');
      await redis.lpush('monitoring:queue', JSON.stringify(monitoringPayload));
      
    } catch (error) {
      logger.warn('Failed to stream to monitoring', error);
    }
  }

  async updateUserActivityDashboard(event) {
    try {
      // Update real-time user activity metrics
      const redis = require('../utils/redis');
      const key = `activity:${event.tenantId}:${event.userId}`;
      
      // Store recent activity
      await redis.lpush(key, JSON.stringify({
        activity: event.activity,
        timestamp: event.timestamp,
        ip: event.ip,
        userAgent: event.userAgent
      }));
      
      // Keep only last 100 activities per user
      await redis.ltrim(key, 0, 99);
      
      // Update activity counters
      const today = new Date().toISOString().split('T')[0];
      await redis.incr(`activity:count:${event.tenantId}:${today}`);
      
    } catch (error) {
      logger.warn('Failed to update user activity dashboard', error);
    }
  }

  // Retry mechanism
  addToRetryQueue(item) {
    this.retryQueue.push(item);
    
    if (!this.isProcessingRetries) {
      this.processRetryQueue();
    }
  }

  async processRetryQueue() {
    this.isProcessingRetries = true;
    
    while (this.retryQueue.length > 0) {
      const item = this.retryQueue.shift();
      
      if (item.attempts >= this.maxRetries) {
        logger.error('Max retries exceeded for event', {
          type: item.type,
          eventId: item.data.eventId || item.data.id,
          attempts: item.attempts
        });
        continue;
      }
      
      try {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        
        switch (item.type) {
          case 'audit':
            await this.kafkaProducer.publishAuditEvent(item.data);
            break;
          case 'security':
            await this.kafkaProducer.publishSecurityEvent(item.data);
            break;
          case 'user-activity':
            await this.kafkaProducer.publishUserActivityEvent(item.data);
            break;
          case 'compliance':
            await this.kafkaProducer.publishComplianceEvent(item.data);
            break;
          case 'system':
            await this.kafkaProducer.publishSystemEvent(item.data);
            break;
        }
        
        logger.info('Retry successful for event', {
          type: item.type,
          eventId: item.data.eventId || item.data.id,
          attempts: item.attempts + 1
        });
        
      } catch (error) {
        item.attempts++;
        this.retryQueue.push(item);
        
        logger.warn('Retry failed for event', {
          type: item.type,
          eventId: item.data.eventId || item.data.id,
          attempts: item.attempts,
          error: error.message
        });
      }
    }
    
    this.isProcessingRetries = false;
  }

  // Health check
  async healthCheck() {
    try {
      const kafkaHealth = await this.kafkaProducer.healthCheck();
      
      return {
        status: kafkaHealth.status === 'healthy' ? 'healthy' : 'degraded',
        kafka: kafkaHealth,
        retryQueue: {
          length: this.retryQueue.length,
          processing: this.isProcessingRetries
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EventStreamer();