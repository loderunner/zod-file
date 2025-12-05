import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { createZodJSON } from '../dist/esm/json.mjs';

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

const testData = {
  name: 'Alice',
  age: 30,
  active: true,
};

async function main() {
  const testFile = join(tmpdir(), `zod-store-e2e-esm-${Date.now()}.json`);
  const store = createZodJSON({
    schema: TestSchema,
  });

  try {
    // Save data
    await store.save(testData, testFile);

    // Verify file was created and contains correct data
    const savedContent = await fs.readFile(testFile, 'utf-8');
    const parsed = JSON.parse(savedContent);
    if (
      parsed.name !== testData.name ||
      parsed.age !== testData.age ||
      parsed.active !== testData.active
    ) {
      console.error('Saved data does not match expected values');
      process.exit(1);
    }

    // Load data
    const loaded = await store.load(testFile);
    if (
      loaded.name !== testData.name ||
      loaded.age !== testData.age ||
      loaded.active !== testData.active
    ) {
      console.error('Loaded data does not match expected values');
      process.exit(1);
    }

    // Cleanup
    await fs.unlink(testFile);

    console.log('ESM test passed');
  } catch (error) {
    console.error('ESM test failed:', error);
    process.exit(1);
  }
}

main();
