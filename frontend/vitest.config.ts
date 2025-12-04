import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      './tests/**/*.test.{ts,tsx}',
      './app/**/*.test.{ts,tsx}',
      './src/**/*.test.{ts,tsx}',
      './app/components/__tests__/**/*.test.{ts,tsx}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@app': '/app'
    }
  },
});