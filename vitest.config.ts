import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['e2e/**/*.test.ts'],
        },
      },
    ],
  },
});
