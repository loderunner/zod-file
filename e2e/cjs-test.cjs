const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { z } = require('zod');
const { createZodJSON } = require('../dist/cjs/json.cjs');

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
  active: z.boolean(),
});

const testData = {
  name: 'Bob',
  age: 25,
  active: false,
};

async function main() {
  const testFile = join(tmpdir(), `zod-file-e2e-cjs-${Date.now()}.json`);
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

    console.log('CJS test passed');
  } catch (error) {
    console.error('CJS test failed:', error);
    process.exit(1);
  }
}

main();
