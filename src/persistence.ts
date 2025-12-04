import fs from 'node:fs/promises';

import { ZodError, z } from 'zod';

import { ZodJSONError } from './errors';

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
export type MigrationStep<V extends number, TFrom, TTo> = {
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
 * Configuration options for creating a ZodJSON persistence instance.
 *
 * @typeParam V - The current schema version number (literal type)
 * @typeParam T - The current schema's data type
 *
 * @example
 * ```typescript
 * // Without versioning
 * const options: ZodJSONOptions<number, Settings> = {
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * };
 *
 * // With versioning and migrations
 * const options: ZodJSONOptions<2, SettingsV2> = {
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   default: { theme: 'light', fontSize: 14 },
 *   migrations: [migrationV1toV2],
 * };
 * ```
 */
export type ZodJSONOptions<
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
  migrations?: MigrationStep<number, unknown, unknown>[];
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
   * the default value on errors (file missing, invalid JSON, validation
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
 * // Pretty-printed JSON (default)
 * await store.save(data, './config.json');
 *
 * // Compact JSON without indentation
 * await store.save(data, './config.json', { compact: true });
 * ```
 */
export type SaveOptions = {
  /**
   * If true, save JSON without indentation for smaller file size.
   *
   * @defaultValue false
   */
  compact?: boolean;
};

/**
 * A persistence instance for type-safe JSON file operations.
 *
 * Created by {@link createZodJSON}. Provides methods to load and save
 * JSON data with Zod validation and optional schema migrations.
 *
 * @typeParam T - The data type managed by this instance
 *
 * @example
 * ```typescript
 * import { createZodJSON, type ZodJSON } from 'zod-store';
 *
 * const store: ZodJSON<Settings> = createZodJSON({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * const data = await store.load('./settings.json');
 * await store.save({ theme: 'dark' }, './settings.json');
 * ```
 */
export type ZodJSON<T> = {
  /**
   * Loads and validates JSON data from a file.
   *
   * If the instance is configured with a version, applies any necessary
   * migrations to upgrade older data to the current schema version.
   *
   * @param path - Path to the JSON file
   * @param options - Load options
   * @returns The validated data
   * @throws {ZodJSONError} When loading fails and no default is configured, or when `throwOnError` is true
   */
  load(path: string, options?: LoadOptions): Promise<T>;

  /**
   * Saves data to a JSON file.
   *
   * If the instance is configured with a version, includes a `_version`
   * field in the output. Uses the schema's `encodeAsync` for serialization,
   * supporting custom transforms.
   *
   * @param data - The data to save (must match the schema)
   * @param path - Path to the JSON file
   * @param options - Save options
   * @throws {ZodJSONError} When encoding or writing fails
   */
  save(data: T, path: string, options?: SaveOptions): Promise<void>;
};

/**
 * Creates a ZodJSON persistence instance for type-safe JSON file operations.
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
 * @returns A {@link ZodJSON} instance with typed `load` and `save` methods
 * @throws {Error} If the migration chain is invalid (non-sequential or incomplete)
 *
 * @example Basic usage without versioning
 * ```typescript
 * import { z } from 'zod';
 * import { createZodJSON } from 'zod-store';
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
 * import { createZodJSON } from 'zod-store';
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
 * import { createZodJSON, ZodJSONError } from 'zod-store';
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
 *   if (error instanceof ZodJSONError) {
 *     console.error(`Error [${error.code}]: ${error.message}`);
 *   }
 * }
 * ```
 */
export function createZodJSON<
  V extends number,
  T extends Record<string, unknown>,
>(options: ZodJSONOptions<V, T>): ZodJSON<T> {
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
        throw new ZodJSONError(
          'FileRead',
          `Failed to read file: ${filePath}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      return getDefault();
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContent);
    } catch (error) {
      if (throwOnError || defaultValue === undefined) {
        throw new ZodJSONError(
          'InvalidJSON',
          `Invalid JSON in file: ${filePath}`,
          error instanceof SyntaxError ? error : new Error(String(error)),
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
          throw new ZodJSONError(
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
          throw new ZodJSONError(
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
          throw new ZodJSONError(
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
            throw new ZodJSONError(
              'Migration',
              `No migration found for version ${dataVersion} in file: ${filePath}`,
            );
          }
          return getDefault();
        }

        try {
          // Parse with migration's schema
          const parsedData = await migration.schema.parseAsync(data);

          // Run migration (handle both sync and async)
          const migrationResult = migration.migrate(parsedData);
          data = await Promise.resolve(migrationResult);

          dataVersion++;
        } catch (error) {
          if (throwOnError || defaultValue === undefined) {
            let message = `Migration from version ${dataVersion} failed in file: ${filePath}`;
            if (error instanceof ZodError) {
              message = `${message}\n${z.prettifyError(error)}`;
            }
            throw new ZodJSONError(
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
        throw new ZodJSONError(
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
      throw new ZodJSONError(
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

    // Stringify JSON
    const jsonString = compact
      ? JSON.stringify(fileData)
      : JSON.stringify(fileData, null, 2);

    // Write file
    try {
      await fs.writeFile(filePath, jsonString, 'utf-8');
    } catch (error) {
      throw new ZodJSONError(
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
