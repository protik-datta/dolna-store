import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = {
    '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:5001', changeOrigin: true },
    '/sitemap.xml': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:5001', changeOrigin: true },
  };
  return { plugins: [react()], server: { port: 5174, strictPort: true, proxy }, preview: { proxy } };
});
