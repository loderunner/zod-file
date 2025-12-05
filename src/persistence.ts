import fs from 'node:fs/promises';

import { ZodError, z } from 'zod';

import { ZodStoreError } from './errors';

/**
 * A migration step that transforms data from one schema version to the next.
 *
 * Migration steps form a sequential chain, where each step transforms data
 * from version `V` to version `V+1`. The `schema` validates the input data
 * before the `migrate` function transforms it.
 *
 * @typeParam V - The source version number (data will be migrated to V+1)
 * @typeParam TFrom - The data type at version V
 * @typeParam TTo - The data type at version V+1
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import type { MigrationStep } from 'zod-store';
 *
 * const SettingsV1 = z.object({ theme: z.string() });
 * type SettingsV1 = z.infer<typeof SettingsV1>;
 *
 * const SettingsV2 = z.object({
 *   theme: z.enum(['light', 'dark']),
 *   fontSize: z.number(),
 * });
 * type SettingsV2 = z.infer<typeof SettingsV2>;
 *
 * const migrationV1toV2: MigrationStep<1, SettingsV1, SettingsV2> = {
 *   version: 1,
 *   schema: SettingsV1,
 *   migrate: (v1) => ({
 *     theme: v1.theme === 'dark' ? 'dark' : 'light',
 *     fontSize: 14,
 *   }),
 * };
 * ```
 */
export type MigrationStep<V extends number = number, TFrom = any, TTo = any> = {
  /**
   * The version number this migration migrates from.
   * Data at this version will be transformed to version `V+1`.
   */
  version: V;

  /**
   * The Zod schema for validating input data at version V.
   * Data is validated against this schema before the migrate function runs.
   */
  schema: z.ZodType<TFrom>;

  /**
   * Transforms data from version V to version V+1.
   * Can be synchronous or asynchronous.
   *
   * @param data - The validated data at version V
   * @returns The transformed data for version V+1
   */
  migrate: (data: TFrom) => TTo | Promise<TTo>;
};

/**
 * Configuration options for creating a ZodStore persistence instance.
 *
 * @typeParam V - The current schema version number (literal type)
 * @typeParam T - The current schema's data type
 *
 * @example
 * ```typescript
 * // Without versioning
 * const options: ZodStoreOptions<number, Settings> = {
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * };
 *
 * // With versioning and migrations
 * const options: ZodStoreOptions<2, SettingsV2> = {
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   default: { theme: 'light', fontSize: 14 },
 *   migrations: [migrationV1toV2],
 * };
 * ```
 */
export type ZodStoreOptions<
  V extends number,
  T extends Record<string, unknown>,
> = {
  /**
   * The Zod object schema for validating data.
   * Must be a `z.object()` schema that produces type T.
   */
  schema: z.ZodObject<any, any> & z.ZodType<T>;

  /**
   * Default value or factory to use when the file is missing or invalid.
   *
   * If a function is provided, it is called each time a default is needed,
   * allowing for dynamic defaults (e.g., including timestamps).
   *
   * When a default is configured and `throwOnError` is false (the default),
   * load operations will return this value instead of throwing on errors.
   */
  default?: T | (() => T);

  /**
   * The current schema version number.
   *
   * Required when migrations are provided. When set, files include a
   * `_version` field that is used to determine which migrations to apply.
   */
  version?: V;

  /**
   * Array of migration steps to upgrade data from older versions.
   *
   * Migrations must form a sequential chain starting from version 1
   * and ending at `version - 1`. Each migration transforms data from
   * version V to version V+1.
   */
  migrations?: MigrationStep[];
};

/**
 * Options for the `load` method.
 *
 * @example
 * ```typescript
 * // Return default on error (default behavior)
 * const data = await store.load('./config.json');
 *
 * // Always throw on error, even with default configured
 * const data = await store.load('./config.json', { throwOnError: true });
 * ```
 */
export type LoadOptions = {
  /**
   * If true, throw errors even when a default value is configured.
   *
   * By default, when a default is configured, load operations return
   * the default value on errors (file missing, invalid format, validation
   * failure, etc.). Set this to true to throw instead.
   *
   * @defaultValue false
   */
  throwOnError?: boolean;
};

/**
 * Options for the `save` method.
 *
 * @example
 * ```typescript
 * // Pretty-printed output (default)
 * await store.save(data, './config.json');
 *
 * // Compact output without indentation
 * await store.save(data, './config.json', { compact: true });
 * ```
 */
export type SaveOptions = {
  /**
   * If true, save without indentation for smaller file size.
   *
   * @defaultValue false
   */
  compact?: boolean;
};

/**
 * A persistence instance for type-safe file operations.
 *
 * Created by {@link createZodStore}, or the format-specific factories
 * `createZodJSON` (from `zod-store/json`) and `createZodYAML` (from `zod-store/yaml`).
 * Provides methods to load and save data with Zod validation and optional schema migrations.
 *
 * @typeParam T - The data type managed by this instance
 *
 * @example
 * ```typescript
 * import { type ZodStore } from 'zod-store';
 * import { createZodJSON } from 'zod-store/json';
 *
 * const store: ZodStore<Settings> = createZodJSON({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * const data = await store.load('./settings.json');
 * await store.save({ theme: 'dark' }, './settings.json');
 * ```
 */
export type ZodStore<T> = {
  /**
   * Loads and validates data from a file.
   *
   * If the instance is configured with a version, applies any necessary
   * migrations to upgrade older data to the current schema version.
   *
   * @param path - Path to the file
   * @param options - Load options
   * @returns The validated data
   * @throws {ZodStoreError} When loading fails and no default is configured, or when `throwOnError` is true
   */
  load(path: string, options?: LoadOptions): Promise<T>;

  /**
   * Saves data to a file.
   *
   * If the instance is configured with a version, includes a `_version`
   * field in the output. Uses the schema's `encodeAsync` for serialization,
   * supporting custom transforms.
   *
   * @param data - The data to save (must match the schema)
   * @param path - Path to the file
   * @param options - Save options
   * @throws {ZodStoreError} When encoding or writing fails
   */
  save(data: T, path: string, options?: SaveOptions): Promise<void>;
};

/**
 * A serializer that converts between data and string representation.
 *
 * Implement this interface to add support for custom file formats.
 * Built-in implementations are available via `zod-store/json` and `zod-store/yaml`.
 *
 * @example
 * ```typescript
 * import type { Serializer } from 'zod-store';
 *
 * const customSerializer: Serializer = {
 *   parse(content) {
 *     return myCustomParse(content);
 *   },
 *   stringify(data, compact) {
 *     return myCustomStringify(data, { compact });
 *   },
 *   formatName: 'MyFormat',
 * };
 * ```
 */
export type Serializer = {
  /**
   * Human-readable format name for error messages (e.g., "JSON", "YAML").
   */
  formatName: string;

  /**
   * Parses a string into data.
   *
   * @param content - The string content to parse
   * @returns The parsed data
   * @throws When the content is not valid for this format
   */
  parse(content: string): unknown;

  /**
   * Stringifies data to a string.
   *
   * @param data - The data to stringify
   * @param compact - Whether to use compact output (no indentation)
   * @returns The stringified data
   */
  stringify(data: unknown, compact: boolean): string;
};

/**
 * Creates a ZodStore persistence instance with a custom serializer.
 *
 * This is the core factory function used by {@link createZodJSON} and
 * `createZodYAML`. Use this directly if you need a custom file format.
 *
 * @typeParam V - The current schema version number
 * @typeParam T - The data type produced by the schema
 * @param options - Configuration options for the persistence instance
 * @param serializer - The serializer to use for parsing and stringifying
 * @returns A {@link ZodStore} instance with typed `load` and `save` methods
 * @throws {Error} If the migration chain is invalid (non-sequential or incomplete)
 *
 * @example
 * ```typescript
 * import { createZodStore, type Serializer } from 'zod-store';
 *
 * const mySerializer: Serializer = {
 *   parse: (s) => JSON.parse(s),
 *   stringify: (d, compact) => JSON.stringify(d, null, compact ? 0 : 2),
 *   formatName: 'JSON',
 * };
 *
 * const store = createZodStore({ schema: MySchema }, mySerializer);
 * ```
 */
export function createZodStore<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodStoreOptions<V, T>, serializer: Serializer): ZodStore<T> {
  const {
    version: currentVersion,
    schema,
    default: defaultValue,
    migrations = [],
  } = options;

  // Sort migrations by version ascending
  const sortedMigrations = [...migrations].sort(
    (a, b) => a.version - b.version,
  );

  // Validate migration chain is sequential
  for (let i = 0; i < sortedMigrations.length; i++) {
    const expectedVersion = i + 1;
    if (sortedMigrations[i].version !== expectedVersion) {
      throw new Error(
        `Migration chain must be sequential starting from version 1. Found version ${sortedMigrations[i].version} at position ${i}`,
      );
    }
  }

  // Validate migrations end at current version - 1
  if (sortedMigrations.length > 0) {
    if (currentVersion === undefined) {
      // This should be caught by TypeScript, but runtime check for safety
      throw new Error(
        'Version is required when migrations are provided. This should be caught by TypeScript.',
      );
    }
    const lastMigrationVersion =
      sortedMigrations[sortedMigrations.length - 1].version;
    if (lastMigrationVersion !== currentVersion - 1) {
      throw new Error(
        `Migration chain must end at version ${currentVersion - 1}, but last migration is for version ${lastMigrationVersion}`,
      );
    }
  }

  async function load(filePath: string, loadOptions?: LoadOptions): Promise<T> {
    const { throwOnError = false } = loadOptions ?? {};

    // Read file
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (throwOnError || defaultValue === undefined) {
        throw new ZodStoreError(
          'FileRead',
          `Failed to read file: ${filePath}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      return getDefault();
    }

    // Parse content
    let parsed: unknown;
    try {
      parsed = serializer.parse(fileContent);
    } catch (error) {
      if (throwOnError || defaultValue === undefined) {
        throw new ZodStoreError(
          'InvalidFormat',
          `Invalid ${serializer.formatName} in file: ${filePath}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      return getDefault();
    }

    let data: unknown;
    if (currentVersion !== undefined) {
      // Versioned mode: expect _version field
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('_version' in parsed)
      ) {
        if (throwOnError || defaultValue === undefined) {
          throw new ZodStoreError(
            'InvalidVersion',
            `Missing _version field in file: ${filePath}`,
          );
        }
        return getDefault();
      }

      const versionValue = parsed._version;
      if (
        typeof versionValue !== 'number' ||
        !Number.isInteger(versionValue) ||
        versionValue <= 0
      ) {
        if (throwOnError || defaultValue === undefined) {
          throw new ZodStoreError(
            'InvalidVersion',
            `Invalid _version field in file: ${filePath}. Expected integer > 0, got ${JSON.stringify(versionValue)}`,
          );
        }
        return getDefault();
      }
      const fileVersion = versionValue;

      // Check for unsupported future version
      if (fileVersion > currentVersion) {
        if (throwOnError || defaultValue === undefined) {
          throw new ZodStoreError(
            'UnsupportedVersion',
            `Unsupported file version ${fileVersion} in ${filePath}. Current schema version is ${currentVersion}`,
          );
        }
        return getDefault();
      }

      // Extract data (remove _version)
      const { _version: _unused, ...extractedData } = parsed as {
        _version: number;
        [key: string]: unknown;
      };
      data = extractedData;

      let dataVersion = fileVersion;
      while (dataVersion < currentVersion) {
        const migration = sortedMigrations.find(
          (m) => m.version === dataVersion,
        );

        if (migration === undefined) {
          if (throwOnError || defaultValue === undefined) {
            throw new ZodStoreError(
              'Migration',
              `No migration found for version ${dataVersion} in file: ${filePath}`,
            );
          }
          return getDefault();
        }

        try {
          // Parse with migration's schema
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const parsedData = await migration.schema.parseAsync(data);

          // Run migration (handle both sync and async)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const migrationResult = migration.migrate(parsedData);
          data = await Promise.resolve(migrationResult);

          dataVersion++;
        } catch (error) {
          if (throwOnError || defaultValue === undefined) {
            let message = `Migration from version ${dataVersion} failed in file: ${filePath}`;
            if (error instanceof ZodError) {
              message = `${message}\n${z.prettifyError(error)}`;
            }
            throw new ZodStoreError(
              'Migration',
              message,
              error instanceof Error ? error : new Error(String(error)),
            );
          }
          return getDefault();
        }
      }
    } else {
      data = parsed;
    }

    // Validate final data with current schema
    try {
      const result = await schema.parseAsync(data);
      return result;
    } catch (error) {
      if (throwOnError || defaultValue === undefined) {
        let message = `Schema validation failed for file: ${filePath}`;
        if (error instanceof ZodError) {
          message = `${message}\n${z.prettifyError(error)}`;
        }
        throw new ZodStoreError(
          'Validation',
          message,
          error instanceof ZodError ? error : new Error(String(error)),
        );
      }
      return getDefault();
    }
  }

  async function save(
    data: T,
    filePath: string,
    saveOptions?: SaveOptions,
  ): Promise<void> {
    const { compact = false } = saveOptions ?? {};

    // Encode data with schema (for codec support)
    // Use encodeAsync to support async transforms
    let encoded: unknown;
    try {
      encoded = await schema.encodeAsync(data);
    } catch (error) {
      let message = `Schema encoding failed for file: ${filePath}`;
      if (error instanceof ZodError) {
        message = `${message}\n${z.prettifyError(error)}`;
      }
      throw new ZodStoreError(
        'Encoding',
        message,
        error instanceof ZodError ? error : new Error(String(error)),
      );
    }

    // Wrap with version (only if version is configured)
    const fileData =
      currentVersion !== undefined
        ? {
            _version: currentVersion,
            ...(typeof encoded === 'object' && encoded !== null ? encoded : {}),
          }
        : encoded;

    // Stringify data
    const content = serializer.stringify(fileData, compact);

    // Write file
    try {
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new ZodStoreError(
        'FileWrite',
        `Failed to write file: ${filePath}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  function getDefault(): T {
    if (defaultValue === undefined) {
      throw new Error('No default value configured');
    }
    if (typeof defaultValue === 'function') {
      return defaultValue();
    }
    return defaultValue;
  }

  return {
    load,
    save,
  };
}
