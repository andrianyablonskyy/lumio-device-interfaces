import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptProvisionPayload, encryptProvisionPayload, FrameAssembler, p256PublicKey, toFrames } from './provisioning.js';
import type { ProvisionPayload } from './generated/types.js';

const devicePriv = Buffer.from('c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721', 'hex');
const did = 'acme-P2A1B2C3D4';
const payload: ProvisionPayload = { v: 1, ssid: 'Home', password: 'pass phrase', claim_token: 'ct_0123456789abcdef', mqtt_host: 'mqtt.eu.lumio.io' };

describe('provisioning blob', () => {
  it('round-trips with a fresh ephemeral key and nonce each time', () => {
    const a = encryptProvisionPayload(p256PublicKey(devicePriv), did, payload);
    const b = encryptProvisionPayload(p256PublicKey(devicePriv), did, payload);
    expect(a.equals(b)).toBe(false);
    expect(decryptProvisionPayload(devicePriv, did, a)).toEqual(payload);
  });

  it('fails for another device, another did or any modified byte', () => {
    const blob = encryptProvisionPayload(p256PublicKey(devicePriv), did, payload);
    expect(() => decryptProvisionPayload(randomBytes(32), did, blob)).toThrow();
    expect(() => decryptProvisionPayload(devicePriv, 'acme-OTHER00001', blob)).toThrow();
    for (const i of [0, 10, 70, 90, blob.length - 1]) {
      const bad = Buffer.from(blob);
      bad[i]! ^= 1;
      expect(() => decryptProvisionPayload(devicePriv, did, bad)).toThrow();
    }
  });

  it('refuses oversized payloads', () => {
    expect(() => encryptProvisionPayload(p256PublicKey(devicePriv), did, { ...payload, tz: 'x'.repeat(600) })).toThrow(RangeError);
  });
});

describe('BLE frames', () => {
  it('reassembles in order and restarts on frame 0', () => {
    const blob = randomBytes(150);
    const frames = toFrames(blob, 20);
    expect(frames.every((f) => f.length <= 20)).toBe(true);
    expect(frames.at(-1)![0]! & 0x80).toBe(0x80);
    const asm = new FrameAssembler();
    asm.push(frames[0]!);
    asm.push(frames[1]!);
    const results = frames.map((f) => asm.push(f));
    expect(results.at(-1)!.equals(blob)).toBe(true);
  });

  it('rejects frames out of order', () => {
    const frames = toFrames(randomBytes(60), 20);
    const asm = new FrameAssembler();
    asm.push(frames[0]!);
    expect(() => asm.push(frames[2]!)).toThrow();
  });
});
