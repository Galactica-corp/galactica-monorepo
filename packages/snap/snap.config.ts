import type { SnapConfig } from '@metamask/snaps-cli';
import { resolve } from 'path';

const config: SnapConfig = {
  customizeWebpackConfig: (wPackConfig) => {
    // needed some hacky changes to the webpack config to make the snap pass through the webpack and SES compatibility checks
    const res = wPackConfig;
    for (const plugin of res?.plugins ?? []) {
      if (plugin?.constructor.name === 'DefinePlugin') {
        // Add type assertion to ensure 'definitions' property exists
        const definePlugin = plugin as unknown as {
          definitions: Record<string, string>;
        };
        // Update the definitions
        definePlugin.definitions['process.env.DEBUG'] = 'process.env.DEBUG';
        /* definePlugin.definitions['process.env.DEBUG)'] = '"false")';
        definePlugin.definitions['process.env.DEBUG;'] = '"false";'; */
      }
    }
    if (res.optimization) {
      // simplify debugging the bundle.js
      res.optimization.minimize = true;
    }
    return res;
  },

  input: resolve(__dirname, 'src/index.tsx'),
  server: {
    port: 8080,
  },
  polyfills: {
    buffer: true,
  },
  stats: {
    builtIns: {
      // ignore built-ins that are not needed to disable build warning
      ignore: [
        'assert',
        'crypto',
        'events',
        'http',
        'https',
        'zlib',
        'util',
        'url',
        'os',
        'tty',
        'readline',
        'punycode',
        'constants',
        'fs',
        'path',
        'string_decoder',
      ],
    },
  },
};

export default config;
