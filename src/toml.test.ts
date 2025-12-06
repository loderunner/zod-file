import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ZodFileError } from './errors';
import { createZodTOML } from './toml';

vi.mock('node:fs/promises');
const mockFsPromises = vi.mocked(fs);

const testFile = '/tmp/zod-file-test.toml';

describe('createZodTOML', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('basic load and save', () => {
    it('should save data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodTOML({ schema });

      await store.save({ name: 'Alice', age: 30 }, testFile);

      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      // Verify it's valid TOML by parsing it
      const TOML = await import('smol-toml');
      const parsed = TOML.parse(writtenContent);
      expect(parsed).toEqual({
        name: 'Alice',
        age: 30,
      });
    });

    it('should load data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodTOML({ schema });

      mockFsPromises.readFile.mockResolvedValue('name = "Alice"\nage = 30\n');

      const loaded = await store.load(testFile);
      expect(loaded).toEqual({ name: 'Alice', age: 30 });
    });

    it('should save/load cycle successfully', async () => {
      const schema = z.object({
        string: z.string(),
        number: z.number(),
        boolean: z.boolean(),
        array: z.array(z.string()),
        object: z.object({
          nested: z.string(),
        }),
      });

      const store = createZodTOML({ schema });

      const data = {
        string: 'test',
        number: 42,
        boolean: true,
        array: ['a', 'b', 'c'],
        object: { nested: 'value' },
      };

      await store.save(data, testFile);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      // Simulate loading the saved content
      mockFsPromises.readFile.mockResolvedValue(writtenContent);
      const loaded = await store.load(testFile);

      expect(loaded).toEqual(data);
    });
  });

  describe('TOML formatting', () => {
    it('should format TOML with indentation by default', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        nested: z.object({
          value: z.string(),
        }),
      });

      const store = createZodTOML({ schema });

      await store.save(
        { name: 'Alice', age: 30, nested: { value: 'test' } },
        testFile,
      );

      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      expect(writtenContent).toContain('\n');
      expect(writtenContent).toContain('name');
      expect(writtenContent).toContain('nested');
    });
  });

  describe('TOML parsing errors', () => {
    it('should throw InvalidFormat for malformed TOML', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodTOML({ schema });

      mockFsPromises.readFile.mockResolvedValue('invalid toml [[');

      await expect(store.load(testFile)).rejects.toThrow(ZodFileError);
      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidFormat',
      );
    });
  });
});
