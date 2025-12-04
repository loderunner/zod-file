/**
 * zod-store - Type-safe JSON persistence with Zod validation and schema migrations
 *
 * @packageDocumentation
 *
 * @example
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
 * const data = await settings.load('./settings.json');
 * await settings.save({ theme: 'dark', fontSize: 16 }, './settings.json');
 * ```
 */

export {
  type LoadOptions,
  type MigrationStep,
  type SaveOptions,
  type ZodJSON,
  type ZodJSONOptions,
  createZodJSON,
} from './persistence';

export { type ErrorCode, ZodJSONError } from './errors';
