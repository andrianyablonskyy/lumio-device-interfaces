// HMAC signatures: manufacturer API requests (machine calls), webhook deliveries, PSK device MQTT passwords.
// Keys are the UTF-8 bytes of the secret string exactly as Lumio issued it. Comparisons are constant-time.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SIGNATURE_TOLERANCE_S } from './constants.js';

const hmacHex = (secret: string, message: string) => createHmac('sha256', Buffer.from(secret, 'utf8')).update(message, 'utf8').digest('hex');
const sha256Hex = (body: Buffer | string) => createHash('sha256').update(body).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface SignedRequest {
  secret: string;
  method: string;
  pathWithQuery: string; // '/v1/mfr/provisioning/devices', query string exactly as sent
  timestamp: number; // Unix seconds
  body: Buffer | string; // exact bytes sent; '' for no body
}

export function requestStringToSign({ method, pathWithQuery, timestamp, body }: Omit<SignedRequest, 'secret'>): string {
  return `${method.toUpperCase()}\n${pathWithQuery}\n${timestamp}\n${sha256Hex(body)}`;
}

// Headers X-Lumio-Key, X-Lumio-Timestamp, X-Lumio-Signature (manufacturer API, machine calls).
export function signRequest(req: SignedRequest): string {
  return hmacHex(req.secret, requestStringToSign(req));
}

export function requestHeaders(keyId: string, req: SignedRequest): Record<string, string> {
  return { 'X-Lumio-Key': keyId, 'X-Lumio-Timestamp': String(req.timestamp), 'X-Lumio-Signature': signRequest(req) };
}

export function verifyRequest(req: SignedRequest, signature: string, nowS: number): boolean {
  return Math.abs(nowS - req.timestamp) <= SIGNATURE_TOLERANCE_S && safeEqualHex(signRequest(req), signature.toLowerCase());
}

// Header Lumio-Webhook-Signature: t=<unix s>,v1=<hex>[,v1=<hex>] (two v1 values while a secret rotation overlaps).
export function signWebhook(secret: string, timestamp: number, rawBody: string): string {
  return hmacHex(secret, `${timestamp}.${rawBody}`);
}

export function webhookSignatureHeader(secrets: string[], timestamp: number, rawBody: string): string {
  return [`t=${timestamp}`, ...secrets.map((s) => `v1=${signWebhook(s, timestamp, rawBody)}`)].join(',');
}

export function verifyWebhook(secret: string, header: string, rawBody: string, nowS: number): boolean {
  const parts = header.split(',').map((p) => p.trim());
  const t = Number(parts.find((p) => p.startsWith('t='))?.slice(2));
  if (!Number.isInteger(t) || Math.abs(nowS - t) > SIGNATURE_TOLERANCE_S) {
    return false;
  }
  const expected = signWebhook(secret, t, rawBody);
  return parts.filter((p) => p.startsWith('v1=')).some((p) => safeEqualHex(expected, p.slice(3)));
}

// MQTT password of a PSK device (username = did): v1.<unix s>.<nonce>.<hex HMAC-SHA256(psk, "<did>.<unix s>.<nonce>")>.
// nonce: 16-32 random hex characters, never reused; the broker accepts timestamps within ±300 s.
export function pskPassword(psk: string, did: string, timestamp: number, nonce: string): string {
  if (!/^[0-9a-f]{16,32}$/.test(nonce)) {
    throw new TypeError('nonce must be 16-32 lowercase hex characters');
  }
  return `v1.${timestamp}.${nonce}.${hmacHex(psk, `${did}.${timestamp}.${nonce}`)}`;
}

export function verifyPskPassword(psk: string, did: string, password: string, nowS: number): boolean {
  const m = /^v1\.(\d+)\.([0-9a-f]{16,32})\.([0-9a-f]{64})$/.exec(password);
  if (!m) {
    return false;
  }
  const ts = Number(m[1]);
  return Math.abs(nowS - ts) <= SIGNATURE_TOLERANCE_S && safeEqualHex(pskPassword(psk, did, ts, m[2]!), password);
}
