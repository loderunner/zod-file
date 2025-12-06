/**
 * zod-file - Type-safe file persistence with Zod validation and schema migrations
 *
 * This module exports core types and the generic {@link createZodFile} factory.
 * For format-specific factories, use the subpath exports:
 * - `zod-file/json` for JSON files
 * - `zod-file/yaml` for YAML files (requires `js-yaml` peer dependency)
 * - `zod-file/toml` for TOML files (requires `smol-toml` peer dependency)
 *
 * @packageDocumentation
 *
 * @example JSON persistence
 * ```typescript
 * import { z } from 'zod';
 * import { createZodJSON } from 'zod-file/json';
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
 * const data = await settings.load('./settings.json');
 * await settings.save({ theme: 'dark', fontSize: 16 }, './settings.json');
 * ```
 *
 * @example YAML persistence (requires js-yaml)
 * ```typescript
 * import { z } from 'zod';
 * import { createZodYAML } from 'zod-file/yaml';
 *
 * const ConfigSchema = z.object({
 *   database: z.object({
 *     host: z.string(),
 *     port: z.number(),
 *   }),
 * });
 *
 * const config = createZodYAML({
 *   schema: ConfigSchema,
 *   default: { database: { host: 'localhost', port: 5432 } },
 * });
 *
 * const data = await config.load('./config.yaml');
 * await config.save(data, './config.yaml');
 * ```
 *
 * @example TOML persistence (requires smol-toml)
 * ```typescript
 * import { z } from 'zod';
 * import { createZodTOML } from 'zod-file/toml';
 *
 * const ConfigSchema = z.object({
 *   database: z.object({
 *     host: z.string(),
 *     port: z.number(),
 *   }),
 * });
 *
 * const config = createZodTOML({
 *   schema: ConfigSchema,
 *   default: { database: { host: 'localhost', port: 5432 } },
 * });
 *
 * const data = await config.load('./config.toml');
 * await config.save(data, './config.toml');
 * ```
 */

export {
  type LoadOptions,
  type MigrationStep,
  type SaveOptions,
  type Serializer,
  type ZodFile,
  type ZodFileOptions,
  createZodFile,
} from './persistence';

export { type ErrorCode, ZodFileError } from './errors';
