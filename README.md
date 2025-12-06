[![npm version](https://img.shields.io/npm/v/zod-file)](https://www.npmjs.com/package/zod-file)
[![CI status](https://github.com/loderunner/zod-file/actions/workflows/lint-test-build.yml/badge.svg)](https://github.com/loderunner/zod-file/actions)
[![bundle size](https://img.shields.io/bundlephobia/minzip/zod-file)](https://bundlephobia.com/package/zod-file)
[![license](https://img.shields.io/npm/l/zod-file)](LICENSE)
[![Ko-fi donate](https://img.shields.io/badge/Ko--fi-donate-ff5f5f?logo=ko-fi&logoColor=white)](https://ko-fi.com/loderunner)
[![NPM Trusted Publishing](https://img.shields.io/badge/NPM-Trusted%20Publishing-success?logo=npm)](https://www.npmjs.com/package/zod-file#provenance-details-header)

# zod-file

A type-safe file persistence library with [Zod](https://zod.dev) validation and
schema migrations for Node.js. Supports JSON out of the box, and YAML and TOML
with optional dependencies.

## Features

- **Type-safe persistence** – Load and save files with full TypeScript type
  inference
- **Multiple formats** – JSON built-in, YAML with optional `js-yaml` dependency,
  TOML with optional `smol-toml` dependency
- **Zod validation** – Validate data against Zod schemas on every load
- **Schema migrations** – Migrate data between versions with a simple,
  sequential migration chain
- **Default values** – Gracefully handle missing or invalid files with
  configurable defaults
- **Codec support** – Works with Zod's `encodeAsync` for custom serialization
  transforms

## Installation

```bash
pnpm add zod-file
```

```bash
npm install zod-file
```

```bash
yarn add zod-file
```

### YAML Support (Optional)

To use YAML files, install `js-yaml`:

```bash
pnpm add js-yaml
```

### TOML Support (Optional)

To use TOML files, install `smol-toml`:

```bash
pnpm add smol-toml
```

## Quick Start

### JSON

```typescript
import { z } from 'zod';
import { createZodJSON } from 'zod-file/json';

// Define your schema
const SettingsSchema = z.object({
  theme: z.enum(['light', 'dark']),
  fontSize: z.number().min(8).max(72),
});

// Create a persistence instance
const settings = createZodJSON({
  schema: SettingsSchema,
  default: { theme: 'light', fontSize: 14 },
});

// Load and save data
const data = await settings.load('./settings.json');
console.log(data.theme); // 'light' or 'dark'

await settings.save({ theme: 'dark', fontSize: 16 }, './settings.json');
```

### YAML

```typescript
import { z } from 'zod';
import { createZodYAML } from 'zod-file/yaml';

const ConfigSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number(),
  }),
  features: z.array(z.string()),
});

const config = createZodYAML({
  schema: ConfigSchema,
  default: {
    database: { host: 'localhost', port: 5432 },
    features: [],
  },
});

const data = await config.load('./config.yaml');
await config.save(data, './config.yaml');
```

### TOML

```typescript
import { z } from 'zod';
import { createZodTOML } from 'zod-file/toml';

const ConfigSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number(),
  }),
  features: z.array(z.string()),
});

const config = createZodTOML({
  schema: ConfigSchema,
  default: {
    database: { host: 'localhost', port: 5432 },
    features: [],
  },
});

const data = await config.load('./config.toml');
await config.save(data, './config.toml');
```

## API

### `createZodJSON(options)`

Creates a persistence instance for typed JSON files.

### `createZodYAML(options)`

Creates a persistence instance for typed YAML files. Requires `js-yaml` to be
installed.

### `createZodTOML(options)`

Creates a persistence instance for typed TOML files. Requires `smol-toml` to be
installed.

### `createZodFile(options, serializer)`

Creates a persistence instance with a custom serializer. Use this to add support
for other file formats.

#### Options

| Property     | Type              | Required | Description                                                  |
| ------------ | ----------------- | -------- | ------------------------------------------------------------ |
| `schema`     | `z.ZodObject`     | Yes      | The Zod schema for validating data                           |
| `default`    | `T \| () => T`    | No       | Default value or factory when file is missing/invalid        |
| `version`    | `number`          | No\*     | Current schema version (required if migrations are provided) |
| `migrations` | `MigrationStep[]` | No       | Array of migration steps                                     |

#### Returns

A `ZodFile<T>` object with:

- `load(path, options?)` – Load and validate data from a file
- `save(data, path, options?)` – Save data to a file

### `load(path, options?)`

Loads data from a file, applies migrations if needed, and validates against the
schema.

If a default is configured and loading fails for any reason (file missing,
invalid format, validation error, etc.), returns the default value instead of
throwing. Use `throwOnError: true` to throw errors even when a default is
configured.

#### Options

| Property       | Type      | Default | Description                                    |
| -------------- | --------- | ------- | ---------------------------------------------- |
| `throwOnError` | `boolean` | `false` | Throw errors even when a default is configured |

### `save(data, path, options?)`

Encodes data using the schema and writes it to a file.

#### Options

| Property  | Type      | Default | Description              |
| --------- | --------- | ------- | ------------------------ |
| `compact` | `boolean` | `false` | Save without indentation |

## Versioned Schemas and Migrations

When your data schema evolves over time, use versioned schemas with migrations
to handle backward compatibility.

```typescript
import { z } from 'zod';
import { createZodJSON } from 'zod-file/json';

// Version 1 schema (historical)
const SettingsV1 = z.object({
  theme: z.string(),
});

// Version 2 schema (current)
const SettingsV2 = z.object({
  theme: z.enum(['light', 'dark']),
  accentColor: z.string(),
});

const settings = createZodJSON({
  version: 2 as const,
  schema: SettingsV2,
  migrations: [
    {
      version: 1,
      schema: SettingsV1,
      migrate: (v1) => ({
        theme: v1.theme === 'dark' ? 'dark' : 'light',
        accentColor: '#0066cc',
      }),
    },
  ],
});
```

### Migration Rules

1. **Sequential versioning** – Migrations must form a sequential chain starting
   from version 1
2. **Chain completeness** – The last migration must be for version
   `currentVersion - 1`
3. **Version field** – Files include a `_version` field that is managed
   automatically

### File Format

When using versions, files are saved with a `_version` field:

**JSON:**

```json
{
  "_version": 2,
  "theme": "dark",
  "accentColor": "#0066cc"
}
```

**YAML:**

```yaml
_version: 2
theme: dark
accentColor: '#0066cc'
```

**TOML:**

```toml
_version = 2
theme = "dark"
accentColor = "#0066cc"
```

When not using versions, the data is saved as-is without wrapping.

## Error Handling

All errors are thrown as `ZodFileError` with a specific `code` for programmatic
handling:

```typescript
import { ZodFileError } from 'zod-file';

try {
  const data = await settings.load('./settings.json');
} catch (error) {
  if (error instanceof ZodFileError) {
    switch (error.code) {
      case 'FileRead':
        console.error('Could not read file:', error.message);
        break;
      case 'InvalidFormat':
        console.error('File contains invalid JSON/YAML/TOML:', error.message);
        break;
      case 'InvalidVersion':
        console.error('Missing or invalid _version field:', error.message);
        break;
      case 'UnsupportedVersion':
        console.error('File version is newer than schema:', error.message);
        break;
      case 'Validation':
        console.error('Data does not match schema:', error.message);
        break;
      case 'Migration':
        console.error('Migration failed:', error.message);
        break;
      case 'MissingDependency':
        console.error('Optional dependency not installed:', error.message);
        break;
    }
  }
}
```

### Accessing the Underlying Error

The `cause` property contains the original error that triggered the failure.
This is useful for debugging or extracting detailed validation errors from Zod:

```typescript
import { ZodFileError } from 'zod-file';
import { ZodError } from 'zod';

try {
  const data = await settings.load('./settings.json');
} catch (error) {
  if (error instanceof ZodFileError && error.code === 'Validation') {
    if (error.cause instanceof ZodError) {
      // Access Zod's detailed validation errors
      for (const issue of error.cause.issues) {
        console.error(`${issue.path.join('.')}: ${issue.message}`);
      }
    }
  }
}
```

### Error Codes

| Code                 | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `FileRead`           | File could not be read from disk                                        |
| `FileWrite`          | File could not be written to disk                                       |
| `InvalidFormat`      | File content is not valid                                               |
| `InvalidVersion`     | `_version` field is missing, not an integer, or ≤ 0                     |
| `UnsupportedVersion` | File version is greater than the current schema version                 |
| `Validation`         | Data does not match the Zod schema                                      |
| `Migration`          | A migration function threw an error                                     |
| `Encoding`           | Schema encoding failed during save                                      |
| `MissingDependency`  | An optional dependency (like `js-yaml` or `smol-toml`) is not installed |

## Advanced Usage

### Custom Serializers

Create your own serializer to support other file formats:

```typescript
import { createZodFile, type Serializer } from 'zod-file';

const tomlSerializer: Serializer = {
  parse(content) {
    return parseToml(content);
  },
  stringify(data, compact) {
    return stringifyToml(data);
  },
  formatName: 'TOML',
};

const config = createZodFile({ schema: ConfigSchema }, tomlSerializer);
```

### Async Migrations

Migration functions can be async for complex transformations:

```typescript
const settings = createZodJSON({
  version: 2 as const,
  schema: SettingsV2,
  migrations: [
    {
      version: 1,
      schema: SettingsV1,
      migrate: async (v1) => {
        // Perform async operations if needed
        const defaultAccent = await fetchDefaultAccentColor();
        return {
          theme: v1.theme === 'dark' ? 'dark' : 'light',
          accentColor: defaultAccent,
        };
      },
    },
  ],
});
```

### Default Value Factory

Use a factory function for defaults that should be computed fresh each time:

```typescript
const settings = createZodJSON({
  schema: SettingsSchema,
  default: () => ({
    theme: 'light',
    lastOpened: new Date().toISOString(),
  }),
});
```

### Compact Output

Save without indentation for smaller file sizes:

```typescript
await settings.save(data, './settings.json', { compact: true });
```

## License

Apache-2.0
