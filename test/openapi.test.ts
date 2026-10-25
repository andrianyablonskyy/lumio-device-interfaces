// Interface regression for the HTTP APIs: documents are valid OpenAPI 3.1, every operation is complete, and every
// JSON example satisfies its schema.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';
import { exampleCases, openapiSchemas, operations, refs, ROOT, type Json } from './helpers/specs.js';

const DOCS = ['openapi/mfr.yaml', 'openapi/device-local.yaml'];

function withoutExternalRefs(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(withoutExternalRefs);
  }
  if (node && typeof node === 'object') {
    const ref = (node as Json).$ref;
    return typeof ref === 'string' && !ref.startsWith('#') ? {} : Object.fromEntries(Object.entries(node).map(([k, v]) => [k, withoutExternalRefs(v)]));
  }
  return node;
}

describe.each(DOCS)('%s', (rel) => {
  const { doc, compile } = openapiSchemas(rel);
  const ops = operations(doc);

  it('is a valid OpenAPI 3.1 document', async () => {
    const validator = new Validator();
    // The validator checks document structure only; external schema files are checked by the tests below.
    const res = await validator.validate(withoutExternalRefs(doc) as never);
    expect(res.errors ?? []).toEqual([]);
    expect(res.valid).toBe(true);
  });

  it('every external $ref points at an existing schema file', () => {
    for (const ref of refs(doc).filter((r) => !r.startsWith('#'))) {
      expect(existsSync(join(ROOT, dirname(rel), ref.split('#')[0]!)), ref).toBe(true);
    }
  });

  it('operation ids are unique', () => {
    const ids = ops.map((o) => o.op.operationId);
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ops.map((o) => [`${o.method} ${o.path}`, o] as const))('%s has a summary, a success response and examples', (_name, o) => {
    expect(typeof o.op.summary).toBe('string');
    const responses = o.op.responses as Json;
    const success = Object.keys(responses).filter((s) => /^2\d\d$/.test(s));
    expect(success).toHaveLength(1);
    const cases = exampleCases(doc, o);
    const content = (r: unknown) => Object.keys(((r as Json | undefined)?.content ?? {})).some((t) => t.includes('json'));
    if (content(o.op.requestBody)) {
      expect(cases.some((c) => c.where.includes(' request '))).toBe(true);
    }
    if (content(responses[success[0]!])) {
      expect(cases.some((c) => c.where.includes(` ${success[0]} `))).toBe(true);
    }
  });

  const cases = ops.flatMap((o) => exampleCases(doc, o));
  it.each(cases.map((c) => [c.where, c] as const))('example %s is valid', (_where, c) => {
    const fn = compile(c.schema);
    fn(c.value);
    expect(fn.errors ?? []).toEqual([]);
  });
});
