const jwt = require('jsonwebtoken');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' })
  ]
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set');
  process.exit(1);
}

function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No valid authorization header provided',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied',
        message: 'No token provided',
        code: 'MISSING_TOKEN'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Enhanced user context
      req.user = {
        userId: decoded.userId,
        tenantId: decoded.tenantId || process.env.DEFAULT_TENANT_ID,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId
      };
      
      // Add tenant isolation
      req.tenantId = req.user.tenantId;
      
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: jwtError.message
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      return res.status(403).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', { error: error.message, stack: error.stack });
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication service temporarily unavailable',
      code: 'AUTH_ERROR'
    });
  }
}

module.exports = {
  verifyToken
};