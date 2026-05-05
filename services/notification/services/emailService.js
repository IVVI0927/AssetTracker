const nodemailer = require('nodemailer');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/email.log' })
  ]
});

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    try {
      if (!process.env.SMTP_HOST) {
        logger.warn('Email service not configured - SMTP_HOST missing');
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
      });

      this.isInitialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
    }
  }

  isConfigured() {
    return this.isInitialized && this.transporter;
  }

  async sendEmail({ to, subject, message, html, templateId, templateData }) {
    if (!this.isConfigured()) {
      throw new Error('Email service not configured');
    }

    try {
      let htmlContent = html;
      let textContent = message;

      // Apply template if provided
      if (templateId && templateData) {
        const template = await this.getTemplate(templateId);
        htmlContent = this.processTemplate(template.html, templateData);
        textContent = this.processTemplate(template.text, templateData);
      }

      const mailOptions = {
        from: {
          name: process.env.SMTP_FROM_NAME || 'Asset Tracker',
          address: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
        },
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text: textContent,
        html: htmlContent || this.generateHtmlFromText(textContent),
        headers: {
          'X-Service': 'asset-tracker-notification',
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to: Array.isArray(to) ? to : [to],
        subject,
        messageId: result.messageId,
        response: result.response
      });

      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };

    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        to: Array.isArray(to) ? to : [to],
        subject
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendBulkEmails(emails) {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.sendEmail(email));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        results.push({
          index: i + index,
          email: batch[index].to,
          success: result.status === 'fulfilled' && result.value.success,
          error: result.status === 'rejected' ? result.reason : result.value?.error
        });
      });

      // Rate limiting - wait 1 second between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info('Bulk email send completed', {
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
    // In a real implementation, this would fetch from database or file system
    const defaultTemplates = {
      'asset-alert': {
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Asset Alert: {{assetName}}</h2>
            <p>Hello {{userName}},</p>
            <p>{{message}}</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-left: 4px solid #dc2626;">
              <strong>Asset Details:</strong><br>
              Name: {{assetName}}<br>
              ID: {{assetId}}<br>
              Location: {{location}}
            </div>
            {{#if actionUrl}}
            <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 4px;">View Asset</a>
            {{/if}}
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 14px;">This is an automated message from Asset Tracker.</p>
          </div>
        `,
        text: `
Asset Alert: {{assetName}}

Hello {{userName}},

{{message}}

Asset Details:
- Name: {{assetName}}
- ID: {{assetId}}
- Location: {{location}}

{{#if actionUrl}}
View Asset: {{actionUrl}}
{{/if}}

This is an automated message from Asset Tracker.
        `
      },
      'maintenance-reminder': {
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">Maintenance Reminder: {{assetName}}</h2>
            <p>Hello {{userName}},</p>
            <p>{{message}}</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #fffbeb; border-left: 4px solid #f59e0b;">
              <strong>Maintenance Details:</strong><br>
              Asset: {{assetName}}<br>
              Due Date: {{dueDate}}<br>
              Type: {{maintenanceType}}
            </div>
            {{#if actionUrl}}
            <a href="{{actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 4px;">Schedule Maintenance</a>
            {{/if}}
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 14px;">This is an automated message from Asset Tracker.</p>
          </div>
        `,
        text: `
Maintenance Reminder: {{assetName}}

Hello {{userName}},

{{message}}

Maintenance Details:
- Asset: {{assetName}}
- Due Date: {{dueDate}}
- Type: {{maintenanceType}}

{{#if actionUrl}}
Schedule Maintenance: {{actionUrl}}
{{/if}}

This is an automated message from Asset Tracker.
        `
      }
    };

    return defaultTemplates[templateId] || {
      html: '<div style="font-family: Arial, sans-serif;">{{message}}</div>',
      text: '{{message}}'
    };
  }

  processTemplate(template, data) {
    let processed = template;
    
    // Simple template processing (in production, use a proper template engine like Handlebars)
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key] || '');
    });

    // Handle conditional blocks
    processed = processed.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      return data[condition] ? content : '';
    });

    return processed;
  }

  generateHtmlFromText(text) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${text.split('\n').map(line => `<p>${line}</p>`).join('')}
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">This is an automated message from Asset Tracker.</p>
      </div>
    `;
  }

  async verifyConnection() {
    if (!this.isConfigured()) {
      throw new Error('Email service not configured');
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email service connection verified' };
    } catch (error) {
      logger.error('Email service connection failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();