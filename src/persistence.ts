import fs from 'node:fs/promises';

import { ZodError, z } from 'zod';

import { ZodJSONError } from './errors';

/**
 * A migration step from version V to V+1.
 * TFrom is the data type at version V, TTo is the data type at version V+1.
 */
export type MigrationStep<V extends number, TFrom, TTo> = {
  version: V;
  schema: z.ZodType<TFrom>;
  migrate: (data: TFrom) => TTo | Promise<TTo>;
};

/**
 * Options for createZodJSON.
 * V is the current version number as a literal type.
 * T is the current version's data type.
 *
 * If migrations are provided, version must be defined.
 * If migrations are not provided, version can be undefined (and version field will be ignored in save/load).
 */
export type ZodJSONOptions<
  V extends number,
  T extends Record<string, unknown>,
> = {
  schema: z.ZodObject<any, any> & z.ZodType<T>;
  default?: T | (() => T);
  version?: V;
  migrations?: MigrationStep<number, unknown, unknown>[];
};

export type LoadOptions = {
  /** If true, throw even if a default is configured */
  throwOnError?: boolean;
};

export type SaveOptions = {
  /** If true, save without indentation */
  compact?: boolean;
};

export type ZodJSON<T> = {
  load(path: string, options?: LoadOptions): Promise<T>;
  save(data: T, path: string, options?: SaveOptions): Promise<void>;
};

/**
 * Creates a ZodJSON persistence instance for versioned JSON files with Zod validation.
 *
 * @param options - Configuration options
 * @returns A persistence instance with typed load and save methods
 *
 * @example
 * ```typescript
 * // Without version - version field is ignored in save/load
 * const SettingsSchema = z.object({ theme: z.string() });
 * const settings = createZodJSON({
 *   schema: SettingsSchema,
 *   default: { theme: 'light' },
 * });
 *
 * // With migrations - version must be explicitly provided
 * const settingsV2 = createZodJSON({
 *   version: 2 as const,
 *   schema: SettingsSchemaV2,
 *   migrations: [
 *     { version: 1, schema: SettingsSchemaV1, migrate: (v1) => ({ ...v1, newField: 'default' }) },
 *   ],
 * });
 *
 * const data = await settings.load('/path/to/settings.json');
 * await settings.save(data, '/path/to/settings.json');
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
