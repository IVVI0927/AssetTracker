const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  
  body('firstName')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name must be 1-50 characters and contain only letters'),
  
  body('lastName')
    .isLength({ min: 1, max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name must be 1-50 characters and contain only letters'),
  
  body('tenantSlug')
    .isLength({ min: 1 })
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Valid tenant slug required')
];

const loginValidation = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or username required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password required'),
  
  body('tenantSlug')
    .notEmpty()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Valid tenant slug required'),
  
  body('mfaToken')
    .optional()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA token must be 6 digits')
];

const mfaValidation = [
  body('token')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('MFA token must be 6 digits')
];

// Routes
router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authMiddleware.authenticate, authController.logout);

// MFA routes
router.post('/mfa/setup', authMiddleware.authenticate, authController.setupMFA);
router.post('/mfa/enable', authMiddleware.authenticate, mfaValidation, authController.enableMFA);

module.exports = router;