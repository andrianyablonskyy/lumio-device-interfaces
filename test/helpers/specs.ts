// Loads the OpenAPI / AsyncAPI documents and makes their schemas usable by the schema registry's Ajv instance:
// '../schemas/x.json' refs point at the schema $ids, '#/components/schemas/X' at the document's own $defs.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { SCHEMA_BASE, schemaRegistry } from '../../src/schemas.js';

export const ROOT = join(import.meta.dirname, '..', '..');
export type Json = Record<string, unknown>;

export function loadYaml(rel: string): Json {
  return parse(readFileSync(join(ROOT, rel), 'utf8')) as Json;
}

export function docId(rel: string): string {
  return `${SCHEMA_BASE}${rel.replace(/\.yaml$/, '.json')}`;
}

export function rewriteRefs(node: unknown, id: string): unknown {
  if (Array.isArray(node)) {
    return node.map((n) => rewriteRefs(n, id));
  }
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => {
      if (k === '$ref' && typeof v === 'string') {
        if (v.startsWith('../schemas/')) {
          return [k, SCHEMA_BASE + v.slice('../schemas/'.length)];
        }
        if (v.startsWith('#/components/schemas/')) {
          return [k, `${id}#/$defs/${v.slice('#/components/schemas/'.length)}`];
        }
      }
      return [k, rewriteRefs(v, id)];
    }));
  }
  return node;
}

// Registers components.schemas of an OpenAPI document under its $id and returns a compiler for inline schemas.
export function openapiSchemas(rel: string) {
  const doc = loadYaml(rel);
  const id = docId(rel);
  const { ajv } = schemaRegistry();
  if (!ajv.getSchema(id)) {
    const components = (doc.components as Json | undefined)?.schemas ?? {};
    ajv.addSchema({ $id: id, $defs: rewriteRefs(components, id) });
  }
  return { doc, id, compile: (schema: unknown) => ajv.compile(rewriteRefs(schema, id) as Json) };
}

// Resolves a local '#/a/b' JSON pointer inside a document.
export function pointer(doc: Json, ref: string): unknown {
  return ref.replace(/^#\//, '').split('/').reduce<unknown>((n, key) => (n as Json | undefined)?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
}

export function deref<T>(doc: Json, node: T): T {
  const ref = (node as { $ref?: unknown } | undefined)?.$ref;
  return typeof ref === 'string' && ref.startsWith('#/') ? deref(doc, pointer(doc, ref) as T) : node;
}

export const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export interface Operation {
  method: string;
  path: string;
  op: Json;
}

export function operations(doc: Json): Operation[] {
  return Object.entries(doc.paths as Record<string, Json>).flatMap(([path, item]) =>
    METHODS.filter((m) => item[m]).map((m) => ({ method: m.toUpperCase(), path, op: item[m] as Json })));
}

// Every JSON example of a request body or response, with the schema it must satisfy.
export interface ExampleCase {
  where: string;
  schema: unknown;
  value: unknown;
}

export function exampleCases(doc: Json, { method, path, op }: Operation): ExampleCase[] {
  const cases: ExampleCase[] = [];
  const collect = (where: string, content: Json | undefined) => {
    for (const [type, media] of Object.entries(content ?? {})) {
      const m = media as Json;
      if (!type.includes('json')) {
        continue;
      }
      for (const [name, ex] of Object.entries((m.examples ?? {}) as Json)) {
        cases.push({ where: `${method} ${path} ${where} ${name}`, schema: m.schema, value: (deref(doc, ex) as Json).value });
      }
    }
  };
  collect('request', (deref(doc, op.requestBody) as Json | undefined)?.content as Json | undefined);
  for (const [status, res] of Object.entries((op.responses ?? {}) as Json)) {
    collect(status, (deref(doc, res) as Json).content as Json | undefined);
  }
  return cases;
}

// All $ref strings in a document.
export function refs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((n) => refs(n, out));
  }
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string') {
        out.push(v);
      }
      else {
        refs(v, out);
      }
    }
  }
  return out;
}
