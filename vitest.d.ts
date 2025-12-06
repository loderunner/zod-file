import type { ErrorCode } from './src/errors';

/**
 * TypeScript type definitions for custom matchers.
 */
declare module 'vitest' {
  interface Assertion {
    toThrowZodFileError(expectedCode?: ErrorCode): void;
  }
  interface AsymmetricMatchersContaining {
    toThrowZodFileError(expectedCode?: ErrorCode): void;
  }
}
