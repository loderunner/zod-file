import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterAll } from 'vitest';
import { beforeAll } from 'vitest';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

async function cleanDist() {
  await fs.rm(path.join(process.cwd(), 'dist'), {
    recursive: true,
    force: true,
  });
}

describe('E2E build consistency tests', () => {
  let hadDist = false;
  beforeAll(async () => {
    // Check if dist exists
    hadDist = await fs
      .stat(path.join(process.cwd(), 'dist'))
      .then(() => true)
      .catch(() => false);
    if (hadDist) {
      await cleanDist();
    }
    await execAsync('pnpm build', {
      cwd: process.cwd(),
    });
  });
  afterAll(async () => {
    // Clean dist if it did not exist before the test
    if (!hadDist) {
      await cleanDist();
    }
  });

  it('should work with ESM imports', async () => {
    const { stdout, stderr } = await execAsync('node e2e/esm-test.mjs', {
      cwd: process.cwd(),
    });

    if (stderr !== '') {
      throw new Error(`ESM test failed with stderr: ${stderr}`);
    }
    expect(stdout).toContain('ESM test passed');
  });

  it('should work with CJS requires', async () => {
    const { stdout, stderr } = await execAsync('node e2e/cjs-test.cjs', {
      cwd: process.cwd(),
    });

    if (stderr !== '') {
      throw new Error(`CJS test failed with stderr: ${stderr}`);
    }
    expect(stdout).toContain('CJS test passed');
  });

  it('should have valid TypeScript types', async () => {
    const { stderr } = await execAsync(
      'pnpm tsc --noEmit -p e2e/tsconfig.json',
      {
        cwd: process.cwd(),
      },
    );
    expect(stderr).toBe('');
  });
});
