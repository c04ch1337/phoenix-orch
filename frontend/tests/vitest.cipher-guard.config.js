import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/test-utils/cipher-guard-setup.js'], // Use our custom setup
    deps: {
      inline: [/solid-js/],
    },
    include: ['**/*cipher_guard_and_ember_unit*.test.{ts,tsx}'],
    environmentOptions: {
      jsdom: {
        // React testing needs this
        resources: 'usable',
      },
    },
  },
  resolve: {
    alias: {
      // Add aliases to make imports work correctly
      '@': path.resolve(__dirname, '../'),
      '@tests': path.resolve(__dirname, './'),
    },
  },
});