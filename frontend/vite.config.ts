import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  define: {
    __DEFINES__: JSON.stringify({
      API_PORT: 5001
    })
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@components': path.resolve(__dirname, './components'),
      '@routes': path.resolve(__dirname, './routes'),
      '@stores': path.resolve(__dirname, './stores'),
      '@services': path.resolve(__dirname, './services'),
      '@hooks': path.resolve(__dirname, './hooks'),
      '@utils': path.resolve(__dirname, './utils'),
      '@types': path.resolve(__dirname, './types'),
      '@tauri': path.resolve(__dirname, './tauri'),
      '@assets': path.resolve(__dirname, './assets'),
      '@styles': path.resolve(__dirname, './styles')
    }
  },
  server: {
    port: 5000,
    strictPort: true,
    proxy: {
      '/api/sse': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false
      }
    }
  }
});