const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/sms.log' })
  ]
});

class SMSService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        logger.warn('SMS service not configured - Twilio credentials missing');
        return;
      }

      const twilio = require('twilio');
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      this.fromNumber = process.env.TWILIO_FROM_NUMBER;
      this.isInitialized = true;

      logger.info('SMS service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SMS service', { error: error.message });
    }
  }

  isConfigured() {
    return this.isInitialized && this.client && this.fromNumber;
  }

  async sendSMS({ to, message, templateId, templateData }) {
    if (!this.isConfigured()) {
      throw new Error('SMS service not configured');
    }

    try {
      let messageContent = message;

      // Apply template if provided
      if (templateId && templateData) {
        const template = await this.getTemplate(templateId);
        messageContent = this.processTemplate(template, templateData);
      }

      // Ensure message is within SMS limits (160 chars for single SMS, 1600 for concatenated)
      if (messageContent.length > 1600) {
        messageContent = messageContent.substring(0, 1597) + '...';
      }

      const result = await this.client.messages.create({
        body: messageContent,
        from: this.fromNumber,
        to: this.formatPhoneNumber(to)
      });

      logger.info('SMS sent successfully', {
        to,
        messageLength: messageContent.length,
        sid: result.sid,
        status: result.status
      });

      return {
        success: true,
        sid: result.sid,
        status: result.status,
        messageLength: messageContent.length
      };

    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error.message,
        to,
        messageLength: messageContent?.length
      });

      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendBulkSMS(messages) {
    const results = [];
    const batchSize = 5; // Twilio rate limits

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(msg => this.sendSMS(msg));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        results.push({
          index: i + index,
          phoneNumber: batch[index].to,
          success: result.status === 'fulfilled' && result.value.success,
          sid: result.value?.sid,
          error: result.status === 'rejected' ? result.reason : result.value?.error
        });
      });

      // Rate limiting - wait 1 second between batches
      if (i + batchSize < messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info('Bulk SMS send completed', {
      total: results.length,
      successful,
      failed
    });

    return {
      total: results.length,
      successful,
      failed,
      results
    };
  }

  async getTemplate(templateId) {
    const defaultTemplates = {
      'asset-alert': 'ALERT: {{assetName}} requires attention. {{message}} - Asset Tracker',
      'maintenance-reminder': 'MAINTENANCE: {{assetName}} maintenance due {{dueDate}}. {{message}} - Asset Tracker',
      'assignment-notification': '{{assetName}} has been assigned to you. Check your dashboard for details. - Asset Tracker',
      'location-update': '{{assetName}} location updated to {{location}}. - Asset Tracker',
      'system-alert': 'SYSTEM: {{message}} - Asset Tracker'
    };

    return defaultTemplates[templateId] || '{{message}} - Asset Tracker';
  }

  processTemplate(template, data) {
    let processed = template;
    
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });

    return processed;
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // If number doesn't start with country code, assume US (+1)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If already has country code
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // For international numbers, add + if missing
    if (!phoneNumber.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return phoneNumber;
  }

  async getMessageStatus(sid) {
    if (!this.isConfigured()) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = await this.client.messages(sid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      logger.error('Failed to get SMS status', { error: error.message, sid });
      throw error;
    }
  }

  async verifyConnection() {
    if (!this.isConfigured()) {
      throw new Error('SMS service not configured');
    }

    try {
      // Try to fetch account info to verify connection
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return { 
        success: true, 
        message: 'SMS service connection verified',
        accountSid: account.sid,
        accountStatus: account.status
      };
    } catch (error) {
      logger.error('SMS service connection failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Utility method to validate phone number format
  validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    const isValid = cleaned.length >= 10 && cleaned.length <= 15;
    
    return {
      isValid,
      formatted: isValid ? this.formatPhoneNumber(phoneNumber) : null,
      original: phoneNumber
    };
  }
}

module.exports = new SMSService();