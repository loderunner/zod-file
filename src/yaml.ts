import * as YAML from 'js-yaml';

import {
  type Serializer,
  type ZodStore,
  type ZodStoreOptions,
  createZodStore,
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
    });
  },
} as const;

/**
 * Creates a ZodStore persistence instance for versioned YAML files with Zod validation.
 *
 * Requires the `js-yaml` package to be installed as a peer dependency.
 *
 * @param options - Configuration options
 * @returns A persistence instance with typed load and save methods
 *
 * @example
 * ```typescript
 * import { createZodYAML } from 'zod-store/yaml';
 *
 * // Without version - version field is ignored in save/load
 * const SettingsSchema = z.object({ theme: z.string() });
 * const settings = createZodYAML({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * // With migrations - version must be explicitly provided
 * const settingsV2 = createZodYAML({
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   migrations: [
 *     { version: 1, schema: SettingsSchemaV1, migrate: (v1) => ({ ...v1, newField: 'default' }) },
 *   ],
 * });
 *
 * const data = await settings.load('/path/to/settings.yaml');
 * await settings.save(data, '/path/to/settings.yaml');
 * ```
 */
export function createZodYAML<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodStoreOptions<V, T>): ZodStore<T> {
  return createZodStore(options, YAMLSerializer);
}
