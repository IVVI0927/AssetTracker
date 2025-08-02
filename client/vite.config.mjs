import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '');
  
  const API_URL = env.VITE_API_BASE_URL;
  console.log('✅ 当前 API 地址:', API_URL);
  console.log('✅ 当前模式:', mode);

  if (!API_URL) {
    console.warn('⚠️ VITE_API_BASE_URL is undefined!')
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: API_URL || 'http://localhost:5050',
          changeOrigin: true,
        },
      },
    },
    define: {
      __API_URL__: JSON.stringify(API_URL || ''),
    }
  };
})