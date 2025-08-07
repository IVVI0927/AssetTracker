const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const redis = require('../utils/redis');
const logger = require('../utils/logger');

class AuthMiddleware {
  
  async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      }

      const token = authHeader.substring(7);
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user exists and is active
      const user = await User.findById(decoded.userId)
        .populate('tenantId')
        .select('-password -mfaSecret -refreshTokens');

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Check if tenant is active
      if (!user.tenantId || !user.tenantId.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Tenant not found or inactive'
        });
      }

      // Attach user and tenant to request
      req.user = user;
      req.tenant = user.tenantId;
      
      next();
      
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid access token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Access token expired'
        });
      }

      logger.error('Authentication error', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  authorize(roles = [], permissions = []) {
    return async (req, res, next) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Super admin has access to everything
        if (user.hasRole('super-admin')) {
          return next();
        }

        // Check roles
        if (roles.length > 0) {
          const hasRole = roles.some(role => user.hasRole(role));
          if (!hasRole) {
            return res.status(403).json({
              success: false,
              message: 'Insufficient role permissions'
            });
          }
        }

        // Check permissions
        if (permissions.length > 0) {
          const hasPermission = permissions.every(permission => {
            const [resource, action] = permission.split(':');
            return user.hasPermission(resource, action);
          });

          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: 'Insufficient permissions'
            });
          }
        }

        next();

      } catch (error) {
        logger.error('Authorization error', error);
        res.status(500).json({
          success: false,
          message: 'Authorization failed'
        });
      }
    };
  }

  requireTenant(req, res, next) {
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID required'
      });
    }

    // Ensure user belongs to the requested tenant
    if (req.user && req.user.tenantId.toString() !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for this tenant'
      });
    }

    req.tenantId = tenantId;
    next();
  }

  async requireSubscription(plans = []) {
    return async (req, res, next) => {
      try {
        const tenant = req.tenant;

        if (!tenant) {
          return res.status(401).json({
            success: false,
            message: 'Tenant required'
          });
        }

        // Check if tenant subscription is active
        if (tenant.subscriptionStatus !== 'active') {
          return res.status(402).json({
            success: false,
            message: 'Subscription required'
          });
        }

        // Check specific plans if provided
        if (plans.length > 0 && !plans.includes(tenant.subscriptionPlan)) {
          return res.status(402).json({
            success: false,
            message: 'Subscription upgrade required'
          });
        }

        next();

      } catch (error) {
        logger.error('Subscription check error', error);
        res.status(500).json({
          success: false,
          message: 'Subscription validation failed'
        });
      }
    };
  }

  async checkResourceLimits(resource) {
    return async (req, res, next) => {
      try {
        const tenant = req.tenant;

        if (!tenant.isWithinLimits(resource)) {
          return res.status(429).json({
            success: false,
            message: `${resource} limit exceeded for your subscription plan`,
            currentUsage: tenant.usage[resource],
            limit: tenant.limits[resource]
          });
        }

        next();

      } catch (error) {
        logger.error('Resource limit check error', error);
        res.status(500).json({
          success: false,
          message: 'Resource limit validation failed'
        });
      }
    };
  }

  auditLog(action, resource) {
    return (req, res, next) => {
      const originalSend = res.send;
      
      res.send = function(data) {
        // Log successful operations
        if (res.statusCode < 400) {
          logger.info('User action', {
            userId: req.user?._id,
            tenantId: req.tenant?._id,
            action,
            resource,
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString()
          });
        }
        
        originalSend.call(this, data);
      };
      
      next();
    };
  }
}

module.exports = new AuthMiddleware();