import fs from 'node:fs/promises';

import { Mocked, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ZodFileError } from './errors';
import {
  type MigrationStep,
  type Serializer,
  createZodFile,
} from './persistence';

vi.mock('node:fs/promises');
const mockFsPromises = vi.mocked(fs);

/**
 * Simple serializer for testing.
 */
const mockSerializer: Mocked<Serializer> = {
  formatName: 'Test',
  parse: vi.fn(),
  stringify: vi.fn(),
};

const testFile = '/tmp/zod-file-test.json';

const stringToBool = z.codec(z.string(), z.boolean(), {
  decode: (str) => str.toLowerCase() === 'true' || str.toLowerCase() === 'yes',
  encode: (bool) => bool.toString(),
});

describe('createZodFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('basic load and save', () => {
    it('should save data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      const serializedOutput = '<serialized-output-save-test-1>';
      mockSerializer.stringify.mockReturnValue(serializedOutput);
      const data = { name: 'Alice', age: 30 };
      await store.save(data, testFile);

      expect(mockSerializer.stringify).toHaveBeenCalledWith(data, false);
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        testFile,
        serializedOutput,
        'utf-8',
      );
    });

    it('should load data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      const fileContent = '<file-content-load-test-1>';
      mockFsPromises.readFile.mockResolvedValue(fileContent);
      mockSerializer.parse.mockReturnValue({ name: 'Alice', age: 30 });

      const loaded = await store.load(testFile);
      expect(loaded).toEqual({ name: 'Alice', age: 30 });
      expect(mockSerializer.parse).toHaveBeenCalledWith(fileContent);
      expect(mockFsPromises.readFile).toHaveBeenCalledWith(testFile, 'utf-8');
    });
  });

  describe('default values', () => {
    it('should return default when file does not exist', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const defaultData = { theme: 'light' };
      const store = createZodFile(
        { schema, default: defaultData },
        mockSerializer,
      );

      mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));

      const loaded = await store.load(testFile);
      expect(loaded).toEqual(defaultData);
    });

    it('should return default when file is invalid format', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const defaultData = { theme: 'light' };
      const store = createZodFile(
        { schema, default: defaultData },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue('<invalid-format-default-1>');
      mockSerializer.parse.mockImplementation(() => {
        throw new Error('Invalid format');
      });

      const loaded = await store.load(testFile);
      expect(loaded).toEqual(defaultData);
    });

    it('should return default when data does not match schema', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const defaultData = { theme: 'light' };
      const store = createZodFile(
        { schema, default: defaultData },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-default-schema-1>',
      );
      mockSerializer.parse.mockReturnValue({ invalid: 'data' });

      const loaded = await store.load(testFile);
      expect(loaded).toEqual(defaultData);
    });

    it('should use default factory function', async () => {
      let callCount = 0;
      const schema = z.object({
        callId: z.number(),
      });

      const store = createZodFile(
        {
          schema,
          default: () => {
            callCount++;
            return { callId: callCount };
          },
        },
        mockSerializer,
      );

      mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));

      const loaded1 = await store.load(testFile);
      const loaded2 = await store.load(testFile);

      expect(loaded1.callId).toBe(1);
      expect(loaded2.callId).toBe(2);
      expect(loaded1.callId).not.toBe(loaded2.callId);
    });

    it('should throw when no default and file does not exist', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'FileRead',
      );
    });
  });

  describe('throwOnError option', () => {
    it('should throw even with default when throwOnError is true', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, default: { theme: 'light' } },
        mockSerializer,
      );

      mockFsPromises.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        store.load(testFile, { throwOnError: true }),
      ).rejects.toThrowZodFileError('FileRead');
    });

    it('should throw on invalid format even with default when throwOnError is true', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, default: { theme: 'light' } },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue('<invalid-format-default-1>');
      mockSerializer.parse.mockImplementation(() => {
        throw new Error('Invalid format');
      });

      await expect(
        store.load(testFile, { throwOnError: true }),
      ).rejects.toThrowZodFileError('InvalidFormat');
    });
  });

  describe('compact option', () => {
    it('should save with indentation by default', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      await store.save({ name: 'Alice' }, testFile);

      expect(mockSerializer.stringify).toHaveBeenCalledWith(
        { name: 'Alice' },
        false,
      );
    });

    it('should save without indentation when compact is true', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      await store.save({ name: 'Alice' }, testFile, { compact: true });

      expect(mockSerializer.stringify).toHaveBeenCalledWith(
        { name: 'Alice' },
        true,
      );
    });
  });

  describe('versioning', () => {
    it('should include _version field when version is configured', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      await store.save({ theme: 'dark' }, testFile);

      expect(mockSerializer.stringify).toHaveBeenCalledWith(
        { _version: 1, theme: 'dark' },
        false,
      );
    });

    it('should not include _version field when version is not configured', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      await store.save({ theme: 'dark' }, testFile);

      expect(mockSerializer.stringify).toHaveBeenCalledWith(
        { theme: 'dark' },
        false,
      );
    });

    it('should load versioned file without migrations', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue('<file-content-versioned-1>');
      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      const loaded = await store.load(testFile);

      expect(loaded.theme).toBe('dark');
    });

    it('should throw when _version field is missing in versioned mode', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-version-missing-1>',
      );
      mockSerializer.parse.mockReturnValue({ theme: 'dark' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidVersion',
      );
    });

    it('should throw when _version is not a number', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-version-string-1>',
      );
      mockSerializer.parse.mockReturnValue({
        _version: 'invalid',
        theme: 'dark',
      });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidVersion',
      );
    });

    it('should throw when _version is not an integer', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-version-float-1>',
      );
      mockSerializer.parse.mockReturnValue({ _version: 1.5, theme: 'dark' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidVersion',
      );
    });

    it('should throw when _version is <= 0', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-version-zero-1>',
      );
      mockSerializer.parse.mockReturnValue({ _version: 0, theme: 'dark' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidVersion',
      );
    });

    it('should throw when file version is greater than current version', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile(
        { schema, version: 1 as const },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-version-future-1>',
      );
      mockSerializer.parse.mockReturnValue({ _version: 2, theme: 'dark' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'UnsupportedVersion',
      );
    });
  });

  describe('migrations', () => {
    it('should apply single migration', async () => {
      const SettingsV1Schema = z.object({ theme: z.string() });
      const SettingsV2Schema = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });
      type SettingsV1 = z.infer<typeof SettingsV1Schema>;
      type SettingsV2 = z.infer<typeof SettingsV2Schema>;

      const migration: MigrationStep<1, SettingsV1, SettingsV2> = {
        version: 1,
        schema: SettingsV1Schema,
        migrate: vi.fn(
          (v1: SettingsV1) =>
            ({
              theme: v1.theme === 'dark' ? 'dark' : 'light',
              fontSize: 14,
            }) as SettingsV2,
        ),
      };

      const store = createZodFile(
        {
          version: 2 as const,
          schema: SettingsV2Schema,
          migrations: [migration],
        },
        mockSerializer,
      );

      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      const loaded = await store.load(testFile);
      expect(migration.migrate).toHaveBeenCalledWith({ theme: 'dark' });
      expect(loaded.theme).toBe('dark');
      expect(loaded.fontSize).toBe(14);
    });

    it('should apply multiple migrations in sequence', async () => {
      const SettingsV1Schema = z.object({ theme: z.string() });
      const SettingsV2Schema = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });
      const SettingsV3Schema = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
        accentColor: z.string(),
      });
      type SettingsV1 = z.infer<typeof SettingsV1Schema>;
      type SettingsV2 = z.infer<typeof SettingsV2Schema>;
      type SettingsV3 = z.infer<typeof SettingsV3Schema>;

      const migration1: MigrationStep<1, SettingsV1, SettingsV2> = {
        version: 1,
        schema: SettingsV1Schema,
        migrate: vi.fn(
          (v1: SettingsV1) =>
            ({
              theme: v1.theme === 'dark' ? 'dark' : 'light',
              fontSize: 14,
            }) as SettingsV2,
        ),
      };

      const migration2: MigrationStep<2, SettingsV2, SettingsV3> = {
        version: 2,
        schema: SettingsV2Schema,
        migrate: vi.fn(
          (v2: SettingsV2) =>
            ({
              ...v2,
              accentColor: '#0066cc',
            }) as SettingsV3,
        ),
      };

      const store = createZodFile(
        {
          version: 3 as const,
          schema: SettingsV3Schema,
          migrations: [migration1, migration2],
        },
        mockSerializer,
      );

      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      const loaded = await store.load(testFile);
      expect(migration1.migrate).toHaveBeenCalledWith({ theme: 'dark' });
      expect(migration2.migrate).toHaveBeenCalledWith({
        theme: 'dark',
        fontSize: 14,
      });
      expect(loaded.theme).toBe('dark');
      expect(loaded.fontSize).toBe(14);
      expect(loaded.accentColor).toBe('#0066cc');
    });

    it('should handle async migrations', async () => {
      const SettingsV1 = z.object({ theme: z.string() });
      const SettingsV2 = z.object({
        theme: z.enum(['light', 'dark']),
        timestamp: z.string(),
      });

      const migration: MigrationStep<
        1,
        z.infer<typeof SettingsV1>,
        z.infer<typeof SettingsV2>
      > = {
        version: 1,
        schema: SettingsV1,
        migrate: async (v1) => {
          await new Promise((resolve) => setImmediate(resolve));
          return {
            theme: v1.theme === 'dark' ? 'dark' : 'light',
            timestamp: new Date().toISOString(),
          };
        },
      };

      const store = createZodFile(
        {
          version: 2 as const,
          schema: SettingsV2,
          migrations: [migration],
        },
        mockSerializer,
      );

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-migration-async-1>',
      );
      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      const loaded = await store.load(testFile);
      expect(loaded.theme).toBe('dark');
      expect(typeof loaded.timestamp).toBe('string');
    });

    it('should throw when migration chain is not sequential', () => {
      const schema = z.object({ theme: z.string() });

      expect(() => {
        createZodFile(
          {
            version: 3 as const,
            schema,
            migrations: [
              {
                version: 1,
                schema: z.object({}),
                migrate: () => ({}),
              },
              {
                version: 3, // Should be 2
                schema: z.object({}),
                migrate: () => ({}),
              },
            ],
          },
          mockSerializer,
        );
      }).toThrow(/migration/i);
    });

    it('should throw when migration chain does not start at version 1', () => {
      const schema = z.object({ theme: z.string() });

      expect(() => {
        createZodFile(
          {
            version: 3 as const,
            schema,
            migrations: [
              {
                version: 2, // Should start at 1
                schema: z.object({}),
                migrate: () => ({}),
              },
            ],
          },
          mockSerializer,
        );
      }).toThrow(/migration/i);
    });

    it('should throw when migration chain does not end at currentVersion - 1', () => {
      const schema = z.object({ theme: z.string() });

      expect(() => {
        createZodFile(
          {
            version: 3 as const,
            schema,
            migrations: [
              {
                version: 1,
                schema: z.object({}),
                migrate: () => ({}),
              },
              // Missing version 2 migration
            ],
          },
          mockSerializer,
        );
      }).toThrow(/migration/i);
    });

    it('should throw when migrations are provided without version', () => {
      const schema = z.object({ theme: z.string() });

      expect(() => {
        createZodFile(
          {
            schema,
            migrations: [
              {
                version: 1,
                schema: z.object({}),
                migrate: () => ({}),
              },
            ],
          },
          mockSerializer,
        );
      }).toThrow(/migration/i);
    });

    it('should throw when migration validation fails', async () => {
      const SettingsV1 = z.object({ theme: z.string() });
      const SettingsV2 = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });

      const migration: MigrationStep<
        1,
        z.infer<typeof SettingsV1>,
        z.infer<typeof SettingsV2>
      > = {
        version: 1,
        schema: SettingsV1,
        migrate: (v1) => ({
          theme: v1.theme === 'dark' ? 'dark' : 'light',
          fontSize: 14,
        }),
      };

      const store = createZodFile(
        {
          version: 2 as const,
          schema: SettingsV2,
          migrations: [migration],
        },
        mockSerializer,
      );

      // File has invalid data for v1 schema
      mockSerializer.parse.mockReturnValue({ _version: 1, invalid: 'data' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'Migration',
      );
    });

    it('should throw when migration function throws', async () => {
      const SettingsV1 = z.object({ theme: z.string() });
      const SettingsV2 = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });

      const migration: MigrationStep<
        1,
        z.infer<typeof SettingsV1>,
        z.infer<typeof SettingsV2>
      > = {
        version: 1,
        schema: SettingsV1,
        migrate: () => {
          throw new Error('Migration failed');
        },
      };

      const store = createZodFile(
        {
          version: 2 as const,
          schema: SettingsV2,
          migrations: [migration],
        },
        mockSerializer,
      );

      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'Migration',
      );
    });

    it('should return default when migration fails and default is configured', async () => {
      const SettingsV1 = z.object({ theme: z.string() });
      const SettingsV2 = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });

      const migration: MigrationStep<
        1,
        z.infer<typeof SettingsV1>,
        z.infer<typeof SettingsV2>
      > = {
        version: 1,
        schema: SettingsV1,
        migrate: () => {
          throw new Error('Migration failed');
        },
      };

      const defaultData = { theme: 'light' as const, fontSize: 14 };
      const store = createZodFile(
        {
          version: 2 as const,
          schema: SettingsV2,
          migrations: [migration],
          default: defaultData,
        },
        mockSerializer,
      );

      mockSerializer.parse.mockReturnValue({ _version: 1, theme: 'dark' });

      const loaded = await store.load(testFile);
      expect(loaded).toEqual(defaultData);
    });
  });

  describe('schema validation', () => {
    it('should validate data against schema on load', async () => {
      const schema = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number().min(8).max(72),
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockSerializer.parse.mockReturnValue({ theme: 'invalid', fontSize: 100 });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'Validation',
      );
    });

    it('should use schema encode for save', async () => {
      const schema = z.object({
        value: z.string(),
        valid: stringToBool,
      });

      const store = createZodFile({ schema }, mockSerializer);

      await store.save({ value: 'test', valid: true }, testFile);

      expect(mockSerializer.stringify).toHaveBeenCalledWith(
        { value: 'test', valid: 'true' },
        false,
      );
    });

    it('should use schema decode for load', async () => {
      const schema = z.object({
        value: z.string(),
        valid: stringToBool,
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockSerializer.parse.mockReturnValue({ value: 'test', valid: 'YES' });
      const loaded = await store.load(testFile);

      expect(loaded).toStrictEqual({ value: 'test', valid: true });
    });

    it('should throw when encoding fails', async () => {
      const schema = z.object({
        value: z.codec(z.number(), z.string(), {
          encode: (_str) => {
            throw new Error('Encoding failed');
          },
          decode: (num) => num.toString(),
        }),
      });

      const store = createZodFile({ schema }, mockSerializer);

      await expect(
        store.save({ value: 'test' }, testFile),
      ).rejects.toThrowZodFileError('Encoding');
    });

    it('should throw when decoding fails', async () => {
      const schema = z.object({
        value: z.codec(z.number(), z.string(), {
          encode: (str) => Number.parseInt(str),
          decode: (_num) => {
            throw new Error('Decoding failed');
          },
        }),
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockSerializer.parse.mockReturnValue({ value: 6 });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'Validation',
      );
    });
  });

  describe('error handling', () => {
    it('should throw ZodFileError with correct code on file read error', async () => {
      const schema = z.object({ theme: z.string() });
      const store = createZodFile({ schema }, mockSerializer);

      const nonExistentFile = '/nonexistent/path/file.json';
      const fileError = new Error('File not found');
      mockFsPromises.readFile.mockRejectedValue(fileError);

      await expect(store.load(nonExistentFile)).rejects.toThrowZodFileError(
        'FileRead',
      );
      // Also verify cause exists
      await expect(store.load(nonExistentFile)).rejects.toSatisfy(
        (error: unknown) => {
          return (
            error instanceof ZodFileError &&
            error.code === 'FileRead' &&
            error.cause instanceof Error
          );
        },
      );
    });

    it('should throw ZodFileError with correct code on file write error', async () => {
      const schema = z.object({ theme: z.string() });
      const store = createZodFile({ schema }, mockSerializer);

      const readOnlyFile = '/root/readonly.json';
      mockFsPromises.writeFile.mockRejectedValue(
        new Error('Permission denied'),
      );

      await expect(
        store.save({ theme: 'dark' }, readOnlyFile),
      ).rejects.toThrowZodFileError('FileWrite');
    });

    it('should include Zod error details in Validation error', async () => {
      const schema = z.object({
        theme: z.enum(['light', 'dark']),
        fontSize: z.number(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockFsPromises.readFile.mockResolvedValue(
        '<file-content-validation-details-1>',
      );
      mockSerializer.parse.mockReturnValue({
        theme: 'invalid',
        fontSize: 'not a number',
      });

      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'Validation',
      );
      await expect(store.load(testFile)).rejects.toSatisfy((error: unknown) => {
        return (
          error instanceof ZodFileError &&
          error.code === 'Validation' &&
          error.message.includes('Schema validation failed')
        );
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', async () => {
      const schema = z.object({});
      const store = createZodFile({ schema }, mockSerializer);

      mockFsPromises.readFile.mockResolvedValue('<file-content-empty-obj-1>');
      mockSerializer.parse.mockReturnValue({});

      await store.save({}, testFile);
      const loaded = await store.load(testFile);

      expect(loaded).toEqual({});
    });
  });
});
