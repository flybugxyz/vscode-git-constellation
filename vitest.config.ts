import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'webview/src/**/*.{test,spec}.ts'],
    globals: true,
  },
});
