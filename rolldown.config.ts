import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

// Build each entry point separately to prevent shared chunks
const entryPoints = ['src/index.ts', 'src/json.ts', 'src/yaml.ts'];
const external = /^[^/.]/;

export default defineConfig([
  {
    input: entryPoints,
    platform: 'node',
    external,
    output: [
      {
        format: 'cjs',
        dir: 'dist/cjs',
        entryFileNames: '[name].cjs',
      },
      {
        format: 'esm',
        dir: 'dist/esm',
        entryFileNames: '[name].mjs',
      },
    ],
  },
  {
    input: entryPoints,
    platform: 'node',
    external,
    plugins: [
      dts({
        emitDtsOnly: true,
      }),
    ],
    output: {
      dir: 'dist',
    },
  },
]);
