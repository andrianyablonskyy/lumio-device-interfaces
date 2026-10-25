// Data structure regression: every schema compiles (Ajv strict mode), every example is valid, and known-bad payloads
// are rejected. Examples live in examples/<schema path>[.<variant>].json.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSchemaFiles, SCHEMA_BASE, validate, validatorFor } from '../src/schemas.js';
import { ROOT } from './helpers/specs.js';

const files = loadSchemaFiles();
const EXAMPLES = join(ROOT, 'examples');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const examples = walk(EXAMPLES).map((path) => {
  const rel = relative(EXAMPLES, path);
  return { rel, schemaFile: rel.replace(/(\.[a-z0-9-]+)?\.json$/, '.json'), value: JSON.parse(readFileSync(path, 'utf8')) as unknown };
});
const read = (rel: string) => structuredClone(examples.find((e) => e.rel === rel)!.value) as Record<string, unknown>;

describe('schemas', () => {
  it.each(files.map((f) => [f.file, f] as const))('%s has a matching $id, a title and a description', (file, f) => {
    expect(f.id).toBe(SCHEMA_BASE + file);
    expect(f.schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(f.title).toMatch(/^[A-Z]\w+$/);
    expect(typeof f.schema.description).toBe('string');
  });

  it('titles are unique', () => {
    expect(new Set(files.map((f) => f.title)).size).toBe(files.length);
  });

  it.each(files.map((f) => [f.file, f] as const))('%s compiles in strict mode', (_file, f) => {
    expect(() => validatorFor(f.id)).not.toThrow();
  });

  it.each(files.filter((f) => f.file !== 'common.json').map((f) => [f.file] as const))('%s has at least one example', (file) => {
    expect(examples.some((e) => e.schemaFile === file)).toBe(true);
  });
});

describe('examples', () => {
  it.each(examples.map((e) => [e.rel, e] as const))('%s is valid', (_rel, e) => {
    const schema = files.find((f) => f.file === e.schemaFile);
    expect(schema, `no schema ${e.schemaFile}`).toBeDefined();
    const result = validate(schema!.id, e.value);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

// Each case changes one valid example and must be rejected.
const invalid: [string, string, (v: Record<string, unknown>) => unknown][] = [
  ['telemetry without values', 'mqtt/telemetry.json', (v) => ({ ...v, values: {} })],
  ['telemetry with protocol version 2', 'mqtt/telemetry.json', (v) => ({ ...v, v: 2 })],
  ['telemetry with an unknown field (typo)', 'mqtt/telemetry.json', (v) => ({ ...v, valuse: v.values })],
  ['telemetry with a bad channel name', 'mqtt/telemetry.json', (v) => ({ ...v, values: { 'Power W': 1 } })],
  ['telemetry with a negative seq', 'mqtt/telemetry.json', (v) => ({ ...v, seq: -1 })],
  ['telemetry with a boolean value', 'mqtt/telemetry.json', (v) => ({ ...v, values: { switch_1: true } })],
  ['event without type', 'mqtt/event.json', ({ type: _t, ...v }) => v],
  ['event type with spaces', 'mqtt/event.json', (v) => ({ ...v, type: 'door opened' })],
  ['reported state without fw', 'mqtt/state-reported.json', ({ fw: _f, ...v }) => v],
  ['reported state with rssi above 0 dBm', 'mqtt/state-reported.json', (v) => ({ ...v, rssi: 12 })],
  ['desired state with factory_reset false', 'mqtt/state-desired.json', (v) => ({ ...v, state: { factory_reset: false } })],
  ['desired state with join_mode over 600 s', 'mqtt/state-desired.json', (v) => ({ ...v, state: { join_mode: 3600 } })],
  ['desired state issued by an unknown actor', 'mqtt/state-desired.json', (v) => ({ ...v, issued_by: 'support' })],
  ['claim with a short token', 'mqtt/claim.json', (v) => ({ ...v, token: 'abc' })],
  ['failed claim result without reason', 'mqtt/claim-result.json', () => ({ v: 1, ok: false })],
  ['successful claim result with reason', 'mqtt/claim-result.json', () => ({ v: 1, ok: true, reason: 'expired' })],
  ['OTA notify over plain http', 'mqtt/ota-notify.json', (v) => ({ ...v, url: 'http://fw.example/x.bin' })],
  ['OTA notify with uppercase sha256', 'mqtt/ota-notify.json', (v) => ({ ...v, sha256: String(v.sha256).toUpperCase() })],
  ['OTA manifest with an extra field', 'mqtt/ota-notify.json', (v) => ({ ...v, manifest: { ...(v.manifest as object), url: 'x' } })],
  ['OTA progress with an unknown state', 'mqtt/ota-progress.json', (v) => ({ ...v, state: 'rebooting' })],
  ['OTA progress over 100 %', 'mqtt/ota-progress.json', (v) => ({ ...v, pct: 101 })],
  ['analytics more often than every 5 minutes', 'mqtt/analytics.json', (v) => ({ ...v, period_s: 60 })],
  ['analytics with an unknown metric', 'mqtt/analytics.json', (v) => ({ ...v, metrics: { heap: 1 } })],
  ['analytics with a text metric', 'mqtt/analytics.json', (v) => ({ ...v, metrics: { x_mode: 'eco' } })],
  ['analytics with an unknown reset reason', 'mqtt/analytics.json', (v) => ({ ...v, reset_reason: 'cosmic_ray' })],
  ['last will saying online', 'mqtt/lwt.json', () => ({ online: true })],
  ['capability without x_ prefix', 'capabilities.json', () => ({ channels: [{ channel: 'volts', capability: 'voltage', role: 'sensor' }] })],
  ['capability with zero step', 'capabilities.json', () => ({
    channels: [{ channel: 'dim', capability: 'dimmer', role: 'actuator', range: { min: 0, max: 1, step: 0 } }]
  })],
  ['device info with a bad did', 'provisioning/device-info.json', (v) => ({ ...v, did: 'ACME-123' })],
  ['provision payload without claim token', 'provisioning/provision-payload.json', ({ claim_token: _c, ...v }) => v],
  ['provision payload with a 33-byte SSID', 'provisioning/provision-payload.json', (v) => ({ ...v, ssid: 'x'.repeat(33) })],
  ['failed status without error', 'provisioning/provision-status.json', () => ({ v: 1, state: 'failed' })],
  ['claim URI with an uppercase secret', 'provisioning/claim-uri.json', () => 'lumio://claim?did=acme-P2A1B2C3D4&cs=MFRWGY3BMJZGK2LTNFZW4ZLMMU'],
  ['webhook data of another event type', 'webhooks/event.device-claimed.json', (v) => ({ ...v, type: 'device.revoked' })],
  ['webhook with an unknown event type', 'webhooks/event.device-claimed.json', (v) => ({ ...v, type: 'device.exploded' })],
  ['webhook with user data', 'webhooks/event.device-claimed.json', (v) => ({
    ...v, data: { ...(v.data as object), household_id: '01928f00-0000-7000-8000-000000000001' }
  })]
];

describe('invalid payloads are rejected', () => {
  it.each(invalid)('%s', (_name, example, mutate) => {
    const e = examples.find((x) => x.rel === example)!;
    const schema = files.find((f) => f.file === e.schemaFile)!;
    expect(validate(schema.id, mutate(read(example))).ok).toBe(false);
  });
});
