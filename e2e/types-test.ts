import { z } from 'zod';
import { createZodJSON } from '../dist/json';
import { ZodStore, ZodStoreError } from '../dist/index';

const TestSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// Test that types are correctly exported and usable
const store: ZodStore<z.infer<typeof TestSchema>> = createZodJSON({
  schema: TestSchema,
});

// Test that ZodStoreError class is available and can be used in type guards
function handleError(error: unknown): void {
  if (error instanceof ZodStoreError) {
    const _code: string = error.code;
    const _message: string = error.message;
  }
}

// This file should compile without errors
// The actual runtime test is done in the orchestrator
