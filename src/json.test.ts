import fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ZodFileError } from './errors';
import { createZodJSON } from './json';

vi.mock('node:fs/promises');
const mockFsPromises = vi.mocked(fs);

const testFile = '/tmp/zod-file-test.json';

describe('createZodJSON', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('basic load and save', () => {
    it('should save data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodJSON({ schema });

      await store.save({ name: 'Alice', age: 30 }, testFile);

      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      expect(JSON.parse(writtenContent)).toEqual({
        name: 'Alice',
        age: 30,
      });
    });

    it('should load data successfully', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const store = createZodJSON({ schema });

      mockFsPromises.readFile.mockResolvedValue('{"name":"Alice","age":30}');

      const loaded = await store.load(testFile);
      expect(loaded).toEqual({ name: 'Alice', age: 30 });
    });

    it('should save/load cycle successfully', async () => {
      const schema = z.object({
        string: z.string(),
        number: z.number(),
        boolean: z.boolean(),
        nullValue: z.null(),
        array: z.array(z.string()),
        object: z.object({
          nested: z.string(),
        }),
      });

      const store = createZodJSON({ schema });

      const data = {
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
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

  describe('JSON formatting', () => {
    it('should format JSON with indentation by default', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        nested: z.object({
          value: z.string(),
        }),
      });

      const store = createZodJSON({ schema });

      await store.save(
        { name: 'Alice', age: 30, nested: { value: 'test' } },
        testFile,
      );

      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      expect(writtenContent).toContain('\n');
      expect(writtenContent).toContain('  ');
    });

    it('should save compact JSON when compact option is true', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        nested: z.object({
          value: z.string(),
        }),
      });

      const store = createZodJSON({ schema });

      await store.save(
        { name: 'Alice', age: 30, nested: { value: 'test' } },
        testFile,
        { compact: true },
      );

      expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = mockFsPromises.writeFile.mock
        .calls[0]?.[1] as string;

      expect(writtenContent).not.toContain('\n');
      expect(writtenContent).not.toContain('  ');
    });
  });

  describe('JSON parsing errors', () => {
    it('should throw InvalidFormat for malformed JSON', async () => {
      const schema = z.object({
        theme: z.string(),
      });

      const store = createZodJSON({ schema });

      mockFsPromises.readFile.mockResolvedValue('not valid json');

      await expect(store.load(testFile)).rejects.toThrow(ZodFileError);
      await expect(store.load(testFile)).rejects.toThrowZodFileError(
        'InvalidFormat',
      );
    });
  });
});
