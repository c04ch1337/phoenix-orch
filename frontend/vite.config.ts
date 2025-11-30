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
      WS_PORT: 5001,
      API_PORT: 5001
    })
  },
  resolve: {
    alias: {
      // Updated src aliases for app directory
      '@': path.resolve(__dirname, './app'),
      '@phoenix': path.resolve(__dirname, './phoenix'),
      '@tribute': path.resolve(__dirname, './tribute/eternal.tsx'),
      '@components': path.resolve(__dirname, './app/components'),
      '@services': path.resolve(__dirname, './app/services'),
      '@types': path.resolve(__dirname, './app/types'),
      '@features': path.resolve(__dirname, './app/features'),
      
      // New app directory aliases
      '@app': path.resolve(__dirname, './app'),
      '@app/components': path.resolve(__dirname, './app/components'),
      '@app/services': path.resolve(__dirname, './app/services'),
      '@app/types': path.resolve(__dirname, './app/types'),
      '@app/features': path.resolve(__dirname, './app/features'),
      '@app/modules': path.resolve(__dirname, './app/modules'),
      '@app/lib': path.resolve(__dirname, './app/lib'),
      '@app/config': path.resolve(__dirname, './app/config'),
      '@app/styles': path.resolve(__dirname, './app/styles')
    }
  },
  server: {
    port: 5000,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
        ws: false
      },
      '/ws': {
        target: 'ws://127.0.0.1:5001',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
});