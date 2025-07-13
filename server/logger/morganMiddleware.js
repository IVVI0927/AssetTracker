const morgan = require('morgan');
const logger = require('./logger');

// 自定义 Morgan 记录方式，把日志传给 winston
const stream = {
  write: (message) => logger.info(message.trim())
};

const morganMiddleware = morgan('combined', { stream });

module.exports = morganMiddleware;