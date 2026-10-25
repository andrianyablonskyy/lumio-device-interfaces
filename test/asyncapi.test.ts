// Interface regression for the MQTT protocol: the AsyncAPI document is valid, matches the topic table in
// src/constants.ts and the C header, and references a schema for every message.
import { createRequire } from 'node:module';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../src/constants.js';
import { loadSchemaFiles } from '../src/schemas.js';
import { deref, loadYaml, type Json } from './helpers/specs.js';

const doc = loadYaml('asyncapi/mqtt.yaml');
const channels = doc.channels as Record<string, Json>;
const operations = doc.operations as Record<string, Json>;
const specs = createRequire(import.meta.url)('@asyncapi/specs') as { schemas: Record<string, Json> };

describe('asyncapi/mqtt.yaml', () => {
  it('is a valid AsyncAPI 3.0 document', () => {
    // The spec bundles its own draft-07 meta-schema, so Ajv's built-in one is left out.
    const ajv = new Ajv({ strict: false, allErrors: true, meta: false, validateSchema: false });
    addFormats.default(ajv);
    const { $schema: _meta, ...schema } = specs.schemas['3.0.0']!;
    const fn = ajv.compile(schema);
    fn(doc);
    expect(fn.errors ?? []).toEqual([]);
  });

  it('has exactly the channels of the topic table', () => {
    expect(Object.keys(channels).sort()).toEqual(Object.keys(TOPICS).sort());
  });

  it.each(Object.entries(TOPICS))('%s: address, direction, QoS, retain and payload schema match', (kind, t) => {
    const channel = channels[kind]!;
    expect(channel.address).toBe(`dev/{mid}/{did}/${t.suffix}`);
    const ops = Object.values(operations).filter((o) => (o.channel as Json).$ref === `#/channels/${kind}`);
    expect(ops).toHaveLength(1);
    const op = ops[0]!;
    expect(op.action).toBe(t.dir === 'D' ? 'send' : 'receive');
    const mqtt = (op.bindings as Json).mqtt as Json;
    expect(mqtt.qos).toBe(t.qos);
    if (t.dir === 'D') {
      expect(mqtt.retain).toBe(t.retain);
    }
    const message = deref(doc, Object.values(channel.messages as Json)[0]) as Json;
    expect(message.name).toBe(t.schema);
    const file = String((message.payload as Json).$ref).replace('../schemas/', '');
    expect(loadSchemaFiles().find((f) => f.file === file)?.title).toBe(t.schema);
  });

  it('every MQTT schema has a channel', () => {
    const mqttSchemas = loadSchemaFiles().filter((f) => f.file.startsWith('mqtt/')).map((f) => f.title).sort();
    expect(Object.values(TOPICS).map((t) => t.schema).sort()).toEqual(mqttSchemas);
  });
});
