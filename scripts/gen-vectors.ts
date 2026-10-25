// Writes test-vectors/*.json: fixed inputs and the exact outputs a conforming implementation must produce.
// Keys are derived from public strings: they are test keys, never use them in products. Run: npm run vectors.
// test/vectors.test.ts recomputes every vector with the reference code in src/.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson } from '../src/canonical-json.js';
import { ed25519PrivateKey, ed25519RawPublicKey, signManifest } from '../src/firmware.js';
import { encryptProvisionPayload, p256PublicKey, toFrames } from '../src/provisioning.js';
import { pskPassword, requestStringToSign, signRequest, webhookSignatureHeader } from '../src/signatures.js';
import type { FirmwareManifest, ProvisionPayload } from '../src/generated/types.js';

const dir = join(import.meta.dirname, '..', 'test-vectors');
const testKey = (label: string) => createHash('sha256').update(`lumio test vector: ${label}`).digest();
const write = (name: string, data: unknown) => writeFileSync(join(dir, name), JSON.stringify(data, null, 2) + '\n');
const NOTE = 'Test keys derived from public strings. Never use them in products.';

const manifest: FirmwareManifest = {
  hw_type: '01928f3e-5a7b-7c00-8d00-0000000000a1',
  model_code: 'P2',
  version: '1.5.0',
  min_from_version: '1.2.0',
  size: 1048576,
  sha256: createHash('sha256').update('lumio test firmware image 1.5.0').digest('hex'),
  mandatory: false,
  created_at: '2026-10-20T09:00:00Z'
};
const fwSeed = testKey('firmware signing key');
const fwKey = ed25519PrivateKey(fwSeed);
write('firmware-manifest-signature.json', {
  description: 'Ed25519 signature over the canonical JSON of a firmware manifest (docs/07-firmware-updates.md).',
  note: NOTE,
  private_key_seed_hex: fwSeed.toString('hex'),
  public_key_base64: ed25519RawPublicKey(fwKey).toString('base64'),
  manifest,
  canonical_json: canonicalJson(manifest),
  signature_base64: signManifest(manifest, fwKey)
});

const body = JSON.stringify({
  hw_type_id: manifest.hw_type,
  serial: 'P2A1B2C3D4',
  mac: '24:0a:c4:12:34:56',
  csr_pem: '-----BEGIN CERTIFICATE REQUEST-----\n...\n-----END CERTIFICATE REQUEST-----\n'
});
const request = {
  secret: 'test-secret-dGhpcyBpcyBub3QgYSByZWFsIHNlY3JldA',
  method: 'POST',
  pathWithQuery: '/v1/mfr/provisioning/devices',
  timestamp: 1761210000,
  body
};
write('mfr-request-signature.json', {
  description: 'HMAC-SHA256 signature of a manufacturer API machine call (docs/09-manufacturer-api.md).',
  note: NOTE,
  key_id: 'lk_live_abcdefghijklmnop',
  secret: request.secret,
  method: request.method,
  path_with_query: request.pathWithQuery,
  timestamp: request.timestamp,
  body,
  string_to_sign: requestStringToSign(request),
  signature_hex: signRequest(request)
});

const webhookBody = JSON.stringify({
  id: '01929a00-0000-7000-8000-000000000001',
  type: 'webhook.test',
  at: '2026-10-23T09:00:00Z',
  manufacturer_id: '01928f00-0000-7000-8000-00000000acde',
  data: {}
});
const whSecrets = ['whsec_dGVzdCB3ZWJob29rIHNlY3JldCBudW1iZXIgb25l', 'whsec_dGVzdCB3ZWJob29rIHNlY3JldCBudW1iZXIgdHdv'];
write('webhook-signature.json', {
  description: 'Lumio-Webhook-Signature header of a delivery, during a secret rotation (two v1 values) (docs/08-webhooks.md).',
  note: NOTE,
  secrets: whSecrets,
  timestamp: 1761210000,
  body: webhookBody,
  header: webhookSignatureHeader(whSecrets, 1761210000, webhookBody)
});

const psk = 'test-psk-bm90IGEgcmVhbCBwcmUtc2hhcmVkIGtleQ';
write('psk-mqtt-password.json', {
  description: 'MQTT password of a PSK device (docs/02-device-identity.md).',
  note: NOTE,
  psk,
  did: 'acme-P2A1B2C3D4',
  timestamp: 1761210000,
  nonce: '9f86d081884c7d65',
  password: pskPassword(psk, 'acme-P2A1B2C3D4', 1761210000, '9f86d081884c7d65')
});

const devicePriv = testKey('device provisioning key');
const appPriv = testKey('app ephemeral key');
const nonce = testKey('nonce').subarray(0, 12);
const payload: ProvisionPayload = {
  v: 1,
  ssid: 'Home WiFi',
  password: 'correct horse battery staple',
  claim_token: 'ct_Zm9yIHRlc3RzIG9ubHkgMTIz',
  mqtt_host: 'mqtt.eu.lumio.io',
  tz: 'Europe/Kyiv'
};
const blob = encryptProvisionPayload(p256PublicKey(devicePriv), 'acme-P2A1B2C3D4', payload, { ephemeralPrivateKey: appPriv, nonce });
write('provision-blob.json', {
  description: 'Provisioning blob encrypted to the device key, and its BLE frames for a 23-byte ATT MTU (20-byte writes) (docs/04-pairing.md).',
  note: NOTE,
  did: 'acme-P2A1B2C3D4',
  device_private_key_hex: devicePriv.toString('hex'),
  device_public_key_base64: p256PublicKey(devicePriv).toString('base64'),
  app_ephemeral_private_key_hex: appPriv.toString('hex'),
  nonce_hex: nonce.toString('hex'),
  payload,
  plaintext: JSON.stringify(payload),
  blob_hex: blob.toString('hex'),
  ble_frames_hex: toFrames(blob, 20).map((f) => f.toString('hex'))
});
console.log(`wrote ${dir}`);
