/**
 * Error codes identifying the failure stage in ZodFile operations.
 *
 * Use these codes for programmatic error handling to determine what went wrong
 * during load or save operations.
 *
 * @example
 * ```typescript
 * import { ZodFileError } from 'zod-file';
 *
 * try {
 *   await store.load('./config.json', { throwOnError: true });
 * } catch (error) {
 *   if (error instanceof ZodFileError) {
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
  | 'FileRead' // File could not be read from disk
  | 'FileWrite' // File could not be written to disk
  | 'InvalidFormat' // File content is not valid (JSON, YAML, etc.)
  | 'InvalidVersion' // `_version` field is missing, not an integer, or ≤ 0
  | 'UnsupportedVersion' // File version is greater than the current schema version
  | 'Validation' // Data does not match the Zod schema
  | 'Migration' // A migration function threw an error
  | 'Encoding' // Schema encoding failed during save
  | 'MissingDependency'; // An optional dependency (like js-yaml) is not installed

/**
 * Error thrown by ZodFile operations.
 *
 * The `message` property contains a user-friendly description of the error.
 * The `code` property identifies the failure stage for programmatic handling.
 * The optional `cause` property contains the underlying error for debugging.
 *
 * @example
 * ```typescript
 * import { ZodFileError } from 'zod-file';
 *
 * try {
 *   await store.load('./config.json', { throwOnError: true });
 * } catch (error) {
 *   if (error instanceof ZodFileError) {
 *     console.error(`[${error.code}] ${error.message}`);
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class ZodFileError extends Error {
  /**
   * Error code identifying the failure stage.
   */
  readonly code: ErrorCode;

  /**
   * Creates a new ZodFileError.
   *
   * @param code - The error code identifying the failure stage
   * @param message - A user-friendly error message
   * @param cause - The underlying error that caused this failure
   */
  constructor(code: ErrorCode, message: string, cause?: Error) {
    super(message, { cause });
    this.name = 'ZodFileError';
    this.code = code;
  }
}
