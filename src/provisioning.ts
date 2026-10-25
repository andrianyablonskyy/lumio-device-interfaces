// Provisioning blob: Wi-Fi credentials and claim token encrypted to the device public key (BLE and Wi-Fi setup mode).
// ECDH P-256 (app ephemeral key x device key) -> HKDF-SHA256 -> AES-256-GCM, AAD = did.
// Layout: version (1) | app ephemeral public key (65, uncompressed) | nonce (12) | ciphertext | tag (16).
import { createCipheriv, createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto';
import { PROVISION_BLOB_VERSION, PROVISION_HKDF_INFO, PROVISION_MAX_PLAINTEXT_BYTES } from './constants.js';
import type { ProvisionPayload } from './generated/types.js';

const PUB = 65;
const NONCE = 12;
const TAG = 16;
const HEADER = 1 + PUB + NONCE;

function key(shared: Buffer, appPub: Buffer, devicePub: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', shared, Buffer.concat([appPub, devicePub]), PROVISION_HKDF_INFO, 32));
}

export function p256PublicKey(privateKey: Buffer): Buffer {
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateKey);
  return ecdh.getPublicKey();
}

export interface EncryptOptions {
  ephemeralPrivateKey?: Buffer; // test vectors only; random otherwise
  nonce?: Buffer; // test vectors only; random otherwise
}

export function encryptProvisionPayload(devicePublicKey: Buffer, did: string, payload: ProvisionPayload, opts: EncryptOptions = {}): Buffer {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  if (plaintext.length > PROVISION_MAX_PLAINTEXT_BYTES) {
    throw new RangeError(`provision payload is ${plaintext.length} bytes, at most ${PROVISION_MAX_PLAINTEXT_BYTES}`);
  }
  const ecdh = createECDH('prime256v1');
  if (opts.ephemeralPrivateKey) {
    ecdh.setPrivateKey(opts.ephemeralPrivateKey);
  }
  else {
    ecdh.generateKeys();
  }
  const appPub = ecdh.getPublicKey();
  const nonce = opts.nonce ?? randomBytes(NONCE);
  const cipher = createCipheriv('aes-256-gcm', key(ecdh.computeSecret(devicePublicKey), appPub, devicePublicKey), nonce);
  cipher.setAAD(Buffer.from(did, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([Buffer.from([PROVISION_BLOB_VERSION]), appPub, nonce, ct, cipher.getAuthTag()]);
}

// Device side. Throws on a wrong version, key, did or any modified byte (the device then reports decrypt_failed).
export function decryptProvisionPayload(devicePrivateKey: Buffer, did: string, blob: Buffer): unknown {
  if (blob.length < HEADER + TAG + 2 || blob[0] !== PROVISION_BLOB_VERSION) {
    throw new Error('provision blob: unsupported version or truncated');
  }
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(devicePrivateKey);
  const appPub = blob.subarray(1, 1 + PUB);
  const nonce = blob.subarray(1 + PUB, HEADER);
  const decipher = createDecipheriv('aes-256-gcm', key(ecdh.computeSecret(appPub), appPub, ecdh.getPublicKey()), nonce);
  decipher.setAAD(Buffer.from(did, 'utf8'));
  decipher.setAuthTag(blob.subarray(blob.length - TAG));
  const plaintext = Buffer.concat([decipher.update(blob.subarray(HEADER, blob.length - TAG)), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

// BLE writes: the blob is split into frames of at most (ATT MTU - 3) bytes. Frame = header byte | data, header bit 7 =
// last frame, bits 0-6 = frame index (0, 1, 2, ...). The device reassembles in order and restarts on index 0.
export function toFrames(blob: Buffer, maxWrite: number): Buffer[] {
  const chunk = maxWrite - 1;
  if (chunk < 1) {
    throw new RangeError('maxWrite must be at least 2 bytes');
  }
  const count = Math.ceil(blob.length / chunk);
  if (count > 128) {
    throw new RangeError('blob needs more than 128 frames: negotiate a larger MTU');
  }
  return Array.from({ length: count }, (_, i) => Buffer.concat([
    Buffer.from([(i === count - 1 ? 0x80 : 0) | i]),
    blob.subarray(i * chunk, (i + 1) * chunk)
  ]));
}

export class FrameAssembler {
  private parts: Buffer[] = [];

  // Returns the complete blob after the last frame, otherwise null. Throws on a frame out of order.
  push(frame: Buffer): Buffer | null {
    const header = frame[0];
    if (header === undefined) {
      throw new Error('empty frame');
    }
    const index = header & 0x7f;
    if (index === 0) {
      this.parts = [];
    }
    if (index !== this.parts.length) {
      this.parts = [];
      throw new Error(`frame ${index} out of order`);
    }
    this.parts.push(frame.subarray(1));
    if ((header & 0x80) === 0) {
      return null;
    }
    const blob = Buffer.concat(this.parts);
    this.parts = [];
    return blob;
  }
}
