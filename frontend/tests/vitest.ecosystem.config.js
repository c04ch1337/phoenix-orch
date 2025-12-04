import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';
import viteConfig from '../vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./tests/test_ecosystem_dominance.setup.ts'],
      include: ['**/test_ecosystem_dominance.test.tsx'],
    },
  })
);