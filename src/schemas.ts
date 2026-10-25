// Loads every JSON Schema in schemas/ and validates values by schema title (e.g. 'TelemetryMsg') or $id.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const SCHEMA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
export const SCHEMA_BASE = 'https://lumio.io/schemas/device/v1/';

export interface SchemaFile {
  file: string; // path relative to schemas/, e.g. 'mqtt/telemetry.json'
  id: string;
  title: string;
  schema: Record<string, unknown>;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}

export function loadSchemaFiles(): SchemaFile[] {
  return walk(SCHEMA_DIR).sort().map((path) => {
    const schema = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    return { file: relative(SCHEMA_DIR, path), id: String(schema.$id), title: String(schema.title), schema };
  });
}

let cached: { ajv: Ajv2020; byTitle: Map<string, SchemaFile> } | undefined;

export function schemaRegistry() {
  if (!cached) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
    addFormats.default(ajv);
    const files = loadSchemaFiles();
    for (const f of files) {
      ajv.addSchema(f.schema);
    }
    cached = { ajv, byTitle: new Map(files.map((f) => [f.title, f])) };
  }
  return cached;
}

export function validatorFor(titleOrId: string): ValidateFunction {
  const { ajv, byTitle } = schemaRegistry();
  const id = byTitle.get(titleOrId)?.id ?? titleOrId;
  const fn = ajv.getSchema(id);
  if (!fn) {
    throw new Error(`unknown schema ${titleOrId}`);
  }
  return fn;
}

export function validate(titleOrId: string, value: unknown): { ok: true } | { ok: false; errors: ErrorObject[] } {
  const fn = validatorFor(titleOrId);
  return fn(value) ? { ok: true } : { ok: false, errors: fn.errors ?? [] };
}
