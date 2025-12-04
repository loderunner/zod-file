import {
  Serializer,
  ZodStore,
  ZodStoreOptions,
  createZodStore,
} from './persistence';

/**
 * Built-in JSON serializer.
 *
 * Uses `JSON.parse` and `JSON.stringify` with 2-space indentation
 * for pretty output, or no indentation when compact is true.
 */
export const jsonSerializer: Serializer = {
  formatName: 'JSON',
  parse(content: string): unknown {
    return JSON.parse(content);
  },
  stringify(data: unknown, compact: boolean): string {
    return compact ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  },
};

/**
 * Creates a ZodStore persistence instance for type-safe JSON file operations.
 *
 * The returned instance provides `load` and `save` methods that handle:
 * - Reading and writing JSON files
 * - Validating data against a Zod schema
 * - Applying sequential migrations for versioned schemas
 * - Returning default values on errors (when configured)
 *
 * @typeParam V - The current schema version number
 * @typeParam T - The data type produced by the schema
 * @param options - Configuration options for the persistence instance
 * @returns A {@link ZodStore} instance with typed `load` and `save` methods
 * @throws {Error} If the migration chain is invalid (non-sequential or incomplete)
 *
 * @example Basic usage without versioning
 * ```typescript
 * import { z } from 'zod';
 * import { createZodJSON } from 'zod-store/json';
 *
 * const SettingsSchema = z.object({
 *   theme: z.enum(['light', 'dark']),
 *   fontSize: z.number(),
 * });
 *
 * const settings = createZodJSON({
 *   schema: SettingsSchema,
 *   default: { theme: 'light', fontSize: 14 },
 * });
 *
 * // Load returns default if file doesn't exist
 * const data = await settings.load('./settings.json');
 * console.log(data.theme); // 'light'
 *
 * // Save writes JSON to disk
 * await settings.save({ theme: 'dark', fontSize: 16 }, './settings.json');
 * ```
 *
 * @example Versioned schema with migrations
 * ```typescript
 * import { z } from 'zod';
 * import { createZodJSON } from 'zod-store/json';
 *
 * // Historical schema (v1)
 * const SettingsV1 = z.object({ theme: z.string() });
 *
 * // Current schema (v2)
 * const SettingsV2 = z.object({
 *   theme: z.enum(['light', 'dark']),
 *   accentColor: z.string(),
 * });
 *
 * const settings = createZodJSON({
 *   version: 2 as const,
 *   schema: SettingsV2,
 *   migrations: [
 *     {
 *       version: 1,
 *       schema: SettingsV1,
 *       migrate: (v1) => ({
 *         theme: v1.theme === 'dark' ? 'dark' : 'light',
 *         accentColor: '#0066cc',
 *       }),
 *     },
 *   ],
 * });
 *
 * // Automatically migrates v1 files to v2 on load
 * const data = await settings.load('./settings.json');
 * ```
 *
 * @example Error handling
 * ```typescript
 * import { ZodStoreError } from 'zod-store';
 * import { createZodJSON } from 'zod-store/json';
 *
 * const settings = createZodJSON({
 *   schema: SettingsSchema,
 *   default: { theme: 'light', fontSize: 14 },
 * });
 *
 * try {
 *   // throwOnError: true ignores the default and throws instead
 *   const data = await settings.load('./settings.json', { throwOnError: true });
 * } catch (error) {
 *   if (error instanceof ZodStoreError) {
 *     console.error(`Error [${error.code}]: ${error.message}`);
 *   }
 * }
 * ```
 */
export function createZodJSON<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodStoreOptions<V, T>): ZodStore<T> {
  return createZodStore(options, jsonSerializer);
}
