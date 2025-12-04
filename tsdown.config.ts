import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    target: 'es2022',
    platform: 'node',
    format: 'cjs',
    outDir: 'dist/cjs',
    dts: false,
  },
  {
    entry: ['src/index.ts'],
    target: 'es2022',
    platform: 'node',
    format: 'esm',
    outDir: 'dist/esm',
    dts: false,
  },
  {
    entry: ['src/index.ts'],
    outDir: 'dist',
    dts: {
      emitDtsOnly: true,
    },
    outExtensions: () => ({ dts: '.d.ts' }),
  },
]);
