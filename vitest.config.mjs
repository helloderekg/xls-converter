// ESM configuration for Vitest
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/test/files/**']
    },
  },
  resolve: {
    extensions: ['.js', '.json', '.jsx', '.mjs'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
