import * as TOML from 'smol-toml';

import {
  type Serializer,
  type ZodStore,
  type ZodStoreOptions,
  createZodStore,
} from './persistence';

const TOMLSerializer: Serializer = {
  formatName: 'TOML',
  parse(content: string): unknown {
    return TOML.parse(content);
  },
  stringify(data: unknown, _compact: boolean): string {
    return TOML.stringify(data);
  },
} as const;

/**
 * Creates a ZodStore persistence instance for type-safe TOML file operations.
 *
 * Requires the `smol-toml` package to be installed as a peer dependency.
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
 * import { createZodTOML } from 'zod-store/toml';
 *
 * const SettingsSchema = z.object({ theme: z.string() });
 * const settings = createZodTOML({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * const data = await settings.load('/path/to/settings.toml');
 * await settings.save(data, '/path/to/settings.toml');
 * ```
 *
 * @example Versioned schema with migrations
 * ```typescript
 * import { z } from 'zod';
 * import { createZodTOML } from 'zod-store/toml';
 *
 * const SettingsSchemaV1 = z.object({ theme: z.string() });
 * const SettingsSchemaV2 = z.object({
 *   theme: z.string(),
 *   newField: z.string(),
 * });
 *
 * const settingsV2 = createZodTOML({
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   migrations: [
 *     { version: 1, schema: SettingsSchemaV1, migrate: (v1) => ({ ...v1, newField: 'default' }) },
 *   ],
 * });
 *
 * const data = await settingsV2.load('/path/to/settings.toml');
 * ```
 */
export function createZodTOML<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodStoreOptions<V, T>): ZodStore<T> {
  return createZodStore(options, TOMLSerializer);
}
