const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const redis = require('../utils/redis');

class AuthController {
  
  async register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { username, email, password, firstName, lastName, tenantSlug } = req.body;

      // Find tenant
      const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found or inactive'
        });
      }

      // Check if tenant can create more users
      if (!tenant.canCreateUser()) {
        return res.status(403).json({
          success: false,
          message: 'User limit reached for this tenant'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email, tenantId: tenant._id },
          { username, tenantId: tenant._id }
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email or username'
        });
      }

      // Create user
      const user = new User({
        username,
        email,
        password,
        firstName,
        lastName,
        tenantId: tenant._id,
        roles: ['viewer'] // Default role
      });

      // Generate verification token if email verification is required
      if (tenant.settings.requireEmailVerification) {
        user.generateVerificationToken();
      } else {
        user.isVerified = true;
      }

      await user.save();

      // Update tenant usage
      await tenant.incrementUsage('users');

      // Log audit event
      logger.info('User registered', {
        userId: user._id,
        tenantId: tenant._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toJSON(),
          requiresVerification: tenant.settings.requireEmailVerification
        }
      });

    } catch (error) {
      logger.error('Registration error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { identifier, password, tenantSlug, mfaToken } = req.body;

      // Find tenant
      const tenant = await Tenant.findOne({ slug: tenantSlug, isActive: true });
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Find user by email or username
      const user = await User.findOne({
        $or: [
          { email: identifier, tenantId: tenant._id },
          { username: identifier, tenantId: tenant._id }
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account locked due to too many failed attempts'
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active and verified
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account deactivated'
        });
      }

      if (!user.isVerified && tenant.settings.requireEmailVerification) {
        return res.status(401).json({
          success: false,
          message: 'Email verification required'
        });
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaToken) {
          return res.status(200).json({
            success: true,
            message: 'MFA token required',
            requiresMFA: true,
            tempToken: this.generateTempToken(user._id)
          });
        }

        const isValidMFA = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token: mfaToken,
          window: 2
        });

        if (!isValidMFA) {
          return res.status(401).json({
            success: false,
            message: 'Invalid MFA token'
          });
        }
      }

      // Reset login attempts
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user, tenant);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      user.refreshTokens.push({
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        deviceInfo: req.get('user-agent')
      });

      // Update last login
      user.lastLogin = new Date();
      user.lastLoginIP = req.ip;
      await user.save();

      // Store session in Redis
      await redis.setex(`session:${user._id}:${refreshToken}`, 
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          userId: user._id,
          tenantId: tenant._id,
          roles: user.roles,
          loginTime: new Date(),
          ip: req.ip,
          userAgent: req.get('user-agent')
        })
      );

      // Log audit event
      logger.info('User logged in', {
        userId: user._id,
        tenantId: tenant._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          tenant: {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: 900 // 15 minutes
          }
        }
      });

    } catch (error) {
      logger.error('Login error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token required'
        });
      }

      // Find user with this refresh token
      const user = await User.findOne({
        'refreshTokens.token': refreshToken
      }).populate('tenantId');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      const tokenData = user.refreshTokens.find(t => t.token === refreshToken);
      if (!tokenData || tokenData.expiresAt < new Date()) {
        // Remove expired token
        user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
        await user.save();
        
        return res.status(401).json({
          success: false,
          message: 'Refresh token expired'
        });
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user, user.tenantId);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: 900 // 15 minutes
        }
      });

    } catch (error) {
      logger.error('Refresh token error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const user = req.user;

      if (refreshToken) {
        // Remove refresh token from user
        user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
        await user.save();

        // Remove session from Redis
        await redis.del(`session:${user._id}:${refreshToken}`);
      }

      // Log audit event
      logger.info('User logged out', {
        userId: user._id,
        tenantId: user.tenantId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async setupMFA(req, res) {
    try {
      const user = req.user;

      if (user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA already enabled'
        });
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Asset Tracker (${user.email})`,
        issuer: 'Asset Tracker Enterprise'
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      // Store secret temporarily (not yet enabled)
      user.mfaSecret = secret.base32;
      user.mfaBackupCodes = backupCodes;
      await user.save();

      res.json({
        success: true,
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          backupCodes
        }
      });

    } catch (error) {
      logger.error('MFA setup error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  async enableMFA(req, res) {
    try {
      const { token } = req.body;
      const user = req.user;

      if (!user.mfaSecret) {
        return res.status(400).json({
          success: false,
          message: 'MFA setup required first'
        });
      }

      // Verify token
      const isValid = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid MFA token'
        });
      }

      // Enable MFA
      user.mfaEnabled = true;
      await user.save();

      logger.info('MFA enabled', {
        userId: user._id,
        tenantId: user.tenantId
      });

      res.json({
        success: true,
        message: 'MFA enabled successfully'
      });

    } catch (error) {
      logger.error('MFA enable error', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  generateAccessToken(user, tenant) {
    return jwt.sign({
      userId: user._id,
      tenantId: tenant._id,
      roles: user.roles,
      permissions: user.permissions
    }, process.env.JWT_SECRET, {
      expiresIn: '15m',
      issuer: 'asset-tracker',
      audience: 'asset-tracker-api'
    });
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  generateTempToken(userId) {
    return jwt.sign({ userId, temp: true }, process.env.JWT_SECRET, {
      expiresIn: '5m'
    });
  }
}

module.exports = new AuthController();