// Firmware manifest signatures: Ed25519 over the canonical JSON of the manifest (docs/07-firmware-updates.md).
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { canonicalJson } from './canonical-json.js';
import type { FirmwareManifest } from './generated/types.js';

const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

export function ed25519PrivateKey(seed: Buffer): KeyObject {
  if (seed.length !== 32) {
    throw new RangeError('Ed25519 seed must be 32 bytes');
  }
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: 'der', type: 'pkcs8' });
}

export function ed25519PublicKey(raw: Buffer): KeyObject {
  if (raw.length !== 32) {
    throw new RangeError('Ed25519 public key must be 32 bytes');
  }
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519, raw]), format: 'der', type: 'spki' });
}

// Raw 32-byte public key, as registered in the HW type (fw_signing_pubkey, base64).
export function ed25519RawPublicKey(key: KeyObject): Buffer {
  return createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(SPKI_ED25519.length);
}

export function manifestBytes(manifest: FirmwareManifest): Buffer {
  return Buffer.from(canonicalJson(manifest), 'utf8');
}

export function signManifest(manifest: FirmwareManifest, privateKey: KeyObject): string {
  return sign(null, manifestBytes(manifest), privateKey).toString('base64');
}

export function verifyManifest(manifest: FirmwareManifest, signatureB64: string, publicKeyRaw: Buffer): boolean {
  const signature = Buffer.from(signatureB64, 'base64');
  return signature.length === 64 && verify(null, manifestBytes(manifest), ed25519PublicKey(publicKeyRaw), signature);
}
