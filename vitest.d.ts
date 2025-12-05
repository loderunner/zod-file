import type { ErrorCode } from './src/errors';

/**
 * TypeScript type definitions for custom matchers.
 */
declare module 'vitest' {
  interface Assertion {
    toThrowZodStoreError(expectedCode?: ErrorCode): void;
  }
  interface AsymmetricMatchersContaining {
    toThrowZodStoreError(expectedCode?: ErrorCode): void;
  }
}
