import { defineConfig } from 'oxlint';
import worker from './oxlint.worker.ts';

export default defineConfig({
  ...worker,
  ignorePatterns: [...(worker.ignorePatterns ?? []), 'vendor/**', 'tools/**'],
});
