/**
 * Error codes for different failure stages in ZodStore operations.
 */
export type ErrorCode =
  | 'FileRead' // File could not be read
  | 'FileWrite' // File could not be written
  | 'InvalidFormat' // File content is not valid JSON/YAML
  | 'InvalidVersion' // _version field missing, not an integer, or <= 0
  | 'UnsupportedVersion' // File version > current schema version
  | 'Validation' // Zod schema validation failed
  | 'Migration' // Migration function threw
  | 'Encoding' // Schema encoding failed
  | 'MissingDependency'; // Optional dependency not installed

/**
 * Error thrown by ZodStore operations.
 * The message is always user-friendly; callers can inspect `cause` for underlying details.
 */
export class ZodStoreError extends Error {
  /** The error code indicating what stage of the operation failed */
  code: ErrorCode;
  /** The underlying error that caused this error, if any */
  cause?: Error;

  constructor(code: ErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'ZodStoreError';
    this.code = code;
    this.cause = cause;
  }
}
