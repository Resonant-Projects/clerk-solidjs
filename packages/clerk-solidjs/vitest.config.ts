import { createRequire } from 'module';
import solid from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const { name, version } = require('./package.json');

export default defineConfig({
  plugins: [tsconfigPaths(), solid()],
  define: {
    PACKAGE_NAME: `"${name}"`,
    PACKAGE_VERSION: `"${version}"`
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./node_modules/@testing-library/jest-dom/vitest']
  },
  resolve: {
    conditions: ['development', 'browser']
  }
});
