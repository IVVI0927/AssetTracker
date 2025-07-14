import axios from 'axios';

const instance = axios.create({
  //baseURL: 'http://localhost:5050', // 统一配置后端地址
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default instance;