import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Vite dev server proxy:
// - Frontend calls /api/chat -> proxied to http://127.0.0.1:10086/chat
// - This avoids browser CORS during development
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:10086',
        changeOrigin: true,
        secure: false,
        ws: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});