console.log('✅ 当前 API 地址 =', process.env.VITE_API_BASE_URL);
/* global process */

import { config } from 'dotenv';
import { resolve } from 'path';
// 手动加载 .env.development 文件
config({ path: resolve(__dirname, '.env.development') });

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM 方式模拟 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL,
        //target: 'http://18.217.234.231:5050',  //先写死
        changeOrigin: true,
        // 可选：添加更多代理配置
        secure: false, // 如果是 https 且证书有问题
        // rewrite: (path) => path.replace(/^\/api/, '') // 如果需要重写路径
      },
    },
  },
  // 可选：显式定义环境变量
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL),
  },
});