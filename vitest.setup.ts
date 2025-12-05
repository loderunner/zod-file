import { expect } from 'vitest';

import { ErrorCode, ZodStoreError } from './src/errors';

/**
 * Custom matcher to assert that a promise rejects with a ZodStoreError with a specific code.
 * Works with `.rejects` modifier - Vitest handles the promise rejection, we just validate the error.
 */
expect.extend({
  toThrowZodStoreError(received: unknown, expectedCode?: ErrorCode) {
    const { matcherHint, printExpected, printReceived } = this.utils;

    // When using .rejects, Vitest catches the rejection and passes the error here
    if (!(received instanceof ZodStoreError)) {
      return {
        message: () =>
          `${matcherHint('.rejects.toThrowZodStoreError')}\n\n` +
          `Expected ZodStoreError, but received ${printReceived(received)}`,
        pass: false,
      };
    }

    // If expectedCode is provided, check that it matches
    if (expectedCode !== undefined && received.code !== expectedCode) {
      return {
        message: () =>
          `${matcherHint('.rejects.toThrowZodStoreError')}\n\n` +
          `Expected error code ${printExpected(expectedCode)}, but received ${printReceived(received.code)}`,
        pass: false,
      };
    }

    return {
      message: () =>
        `${matcherHint('.not.rejects.toThrowZodStoreError')}\n\n` +
        (expectedCode !== undefined
          ? `Expected promise not to reject with ZodStoreError(${printExpected(expectedCode)}), but it did`
          : `Expected promise not to reject with ZodStoreError, but it did`),
      pass: true,
    };
  },
});
