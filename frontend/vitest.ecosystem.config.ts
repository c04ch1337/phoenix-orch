import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// This is a specialized config for the ecosystem dominance tests
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [], // Intentionally empty to avoid loading setup.ts
    include: ['**/test_ecosystem_dominance.test.tsx'],
    isolate: true, // Run in isolation mode
  },
});