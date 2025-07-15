import morgan from 'morgan';
const logger = require('./logger/logger');
// 自定义 Morgan 记录方式，把日志传给 winston
const stream = {
  write: (message) => logger.http(message.trim())
};

const morganMiddleware = morgan('combined', { stream });

export default morganMiddleware;
