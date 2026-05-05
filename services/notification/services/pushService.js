const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/push.log' })
  ]
});

class PushService {
  constructor() {
    this.admin = null;
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        logger.warn('Push service not configured - Firebase service account key missing');
        return;
      }

      const admin = require('firebase-admin');
      
      // Parse service account key from environment variable
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
      }
      
      this.admin = admin;
      this.isInitialized = true;
      
      logger.info('Push notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize push notification service', { error: error.message });
    }
  }

  isConfigured() {
    return this.isInitialized && this.admin;
  }

  async sendPushNotification({ token, title, body, data, imageUrl, templateId, templateData }) {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      let processedTitle = title;
      let processedBody = body;

      // Apply template if provided
      if (templateId && templateData) {
        const template = await this.getTemplate(templateId);
        processedTitle = this.processTemplate(template.title, templateData);
        processedBody = this.processTemplate(template.body, templateData);
      }

      const message = {
        token,
        notification: {
          title: processedTitle,
          body: processedBody,
          imageUrl: imageUrl || undefined
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          source: 'asset-tracker'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'asset_tracker_notifications',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1
            }
          }
        },
        webpush: {
          notification: {
            title: processedTitle,
            body: processedBody,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: imageUrl || undefined,
            requireInteraction: data?.priority === 'high'
          },
          fcmOptions: {
            link: data?.actionUrl || '/'
          }
        }
      };

      const result = await this.admin.messaging().send(message);

      logger.info('Push notification sent successfully', {
        token: token.substring(0, 20) + '...',
        title: processedTitle,
        messageId: result
      });

      return {
        success: true,
        messageId: result
      };

    } catch (error) {
      logger.error('Failed to send push notification', {
        error: error.message,
        token: token?.substring(0, 20) + '...',
        title
      });

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendMulticastNotification({ tokens, title, body, data, imageUrl, templateId, templateData }) {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      let processedTitle = title;
      let processedBody = body;

      // Apply template if provided
      if (templateId && templateData) {
        const template = await this.getTemplate(templateId);
        processedTitle = this.processTemplate(template.title, templateData);
        processedBody = this.processTemplate(template.body, templateData);
      }

      const message = {
        tokens,
        notification: {
          title: processedTitle,
          body: processedBody,
          imageUrl: imageUrl || undefined
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          source: 'asset-tracker'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'asset_tracker_notifications',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1
            }
          }
        },
        webpush: {
          notification: {
            title: processedTitle,
            body: processedBody,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: imageUrl || undefined,
            requireInteraction: data?.priority === 'high'
          },
          fcmOptions: {
            link: data?.actionUrl || '/'
          }
        }
      };

      const result = await this.admin.messaging().sendEachForMulticast(message);

      const successful = result.successCount;
      const failed = result.failureCount;

      logger.info('Multicast push notification completed', {
        total: tokens.length,
        successful,
        failed,
        title: processedTitle
      });

      // Log individual failures
      if (result.responses) {
        result.responses.forEach((response, index) => {
          if (!response.success) {
            logger.warn('Push notification failed for token', {
              tokenIndex: index,
              error: response.error?.message,
              errorCode: response.error?.code
            });
          }
        });
      }

      return {
        success: true,
        total: tokens.length,
        successful,
        failed,
        responses: result.responses,
        multicastId: result.multicastId
      };

    } catch (error) {
      logger.error('Failed to send multicast push notification', {
        error: error.message,
        tokenCount: tokens?.length,
        title
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendToTopic({ topic, title, body, data, imageUrl, templateId, templateData }) {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      let processedTitle = title;
      let processedBody = body;

      // Apply template if provided
      if (templateId && templateData) {
        const template = await this.getTemplate(templateId);
        processedTitle = this.processTemplate(template.title, templateData);
        processedBody = this.processTemplate(template.body, templateData);
      }

      const message = {
        topic,
        notification: {
          title: processedTitle,
          body: processedBody,
          imageUrl: imageUrl || undefined
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          source: 'asset-tracker'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'asset_tracker_notifications',
            priority: 'high'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1
            }
          }
        },
        webpush: {
          notification: {
            title: processedTitle,
            body: processedBody,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: imageUrl || undefined
          },
          fcmOptions: {
            link: data?.actionUrl || '/'
          }
        }
      };

      const result = await this.admin.messaging().send(message);

      logger.info('Topic push notification sent successfully', {
        topic,
        title: processedTitle,
        messageId: result
      });

      return {
        success: true,
        messageId: result
      };

    } catch (error) {
      logger.error('Failed to send topic push notification', {
        error: error.message,
        topic,
        title
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async subscribeToTopic(tokens, topic) {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const result = await this.admin.messaging().subscribeToTopic(tokensArray, topic);

      logger.info('Tokens subscribed to topic', {
        topic,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors
      };

    } catch (error) {
      logger.error('Failed to subscribe to topic', {
        error: error.message,
        topic,
        tokenCount: Array.isArray(tokens) ? tokens.length : 1
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async unsubscribeFromTopic(tokens, topic) {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      const tokensArray = Array.isArray(tokens) ? tokens : [tokens];
      const result = await this.admin.messaging().unsubscribeFromTopic(tokensArray, topic);

      logger.info('Tokens unsubscribed from topic', {
        topic,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return {
        success: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors
      };

    } catch (error) {
      logger.error('Failed to unsubscribe from topic', {
        error: error.message,
        topic,
        tokenCount: Array.isArray(tokens) ? tokens.length : 1
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTemplate(templateId) {
    const defaultTemplates = {
      'asset-alert': {
        title: '⚠️ Asset Alert: {{assetName}}',
        body: '{{message}}'
      },
      'maintenance-reminder': {
        title: '🔧 Maintenance Due: {{assetName}}',
        body: 'Maintenance scheduled for {{dueDate}}. {{message}}'
      },
      'assignment-notification': {
        title: '📋 New Asset Assignment',
        body: '{{assetName}} has been assigned to you. Check your dashboard for details.'
      },
      'location-update': {
        title: '📍 Location Updated',
        body: '{{assetName}} moved to {{location}}'
      },
      'system-alert': {
        title: '🔔 System Notification',
        body: '{{message}}'
      }
    };

    return defaultTemplates[templateId] || {
      title: 'Asset Tracker Notification',
      body: '{{message}}'
    };
  }

  processTemplate(template, data) {
    let processed = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });

    return processed;
  }

  async verifyConnection() {
    if (!this.isConfigured()) {
      throw new Error('Push notification service not configured');
    }

    try {
      // Try to get the Firebase project to verify connection
      const app = this.admin.app();
      return { 
        success: true, 
        message: 'Push notification service connection verified',
        projectId: app.options.projectId
      };
    } catch (error) {
      logger.error('Push notification service connection failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PushService();