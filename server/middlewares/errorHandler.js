const logger = require('../logger/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`❌ ${err.stack}`);
  res.status(500).json({ message: 'Internal Server Error' });
};

module.exports = errorHandler;