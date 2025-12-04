import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/performance/setup.ts'], // Use our custom performance setup
    include: ['**/tests/performance/**/*.test.{ts,tsx}'],
    testTimeout: 30000, // 30s timeout for performance tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        '**/app/features/communication/**',
        '**/monitoring/**'
      ]
    },
    isolate: false, // Run tests in the same context for consistent performance
    maxThreads: 1, // Use a single thread for more consistent performance metrics
    minThreads: 1
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
});