import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: ['integration/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@meridian/shared': path.resolve(__dirname, '../shared'),
    },
  },
});
