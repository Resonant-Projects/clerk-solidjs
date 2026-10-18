import { defineConfig } from 'tsup';
import * as preset from 'tsup-preset-solid';
import thisPackage from './package.json' with { type: 'json' };

// package.json `exports` are maintained by hand, so the preset's
// writePackageJson is not used: it would reorder the conditions and drop the
// `types` siblings and the `./package.json` export.
export default defineConfig((config) => {
  const watching = !!config.watch;
  const shouldPublish = !!config.env?.publish;

  const parsed = preset.parsePresetOptions(
    {
      entries: [
        {
          entry: 'src/index.tsx',
          server_entry: true,
          // A `development` build, where __DEV__ is true.
          dev_entry: true
        },
        {
          name: 'errors',
          entry: 'src/errors.ts'
        },
        {
          name: 'server',
          entry: 'src/server/index.ts'
        },
        {
          name: 'start',
          entry: 'src/start/index.tsx',
          server_entry: true,
          dev_entry: true
        },
        {
          name: 'start/server',
          entry: 'src/start/server/index.ts'
        },
        {
          // `./start/server` under the `browser` condition.
          name: 'start/server/browser',
          entry: 'src/start/server/browser.ts'
        },
        {
          name: 'legacy',
          entry: 'src/legacy.tsx',
          server_entry: true,
          dev_entry: true
        },
        {
          name: 'experimental',
          entry: 'src/experimental.tsx',
          server_entry: true,
          dev_entry: true
        },
        {
          name: 'internal',
          entry: 'src/internal.tsx',
          server_entry: true,
          dev_entry: true
        },
        {
          name: 'webhooks',
          entry: 'src/webhooks.ts'
        }
      ],
      cjs: false,
      // Keep console output: it is how clerk-js load failures are reported.
      drop_console: false,
      modify_esbuild_options: (options, permutation) => {
        options.bundle = true;
        options.treeShaking = true;
        options.external = [
          ...(options.external ?? []),
          ...Object.keys(thisPackage.peerDependencies)
        ];
        options.define = {
          ...options.define,
          PACKAGE_NAME: `"${thisPackage.name}"`,
          PACKAGE_VERSION: `"${thisPackage.version}"`,
          __DEV__: `${watching || permutation.type.dev}`
        };

        return options;
      },
      out_dir: 'dist'
    },
    watching
  );

  const options = preset.generateTsupOptions(parsed);
  if (shouldPublish) {
    options[options.length - 1].onSuccess = ' && pnpm run publish:local';
  }

  return options;
});
