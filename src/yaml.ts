import { ZodStoreError } from './errors';
import {
  type Serializer,
  type ZodStore,
  type ZodStoreOptions,
  createZodStore,
} from './persistence';

/**
 * Type definition for the js-yaml module.
 * Used for dynamic import type safety.
 */
type JsYaml = typeof import('js-yaml');

/**
 * Cached reference to the js-yaml module.
 * Lazily loaded on first use.
 */
let jsYamlModule: JsYaml | undefined;

/**
 * Dynamically imports and caches the js-yaml module.
 * Throws a helpful error if js-yaml is not installed.
 *
 * @returns The js-yaml module
 * @throws {ZodStoreError} with code 'MissingDependency' if js-yaml is not installed
 */
async function getJsYaml(): Promise<JsYaml> {
  if (jsYamlModule !== undefined) {
    return jsYamlModule;
  }

  try {
    jsYamlModule = await import('js-yaml');
    return jsYamlModule;
  } catch {
    throw new ZodStoreError(
      'MissingDependency',
      'js-yaml is required for YAML support. Install it with: npm install js-yaml',
    );
  }
}

/**
 * Creates a YAML serializer that lazily loads js-yaml.
 * The serializer methods will throw if js-yaml is not installed.
 */
function createYAMLSerializer(): Serializer {
  let yaml: JsYaml | undefined;

  return {
    parse(content: string): unknown {
      if (yaml === undefined) {
        throw new ZodStoreError(
          'MissingDependency',
          'js-yaml must be loaded before parsing. This is an internal error.',
        );
      }
      return yaml.load(content);
    },
    stringify(data: unknown, compact: boolean): string {
      if (yaml === undefined) {
        throw new ZodStoreError(
          'MissingDependency',
          'js-yaml must be loaded before stringifying. This is an internal error.',
        );
      }
      return yaml.dump(data, {
        indent: compact ? 0 : 2,
        flowLevel: compact ? 0 : -1,
        lineWidth: compact ? -1 : 80,
      });
    },
    formatName: 'YAML',
  };
}

// Legacy type aliases for backwards compatibility
/** @deprecated Use ZodStore instead */
export type ZodYAML<T> = ZodStore<T>;
/** @deprecated Use ZodStoreOptions instead */
export type ZodYAMLOptions<
  V extends number,
  T extends Record<string, unknown>,
> = ZodStoreOptions<V, T>;

/**
 * Creates a ZodStore persistence instance for versioned YAML files with Zod validation.
 *
 * Requires the `js-yaml` package to be installed. If not installed, operations will
 * throw a `ZodStoreError` with code `'MissingDependency'`.
 *
 * @param options - Configuration options
 * @returns A persistence instance with typed load and save methods
 *
 * @example
 * ```typescript
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
  const yamlSerializer = createYAMLSerializer();
  const store = createZodStore(options, yamlSerializer);

  // Wrap load and save to ensure js-yaml is loaded first
  return {
    async load(path, loadOptions) {
      const yaml = await getJsYaml();
      // Inject the loaded yaml module into the serializer's closure
      Object.assign(yamlSerializer, {
        parse(content: string): unknown {
          return yaml.load(content);
        },
        stringify(data: unknown, compact: boolean): string {
          return yaml.dump(data, {
            indent: compact ? 0 : 2,
            flowLevel: compact ? 0 : -1,
            lineWidth: compact ? -1 : 80,
          });
        },
      });
      return store.load(path, loadOptions);
    },
    async save(data, path, saveOptions) {
      const yaml = await getJsYaml();
      // Inject the loaded yaml module into the serializer's closure
      Object.assign(yamlSerializer, {
        parse(content: string): unknown {
          return yaml.load(content);
        },
        stringify(dataToStringify: unknown, compact: boolean): string {
          return yaml.dump(dataToStringify, {
            indent: compact ? 0 : 2,
            flowLevel: compact ? 0 : -1,
            lineWidth: compact ? -1 : 80,
          });
        },
      });
      return store.save(data, path, saveOptions);
    },
  };
}
