/**
 * Error codes identifying the failure stage in ZodJSON operations.
 *
 * Use these codes for programmatic error handling to determine what went wrong
 * during load or save operations.
 *
 * @example
 * ```typescript
 * import { ZodJSONError } from 'zod-store';
 *
 * try {
 *   await store.load('./config.json', { throwOnError: true });
 * } catch (error) {
 *   if (error instanceof ZodJSONError) {
 *     if (error.code === 'FileRead') {
 *       console.log('File does not exist or is not readable');
 *     } else if (error.code === 'Validation') {
 *       console.log('Data does not match schema');
 *     }
 *   }
 * }
 * ```
 */
export type ErrorCode =
  /** File could not be read from disk */
  | 'FileRead'
  /** File could not be written to disk */
  | 'FileWrite'
  /** File content is not valid JSON */
  | 'InvalidJSON'
  /** `_version` field is missing, not an integer, or ≤ 0 */
  | 'InvalidVersion'
  /** File version is greater than the current schema version */
  | 'UnsupportedVersion'
  /** Data does not match the Zod schema */
  | 'Validation'
  /** A migration function threw an error */
  | 'Migration'
  /** Schema encoding failed during save */
  | 'Encoding';

/**
 * Error thrown by ZodJSON operations.
 *
 * The `message` property contains a user-friendly description of the error.
 * The `code` property identifies the failure stage for programmatic handling.
 * The optional `cause` property contains the underlying error for debugging.
 *
 * @example
 * ```typescript
 * import { ZodJSONError } from 'zod-store';
 *
 * try {
 *   await store.load('./config.json', { throwOnError: true });
 * } catch (error) {
 *   if (error instanceof ZodJSONError) {
 *     console.error(`[${error.code}] ${error.message}`);
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class ZodJSONError extends Error {
  /**
   * Error code identifying the failure stage.
   */
  code: ErrorCode;

  /**
   * The underlying error that caused this failure, if any.
   */
  cause?: Error;

  /**
   * Creates a new ZodJSONError.
   *
   * @param code - The error code identifying the failure stage
   * @param message - A user-friendly error message
   * @param cause - The underlying error that caused this failure
   */
  constructor(code: ErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'ZodJSONError';
    this.code = code;
    this.cause = cause;
  }
}
