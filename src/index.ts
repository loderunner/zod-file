/**
 * zod-store - Type-safe file persistence with Zod validation and schema migrations
 *
 * This module exports core types and the generic {@link createZodStore} factory.
 * For format-specific factories, use the subpath exports:
 * - `zod-store/json` for JSON files
 * - `zod-store/yaml` for YAML files (requires `js-yaml` peer dependency)
 *
 * @packageDocumentation
 *
 * @example JSON persistence
 * ```typescript
 * import { z } from 'zod';
 * import { createZodJSON } from 'zod-store/json';
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
 * import { createZodYAML } from 'zod-store/yaml';
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
 */

export {
  type LoadOptions,
  type MigrationStep,
  type SaveOptions,
  type Serializer,
  type ZodStore,
  type ZodStoreOptions,
  createZodStore,
} from './persistence';

export { type ErrorCode, ZodStoreError } from './errors';
