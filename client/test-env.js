import { loadEnv } from 'vite';
import process from 'process';

const env = loadEnv('development', process.cwd(), '');
console.log('所有环境变量:', env);
console.log('API地址:', env.VITE_API_BASE_URL);