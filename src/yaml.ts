import * as YAML from 'js-yaml';

import {
  type Serializer,
  type ZodFile,
  type ZodFileOptions,
  createZodFile,
} from './persistence';

const YAMLSerializer: Serializer = {
  formatName: 'YAML',
  parse(content: string): unknown {
    return YAML.load(content);
  },
  stringify(data: unknown, compact: boolean): string {
    return YAML.dump(data, {
      indent: compact ? 0 : 2,
      flowLevel: compact ? 0 : -1,
      lineWidth: compact ? -1 : 80,
    }).trimEnd();
  },
} as const;

/**
 * Creates a ZodFile persistence instance for type-safe YAML file operations.
 *
 * Requires the `js-yaml` package to be installed as a peer dependency.
 *
 * @typeParam V - The current schema version number
 * @typeParam T - The data type produced by the schema
 * @param options - Configuration options for the persistence instance
 * @returns A {@link ZodFile} instance with typed `load` and `save` methods
 * @throws {Error} If the migration chain is invalid (non-sequential or incomplete)
 *
 * @example Basic usage without versioning
 * ```typescript
 * import { z } from 'zod';
 * import { createZodYAML } from 'zod-file/yaml';
 *
 * const SettingsSchema = z.object({ theme: z.string() });
 * const settings = createZodYAML({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * const data = await settings.load('/path/to/settings.yaml');
 * await settings.save(data, '/path/to/settings.yaml');
 * ```
 *
 * @example Versioned schema with migrations
 * ```typescript
 * import { z } from 'zod';
 * import { createZodYAML } from 'zod-file/yaml';
 *
 * const SettingsSchemaV1 = z.object({ theme: z.string() });
 * const SettingsSchemaV2 = z.object({
 *   theme: z.string(),
 *   newField: z.string(),
 * });
 *
 * const settingsV2 = createZodYAML({
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   migrations: [
 *     { version: 1, schema: SettingsSchemaV1, migrate: (v1) => ({ ...v1, newField: 'default' }) },
 *   ],
 * });
 *
 * const data = await settingsV2.load('/path/to/settings.yaml');
 * ```
 */
export function createZodYAML<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodFileOptions<V, T>): ZodFile<T> {
  return createZodFile(options, YAMLSerializer);
}
