// Every test vector is reproduced by the reference implementation. Firmware and server implementations should run
// the same vectors (inputs and expected outputs are plain JSON).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/canonical-json.js';
import { ed25519PrivateKey, ed25519RawPublicKey, signManifest, verifyManifest } from '../src/firmware.js';
import { decryptProvisionPayload, encryptProvisionPayload, FrameAssembler, p256PublicKey, toFrames } from '../src/provisioning.js';
import { pskPassword, requestStringToSign, signRequest, verifyPskPassword, verifyWebhook, webhookSignatureHeader } from '../src/signatures.js';
import { validate } from '../src/schemas.js';
import { ROOT } from './helpers/specs.js';

const vector = <T>(name: string) => JSON.parse(readFileSync(join(ROOT, 'test-vectors', name), 'utf8')) as T;
const hex = (s: string) => Buffer.from(s, 'hex');

describe('test vectors', () => {
  it('firmware manifest signature', () => {
    const v = vector<{
      private_key_seed_hex: string; public_key_base64: string; manifest: never; canonical_json: string; signature_base64: string;
    }>('firmware-manifest-signature.json');
    const key = ed25519PrivateKey(hex(v.private_key_seed_hex));
    expect(ed25519RawPublicKey(key).toString('base64')).toBe(v.public_key_base64);
    expect(canonicalJson(v.manifest)).toBe(v.canonical_json);
    expect(signManifest(v.manifest, key)).toBe(v.signature_base64);
    expect(verifyManifest(v.manifest, v.signature_base64, Buffer.from(v.public_key_base64, 'base64'))).toBe(true);
    expect(validate('FirmwareManifest', v.manifest).ok).toBe(true);
  });

  it('manufacturer request signature', () => {
    const v = vector<{
      secret: string; method: string; path_with_query: string; timestamp: number; body: string; string_to_sign: string; signature_hex: string;
    }>('mfr-request-signature.json');
    const req = { secret: v.secret, method: v.method, pathWithQuery: v.path_with_query, timestamp: v.timestamp, body: v.body };
    expect(requestStringToSign(req)).toBe(v.string_to_sign);
    expect(signRequest(req)).toBe(v.signature_hex);
  });

  it('webhook signature', () => {
    const v = vector<{ secrets: string[]; timestamp: number; body: string; header: string }>('webhook-signature.json');
    expect(webhookSignatureHeader(v.secrets, v.timestamp, v.body)).toBe(v.header);
    for (const secret of v.secrets) {
      expect(verifyWebhook(secret, v.header, v.body, v.timestamp + 10)).toBe(true);
    }
    expect(validate('WebhookEvent', JSON.parse(v.body)).ok).toBe(true);
  });

  it('PSK MQTT password', () => {
    const v = vector<{ psk: string; did: string; timestamp: number; nonce: string; password: string }>('psk-mqtt-password.json');
    expect(pskPassword(v.psk, v.did, v.timestamp, v.nonce)).toBe(v.password);
    expect(verifyPskPassword(v.psk, v.did, v.password, v.timestamp)).toBe(true);
  });

  it('provisioning blob and BLE frames', () => {
    const v = vector<{
      did: string; device_private_key_hex: string; device_public_key_base64: string; app_ephemeral_private_key_hex: string; nonce_hex: string;
      payload: never; plaintext: string; blob_hex: string; ble_frames_hex: string[];
    }>('provision-blob.json');
    const devicePriv = hex(v.device_private_key_hex);
    expect(p256PublicKey(devicePriv).toString('base64')).toBe(v.device_public_key_base64);
    expect(JSON.stringify(v.payload)).toBe(v.plaintext);
    const opts = { ephemeralPrivateKey: hex(v.app_ephemeral_private_key_hex), nonce: hex(v.nonce_hex) };
    const blob = encryptProvisionPayload(p256PublicKey(devicePriv), v.did, v.payload, opts);
    expect(blob.toString('hex')).toBe(v.blob_hex);
    expect(toFrames(blob, 20).map((f) => f.toString('hex'))).toEqual(v.ble_frames_hex);
    const assembler = new FrameAssembler();
    const out = v.ble_frames_hex.map((f) => assembler.push(hex(f)));
    expect(out.slice(0, -1).every((x) => x === null)).toBe(true);
    expect(decryptProvisionPayload(devicePriv, v.did, out.at(-1)!)).toEqual(v.payload);
    expect(validate('ProvisionPayload', v.payload).ok).toBe(true);
  });
});
