import { createRequire } from 'module';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const { name, version } = require('./package.json');

const define = {
  PACKAGE_NAME: `"${name}"`,
  PACKAGE_VERSION: `"${version}"`,
  __DEV__: 'true'
};

// Tests that render on the server (`*.ssr.test.tsx`) and server-only code
// (`src/start/server`) run in node with Solid's SSR compiler. Everything else
// runs in jsdom with the DOM compiler.
const nodeTests = [
  'src/**/*.ssr.test.{ts,tsx}',
  'src/start/server/**/*.test.{ts,tsx}'
];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [solid()],
        define,
        resolve: { conditions: ['development', 'browser'] },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: nodeTests,
          setupFiles: ['./node_modules/@testing-library/jest-dom/vitest'],
          // Solid libraries ship JSX for the consumer to compile.
          server: { deps: { inline: [/@solidjs\/router/] } }
        }
      },
      {
        plugins: [solid({ ssr: true })],
        define,
        resolve: { conditions: ['node'] },
        ssr: { resolve: { conditions: ['solid', 'node'] } },
        test: {
          name: 'node',
          environment: 'node',
          include: nodeTests,
          server: {
            deps: {
              inline: [/solid-js/, /@solid-primitives/, /@solidjs\/router/]
            }
          }
        }
      }
    ]
  }
});
