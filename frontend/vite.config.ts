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
      // Primary app directory alias (Next.js convention)
      '@': path.resolve(__dirname, './app'),
      
      // Standard Next.js-style path aliases
      '@/components': path.resolve(__dirname, './app/components'),
      '@/services': path.resolve(__dirname, './app/services'),
      '@/types': path.resolve(__dirname, './app/types'),
      '@/features': path.resolve(__dirname, './app/features'),
      '@/modules': path.resolve(__dirname, './app/modules'),
      '@/lib': path.resolve(__dirname, './app/lib'),
      '@/config': path.resolve(__dirname, './app/config'),
      '@/styles': path.resolve(__dirname, './app/styles'),
      '@/utils': path.resolve(__dirname, './app/utils'),
      '@/hooks': path.resolve(__dirname, './app/hooks'),
      '@/contexts': path.resolve(__dirname, './app/contexts'),
      
      // Legacy aliases (maintained for compatibility during migration)
      '@components': path.resolve(__dirname, './app/components'),
      '@services': path.resolve(__dirname, './app/services'),
      '@types': path.resolve(__dirname, './app/types'),
      '@features': path.resolve(__dirname, './app/features'),
      
      // Project-specific aliases
      '@phoenix': path.resolve(__dirname, './phoenix'),
      '@tribute': path.resolve(__dirname, './tribute/eternal.tsx')
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