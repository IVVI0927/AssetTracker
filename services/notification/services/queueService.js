const winston = require('winston');
const emailService = require('./emailService');
const smsService = require('./smsService');
const pushService = require('./pushService');
const Notification = require('../models/Notification');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/queue.log' })
  ]
});

class NotificationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelay = 60000; // 1 minute
    this.maxConcurrent = 5;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // In a production environment, you'd use Redis with Bull Queue or similar
      // For now, we'll use an in-memory queue with basic functionality
      this.startProcessor();
      this.isInitialized = true;
      logger.info('Notification queue initialized');
    } catch (error) {
      logger.error('Failed to initialize notification queue', { error: error.message });
      throw error;
    }
  }

  async addJob(type, data, options = {}) {
    const job = {
      id: this.generateJobId(),
      type,
      data,
      options: {
        priority: options.priority || 5,
        delay: options.delay || 0,
        maxRetries: options.maxRetries || this.maxRetries,
        ...options
      },
      attempts: 0,
      status: 'pending',
      createdAt: new Date(),
      scheduledFor: new Date(Date.now() + (options.delay || 0))
    };

    // Insert job in priority order
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].options.priority < job.options.priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, job);

    logger.info('Job added to queue', {
      jobId: job.id,
      type: job.type,
      priority: job.options.priority,
      delay: job.options.delay,
      queueLength: this.queue.length
    });

    return job.id;
  }

  startProcessor() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    this.processJobs();
  }

  async processJobs() {
    while (this.processing) {
      try {
        const readyJobs = this.queue.filter(job => 
          job.status === 'pending' && 
          new Date() >= job.scheduledFor
        ).slice(0, this.maxConcurrent);

        if (readyJobs.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        const processingPromises = readyJobs.map(job => this.processJob(job));
        await Promise.allSettled(processingPromises);

      } catch (error) {
        logger.error('Error in job processor', { error: error.message });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async processJob(job) {
    try {
      job.status = 'processing';
      job.attempts++;
      job.startedAt = new Date();

      logger.info('Processing job', {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts
      });

      let result;
      switch (job.type) {
        case 'send-notification':
          result = await this.processSendNotification(job.data);
          break;
        case 'send-email':
          result = await this.processSendEmail(job.data);
          break;
        case 'send-sms':
          result = await this.processSendSMS(job.data);
          break;
        case 'send-push':
          result = await this.processSendPush(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      if (result.success) {
        job.status = 'completed';
        job.completedAt = new Date();
        job.result = result;
        this.removeJobFromQueue(job.id);

        logger.info('Job completed successfully', {
          jobId: job.id,
          type: job.type,
          duration: job.completedAt - job.startedAt
        });
      } else {
        throw new Error(result.error || 'Job failed without error message');
      }

    } catch (error) {
      logger.error('Job processing failed', {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts,
        error: error.message
      });

      if (job.attempts >= job.options.maxRetries) {
        job.status = 'failed';
        job.failedAt = new Date();
        job.error = error.message;
        this.removeJobFromQueue(job.id);

        logger.error('Job permanently failed', {
          jobId: job.id,
          type: job.type,
          totalAttempts: job.attempts
        });
      } else {
        job.status = 'pending';
        job.scheduledFor = new Date(Date.now() + this.retryDelay * job.attempts);

        logger.info('Job scheduled for retry', {
          jobId: job.id,
          type: job.type,
          nextAttempt: job.scheduledFor,
          attempt: job.attempts + 1
        });
      }
    }
  }

  async processSendNotification(data) {
    try {
      const { recipient, type, subject, message, channels, priority, templateId, templateData, tenantId, createdBy } = data;

      // Create notification record
      const notification = new Notification({
        userId: recipient.userId || recipient.id,
        tenantId,
        type,
        subject,
        message,
        channels,
        priority,
        metadata: {
          templateId,
          templateData,
          recipient: recipient.email || recipient.phone || recipient.deviceToken
        },
        createdBy
      });

      // Save to database if available
      if (typeof notification.save === 'function') {
        await notification.save();
      }

      const results = [];

      // Send via each requested channel
      for (const channel of channels) {
        try {
          let channelResult;

          switch (channel) {
            case 'email':
              if (recipient.email && emailService.isConfigured()) {
                channelResult = await emailService.sendEmail({
                  to: recipient.email,
                  subject,
                  message,
                  templateId,
                  templateData: { 
                    userName: recipient.name || recipient.email,
                    ...templateData 
                  }
                });
              } else {
                channelResult = { success: false, error: 'Email not configured or recipient email missing' };
              }
              break;

            case 'sms':
              if (recipient.phone && smsService.isConfigured()) {
                channelResult = await smsService.sendSMS({
                  to: recipient.phone,
                  message,
                  templateId,
                  templateData
                });
              } else {
                channelResult = { success: false, error: 'SMS not configured or recipient phone missing' };
              }
              break;

            case 'push':
              if (recipient.deviceToken && pushService.isConfigured()) {
                channelResult = await pushService.sendPushNotification({
                  token: recipient.deviceToken,
                  title: subject,
                  body: message,
                  templateId,
                  templateData,
                  data: {
                    notificationId: notification._id?.toString(),
                    type,
                    priority,
                    ...templateData
                  }
                });
              } else {
                channelResult = { success: false, error: 'Push not configured or device token missing' };
              }
              break;

            case 'in-app':
              // In-app notifications are handled by saving to database
              channelResult = { success: true, method: 'database' };
              break;

            default:
              channelResult = { success: false, error: `Unknown channel: ${channel}` };
          }

          results.push({
            channel,
            success: channelResult.success,
            result: channelResult
          });

        } catch (channelError) {
          logger.error(`Channel ${channel} failed`, {
            error: channelError.message,
            recipient: recipient.id || recipient.email
          });

          results.push({
            channel,
            success: false,
            error: channelError.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      // Update notification status
      if (typeof notification.save === 'function') {
        notification.deliveryAttempts = 1;
        notification.lastAttemptAt = new Date();

        if (successful > 0) {
          notification.status = failed === 0 ? 'sent' : 'partially_sent';
          notification.sentAt = new Date();
        } else {
          notification.status = 'failed';
        }

        notification.metadata.deliveryResults = results;
        await notification.save();
      }

      logger.info('Multi-channel notification processed', {
        recipient: recipient.id || recipient.email,
        successful,
        failed,
        channels: results.map(r => ({ channel: r.channel, success: r.success }))
      });

      return {
        success: successful > 0,
        totalChannels: results.length,
        successful,
        failed,
        results,
        notificationId: notification._id?.toString()
      };

    } catch (error) {
      logger.error('Failed to process notification', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async processSendEmail(data) {
    return await emailService.sendEmail(data);
  }

  async processSendSMS(data) {
    return await smsService.sendSMS(data);
  }

  async processSendPush(data) {
    return await pushService.sendPushNotification(data);
  }

  removeJobFromQueue(jobId) {
    const index = this.queue.findIndex(job => job.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async getHealthStatus() {
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      queueLength: this.queue.length,
      processing: this.processing,
      pendingJobs: this.queue.filter(job => job.status === 'pending').length,
      processingJobs: this.queue.filter(job => job.status === 'processing').length,
      failedJobs: this.queue.filter(job => job.status === 'failed').length
    };
  }

  async getQueueStats() {
    const stats = {
      total: this.queue.length,
      pending: this.queue.filter(job => job.status === 'pending').length,
      processing: this.queue.filter(job => job.status === 'processing').length,
      completed: this.queue.filter(job => job.status === 'completed').length,
      failed: this.queue.filter(job => job.status === 'failed').length,
      byType: {}
    };

    // Count by job type
    this.queue.forEach(job => {
      stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
    });

    return stats;
  }

  async close() {
    this.processing = false;
    logger.info('Notification queue stopped');
  }
}

module.exports = NotificationQueue;