import logger from '../logger/logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(`❌ ${err.stack}`);
  res.status(500).json({ message: 'Internal Server Error' });
};

export default errorHandler;
