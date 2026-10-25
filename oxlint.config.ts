import worker from './oxlint.worker.ts';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [worker],
  jsPlugins: [
    ...(worker.jsPlugins ?? []),
    { name: 'style', specifier: '../../tools/oxlint/style/index.ts' },
  ],
  ignorePatterns: [
    'dist/**',
    '.wrangler/**',
    'worker-configuration.d.ts',
    'vendor/**',
  ],
  rules: {
    'style/blank-line-after-block': 'error',
  },
});
