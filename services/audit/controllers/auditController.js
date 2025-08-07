const AuditEvent = require('../models/AuditEvent');
const ComplianceReport = require('../models/ComplianceReport');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class AuditController {
  
  async createEvent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const eventData = {
        ...req.body,
        tenantId: req.tenantId || req.body.tenantId
      };

      const auditEvent = await AuditEvent.createEvent(eventData);
      await auditEvent.save();

      // Index in Elasticsearch for search
      await this.indexEventInElasticsearch(auditEvent);

      logger.info('Audit event created', {
        eventId: auditEvent.eventId,
        eventType: auditEvent.eventType,
        tenantId: auditEvent.tenantId
      });

      res.status(201).json({
        success: true,
        data: {
          eventId: auditEvent.eventId,
          timestamp: auditEvent.timestamp
        }
      });

    } catch (error) {
      logger.error('Failed to create audit event', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create audit event'
      });
    }
  }

  async getEvents(req, res) {
    try {
      const {
        startDate,
        endDate,
        eventType,
        category,
        actorId,
        page = 1,
        limit = 50
      } = req.query;

      const tenantId = req.tenantId;
      const skip = (page - 1) * limit;

      // Build query
      const query = { tenantId };
      
      if (startDate && endDate) {
        query.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      if (eventType) query.eventType = eventType;
      if (category) query.category = category;
      if (actorId) query['actor.id'] = actorId;

      const [events, totalCount] = await Promise.all([
        AuditEvent.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        AuditEvent.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          events,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Failed to retrieve audit events', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit events'
      });
    }
  }

  async getEventById(req, res) {
    try {
      const { eventId } = req.params;
      const tenantId = req.tenantId;

      const event = await AuditEvent.findOne({ 
        eventId, 
        tenantId 
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Audit event not found'
        });
      }

      res.json({
        success: true,
        data: event
      });

    } catch (error) {
      logger.error('Failed to retrieve audit event', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit event'
      });
    }
  }

  async verifyIntegrity(req, res) {
    try {
      const tenantId = req.tenantId;
      const { eventId } = req.params;

      if (eventId) {
        // Verify single event
        const event = await AuditEvent.findOne({ eventId, tenantId });
        if (!event) {
          return res.status(404).json({
            success: false,
            message: 'Event not found'
          });
        }

        const isValid = event.verifyIntegrity();
        res.json({
          success: true,
          data: {
            eventId,
            valid: isValid,
            hash: event.hash
          }
        });
      } else {
        // Verify entire chain for tenant
        const result = await AuditEvent.verifyChain(tenantId);
        res.json({
          success: true,
          data: result
        });
      }

    } catch (error) {
      logger.error('Failed to verify integrity', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify integrity'
      });
    }
  }

  async getStatistics(req, res) {
    try {
      const tenantId = req.tenantId;
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const pipeline = [
        { $match: { tenantId: tenantId, ...dateFilter } },
        {
          $group: {
            _id: null,
            totalEvents: { $sum: 1 },
            eventsByCategory: {
              $push: '$category'
            },
            eventsByType: {
              $push: '$eventType'
            },
            eventsBySeverity: {
              $push: '$severity'
            }
          }
        },
        {
          $project: {
            totalEvents: 1,
            eventsByCategory: {
              $reduce: {
                input: '$eventsByCategory',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    { ['$$this']: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }
                  ]
                }
              }
            },
            eventsByType: {
              $reduce: {
                input: '$eventsByType',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    { ['$$this']: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }
                  ]
                }
              }
            },
            eventsBySeverity: {
              $reduce: {
                input: '$eventsBySeverity',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    { ['$$this']: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }
                  ]
                }
              }
            }
          }
        }
      ];

      const [statistics] = await AuditEvent.aggregate(pipeline);

      res.json({
        success: true,
        data: statistics || {
          totalEvents: 0,
          eventsByCategory: {},
          eventsByType: {},
          eventsBySeverity: {}
        }
      });

    } catch (error) {
      logger.error('Failed to get statistics', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics'
      });
    }
  }

  async searchEvents(req, res) {
    try {
      const { q, filters, page = 1, limit = 50 } = req.body;
      const tenantId = req.tenantId;

      // Use Elasticsearch for advanced search
      const searchResult = await this.searchEventsInElasticsearch(
        tenantId, 
        q, 
        filters, 
        page, 
        limit
      );

      res.json({
        success: true,
        data: searchResult
      });

    } catch (error) {
      logger.error('Failed to search events', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search events'
      });
    }
  }

  // Helper methods
  async indexEventInElasticsearch(event) {
    // Implementation would integrate with Elasticsearch service
    // This is a placeholder for the actual implementation
    logger.debug('Indexing event in Elasticsearch', { eventId: event.eventId });
  }

  async searchEventsInElasticsearch(tenantId, query, filters, page, limit) {
    // Implementation would search Elasticsearch
    // This is a placeholder for the actual implementation
    logger.debug('Searching events in Elasticsearch', { tenantId, query });
    return {
      events: [],
      total: 0,
      page,
      limit
    };
  }
}

module.exports = new AuditController();