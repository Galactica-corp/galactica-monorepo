import type { SnapConfig } from '@metamask/snaps-cli';
import { resolve } from 'path';

const config: SnapConfig = {
  bundler: 'webpack',
  customizeWebpackConfig: (config) => {
    // needed some hacky changes to the webpack config to make the snap pass through the webpack and SES compatibility checks
    let res = config;
    for (const plugin of res?.plugins ?? []) {
      if (plugin?.constructor.name === 'DefinePlugin') {
        // Add type assertion to ensure 'definitions' property exists
        const definePlugin = plugin as unknown as { definitions: Record<string, string> };
        // Update the definitions
        definePlugin.definitions['process.env.DEBUG'] = "process.env.DEBUG";
        definePlugin.definitions['process.env.DEBUG)'] = '"false")';
        definePlugin.definitions['process.env.DEBUG;'] = '"false";';
      }
    }
    return res;
  },
  input: resolve(__dirname, 'src/index.ts'),
  server: {
    port: 8080,
  },
  polyfills: {
    buffer: true,
    process: true,
    crypto: true,
  },
};

export default config;
