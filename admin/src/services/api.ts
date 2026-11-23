import axios from 'axios';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:5000/api/v1'));

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vardhamrit_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('vardhamrit_admin_token');
      localStorage.removeItem('vardhamrit_admin_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);
