import morgan from 'morgan';
import logger from './logger.js'; // 注意加 `.js` 扩展名（ESM 必须）

// 自定义 Morgan 记录方式，把日志传给 winston
const stream = {
  write: (message) => logger.http(message.trim())
};

const morganMiddleware = morgan('combined', { stream });

export default morganMiddleware;
