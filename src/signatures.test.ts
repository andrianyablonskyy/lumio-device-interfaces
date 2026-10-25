import { describe, expect, it } from 'vitest';
import { pskPassword, requestHeaders, verifyPskPassword, verifyRequest, verifyWebhook, webhookSignatureHeader } from './signatures.js';

const req = { secret: 's3cret-value-for-tests-only', method: 'post', pathWithQuery: '/v1/mfr/provisioning/devices', timestamp: 1761210000, body: '{"a":1}' };

describe('manufacturer request signatures', () => {
  it('verifies within ±300 s and rejects any change', () => {
    const sig = requestHeaders('lk_live_abcdefghijklmnop', req)['X-Lumio-Signature']!;
    expect(verifyRequest(req, sig, req.timestamp + 300)).toBe(true);
    expect(verifyRequest(req, sig, req.timestamp + 301)).toBe(false);
    expect(verifyRequest({ ...req, body: '{"a":2}' }, sig, req.timestamp)).toBe(false);
    expect(verifyRequest({ ...req, pathWithQuery: '/v1/mfr/provisioning/devices?x=1' }, sig, req.timestamp)).toBe(false);
    expect(verifyRequest({ ...req, secret: 'other' }, sig, req.timestamp)).toBe(false);
  });
});

describe('webhook signatures', () => {
  it('accepts either secret during rotation and rejects stale or modified deliveries', () => {
    const header = webhookSignatureHeader(['whsec_old', 'whsec_new'], 1761210000, '{"x":1}');
    expect(verifyWebhook('whsec_new', header, '{"x":1}', 1761210100)).toBe(true);
    expect(verifyWebhook('whsec_old', header, '{"x":1}', 1761210100)).toBe(true);
    expect(verifyWebhook('whsec_other', header, '{"x":1}', 1761210100)).toBe(false);
    expect(verifyWebhook('whsec_new', header, '{"x":2}', 1761210100)).toBe(false);
    expect(verifyWebhook('whsec_new', header, '{"x":1}', 1761210000 + 301)).toBe(false);
    expect(verifyWebhook('whsec_new', 'v1=abc', '{"x":1}', 1761210000)).toBe(false);
  });
});

describe('PSK passwords', () => {
  it('binds the did, time and nonce', () => {
    const pw = pskPassword('psk-for-tests-only-0123456789', 'acme-P2A1B2C3D4', 1761210000, '0123456789abcdef');
    expect(pw).toMatch(/^v1\.1761210000\.0123456789abcdef\.[0-9a-f]{64}$/);
    expect(verifyPskPassword('psk-for-tests-only-0123456789', 'acme-P2A1B2C3D4', pw, 1761210000)).toBe(true);
    expect(verifyPskPassword('psk-for-tests-only-0123456789', 'acme-OTHER00001', pw, 1761210000)).toBe(false);
    expect(verifyPskPassword('psk-for-tests-only-0123456789', 'acme-P2A1B2C3D4', pw, 1761210000 + 600)).toBe(false);
    expect(() => pskPassword('x', 'acme-P2A1B2C3D4', 1, 'short')).toThrow();
  });
});
