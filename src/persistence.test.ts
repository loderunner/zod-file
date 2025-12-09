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
 * Test-only options for verifying serializer option passing.
 */
type TestLoadOptions = {
  testLoadOption?: string;
};

type TestSaveOptions = {
  testSaveOption?: number;
};

/**
 * Simple serializer for testing.
 */
const mockSerializer: Mocked<Serializer<TestLoadOptions, TestSaveOptions>> = {
  formatName: 'Test',
  decode: vi.fn(),
  encode: vi.fn(),
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

      const serializedOutput = Buffer.from(
        '<serialized-output-save-test-1>',
        'utf-8',
      );
      mockSerializer.encode.mockReturnValue(serializedOutput);
      const data = { name: 'Alice', age: 30 };
      await store.save(data, testFile);

      expect(mockSerializer.encode).toHaveBeenCalledWith(data, undefined);
      expect(mockFsPromises.writeFile).toHaveBeenCalledWith(
        testFile,
        serializedOutput,
      );
    });

    it('should load data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      const fileContent = Buffer.from('<file-content-load-test-1>', 'utf-8');
      mockFsPromises.readFile.mockResolvedValue(fileContent);
      mockSerializer.decode.mockReturnValue({ name: 'Alice', age: 30 });

      const loaded = await store.load(testFile);
      expect(loaded).toEqual({ name: 'Alice', age: 30 });
      expect(mockSerializer.decode).toHaveBeenCalledWith(
        fileContent,
        undefined,
      );
      expect(mockFsPromises.readFile).toHaveBeenCalledWith(testFile);
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

      mockFsPromises.readFile.mockResolvedValue(
        Buffer.from('<invalid-format-default-1>', 'utf-8'),
      );
      mockSerializer.decode.mockImplementation(() => {
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
        Buffer.from('<file-content-default-schema-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ invalid: 'data' });

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

      mockFsPromises.readFile.mockResolvedValue(
        Buffer.from('<invalid-format-default-1>', 'utf-8'),
      );
      mockSerializer.decode.mockImplementation(() => {
        throw new Error('Invalid format');
      });

      await expect(
        store.load(testFile, { throwOnError: true }),
      ).rejects.toThrowZodFileError('InvalidFormat');
    });
  });

  describe('custom serializer options', () => {
    describe('load options', () => {
      it('should pass load options to serializer parse', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const store = createZodFile({ schema }, mockSerializer);

        const fileContent = Buffer.from('<file-content>', 'utf-8');
        mockFsPromises.readFile.mockResolvedValue(fileContent);
        mockSerializer.decode.mockReturnValue({ name: 'Alice' });

        await store.load(testFile, { testLoadOption: 'test-value' });

        expect(mockSerializer.decode).toHaveBeenCalledWith(fileContent, {
          testLoadOption: 'test-value',
        });
      });

      it('should not pass throwOnError to serializer parse', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const store = createZodFile({ schema }, mockSerializer);

        const fileContent = Buffer.from('<file-content>', 'utf-8');
        mockFsPromises.readFile.mockResolvedValue(fileContent);
        mockSerializer.decode.mockReturnValue({ name: 'Alice' });

        await store.load(testFile, {
          throwOnError: true,
          testLoadOption: 'test-value',
        });

        expect(mockSerializer.decode).toHaveBeenCalledWith(fileContent, {
          testLoadOption: 'test-value',
        });
      });

      it('should pass undefined when no load options provided', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const store = createZodFile({ schema }, mockSerializer);

        const fileContent = Buffer.from('<file-content>', 'utf-8');
        mockFsPromises.readFile.mockResolvedValue(fileContent);
        mockSerializer.decode.mockReturnValue({ name: 'Alice' });

        await store.load(testFile);

        expect(mockSerializer.decode).toHaveBeenCalledWith(
          fileContent,
          undefined,
        );
      });
    });

    describe('save options', () => {
      it('should pass save options to serializer stringify', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const store = createZodFile({ schema }, mockSerializer);

        await store.save({ name: 'Alice' }, testFile, {
          testSaveOption: 42,
        });

        expect(mockSerializer.encode).toHaveBeenCalledWith(
          { name: 'Alice' },
          {
            testSaveOption: 42,
          },
        );
      });

      it('should pass undefined when no save options provided', async () => {
        const schema = z.object({
          name: z.string(),
        });

        const store = createZodFile({ schema }, mockSerializer);

        await store.save({ name: 'Alice' }, testFile);

        expect(mockSerializer.encode).toHaveBeenCalledWith(
          { name: 'Alice' },
          undefined,
        );
      });

      it('should pass save options with versioned data', async () => {
        const schema = z.object({
          theme: z.string(),
        });

        const store = createZodFile(
          { schema, version: 1 as const },
          mockSerializer,
        );

        await store.save({ theme: 'dark' }, testFile, {
          testSaveOption: 99,
        });

        expect(mockSerializer.encode).toHaveBeenCalledWith(
          { _version: 1, theme: 'dark' },
          {
            testSaveOption: 99,
          },
        );
      });
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

      expect(mockSerializer.encode).toHaveBeenCalledWith(
        { _version: 1, theme: 'dark' },
        undefined,
      );
    });

    it('should not include _version field when version is not configured', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodFile({ schema }, mockSerializer);

      await store.save({ theme: 'dark' }, testFile);

      expect(mockSerializer.encode).toHaveBeenCalledWith(
        { theme: 'dark' },
        undefined,
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

      mockFsPromises.readFile.mockResolvedValue(
        Buffer.from('<file-content-versioned-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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
        Buffer.from('<file-content-version-missing-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ theme: 'dark' });

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
        Buffer.from('<file-content-version-string-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({
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
        Buffer.from('<file-content-version-float-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ _version: 1.5, theme: 'dark' });

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
        Buffer.from('<file-content-version-zero-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ _version: 0, theme: 'dark' });

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
        Buffer.from('<file-content-version-future-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ _version: 2, theme: 'dark' });

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

      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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

      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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
        Buffer.from('<file-content-migration-async-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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
      mockSerializer.decode.mockReturnValue({ _version: 1, invalid: 'data' });

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

      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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

      mockSerializer.decode.mockReturnValue({ _version: 1, theme: 'dark' });

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

      mockSerializer.decode.mockReturnValue({
        theme: 'invalid',
        fontSize: 100,
      });

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

      expect(mockSerializer.encode).toHaveBeenCalledWith(
        { value: 'test', valid: 'true' },
        undefined,
      );
    });

    it('should use schema decode for load', async () => {
      const schema = z.object({
        value: z.string(),
        valid: stringToBool,
      });

      const store = createZodFile({ schema }, mockSerializer);

      mockSerializer.decode.mockReturnValue({ value: 'test', valid: 'YES' });
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

      mockSerializer.decode.mockReturnValue({ value: 6 });

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
        Buffer.from('<file-content-validation-details-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({
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

      mockFsPromises.readFile.mockResolvedValue(
        Buffer.from('<file-content-empty-obj-1>', 'utf-8'),
      );
      mockSerializer.decode.mockReturnValue({});

      await store.save({}, testFile);
      const loaded = await store.load(testFile);

      expect(loaded).toEqual({});
    });
  });
});
