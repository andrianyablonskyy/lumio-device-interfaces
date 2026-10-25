# 9. Manufacturer API

Machine-readable: [openapi/mfr.yaml](../openapi/mfr.yaml). Base URL `https://api.<region>.lumio.io/v1`.

| Area | Endpoints | Auth |
| --- | --- | --- |
| Provisioning | `POST /mfr/provisioning/devices`, `POST /mfr/provisioning/devices:batch` | API key signature |
| Revocation, fleet | `POST /mfr/provisioning/devices/{did}/revoke`, `GET /mfr/fleet` | portal token |
| Hardware types | `/mfr/hw-types`, `/{id}`, `/{id}/submit`, `/{id}/images` | portal token |
| Test devices | `/mfr/test-devices` | portal token |
| Firmware | `/mfr/firmware`, `/{fid}/complete`, `/{fid}/withdraw`, `/mfr/campaigns`, `/{cid}`, `/{cid}/start|pause|resume|advance` | portal token |
| Analytics | `GET /mfr/analytics/metrics`, `GET /mfr/analytics/resets` | portal token |
| Webhooks | `/mfr/webhooks`, `/{wid}`, `/{wid}/rotate-secret`, `/{wid}/test`, `/{wid}/deliveries` | portal token |

Organisation, team, API keys and billing are managed in the manufacturer portal.

## Signing machine calls (API key)

Production lines authenticate with an API key: a public key id `lk_live_…` and a secret shown once at creation.
Rotate keys in the portal; after a rotation the old secret stays valid for 24 hours.

```
X-Lumio-Key: lk_live_abcdefghijklmnop
X-Lumio-Timestamp: 1761210000
X-Lumio-Signature: hex(HMAC-SHA256(secret, string_to_sign))

string_to_sign = METHOD + "\n" + path_with_query + "\n" + timestamp + "\n" + hex(SHA-256(body))
```

- `METHOD` upper case; `path_with_query` from `/v1`, exactly as sent (e.g. `/v1/mfr/provisioning/devices`);
  `timestamp` Unix seconds, accepted within ±300 s; `body` the exact bytes sent (empty string when there is none).
- The HMAC key is the UTF-8 bytes of the secret string. Lowercase hex.
- A replayed signature is refused for 5 minutes, so every request needs a fresh timestamp or body.

Vector: [test-vectors/mfr-request-signature.json](../test-vectors/mfr-request-signature.json). Reference:
`signRequest()` / `requestHeaders()` in [src/signatures.ts](../src/signatures.ts). Keep the secret in the production
line's secret store; never put it into device firmware.

## Conventions

- JSON, `snake_case`, RFC 3339 UTC timestamps, UUID ids.
- Cursor pagination: `?limit=50&cursor=…` → `{"items": [...], "next_cursor": "…" | null}`, `limit` ≤ 200.
- Send `Idempotency-Key: <uuid>` on creates (provisioning, uploads, campaigns, webhooks): a retry with the same key
  returns the original answer with `Idempotency-Replayed: true` instead of creating twice. Production lines should
  always send one.
- Errors: RFC 9457 `application/problem+json` with a stable `code`
  ([schemas/common.json](../schemas/common.json) `Problem`). Act on `code`, not on `title`.

| Status | `code` | Typical cause |
| --- | --- | --- |
| 400 | `validation_failed` | Schema violation; `errors[]` lists `path`, `code`, `message` |
| 401 | `unauthenticated`, `signature_invalid` | Missing token, bad signature or timestamp outside ±300 s |
| 403 | `forbidden`, `api_key_suspended` | Wrong role, HW type not linked to the key, suspended key |
| 404 | `not_found` | |
| 409 | `conflict` | Duplicate serial, model code or firmware version; wrong state for the action |
| 422 | `firmware_signature_invalid` | Manifest signature does not verify |
| 429 | `rate_limited` | Honour `Retry-After` |

## Rate limits

Responses carry `RateLimit-Limit` and `RateLimit-Remaining`; a `429` carries `Retry-After`. For volume use the batch
endpoint: it provisions 1,000 units in under 10 seconds.
