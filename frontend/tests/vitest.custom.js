// This is a custom Vitest configuration specifically for ecosystem dominance test
// which bypasses the global setup.ts file to avoid WebSocket issues

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ecosystem-tests',
    environment: 'jsdom',
    include: ['**/test_ecosystem_dominance.test.tsx'],
    globals: true,
    setupFiles: [], // Intentionally empty to skip the global setup.ts
  }
});