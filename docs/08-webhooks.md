# 8. Webhooks (event notifications for manufacturers)

Lumio can notify your systems about your fleet: POST requests to your HTTPS endpoints. Manage endpoints with
`/mfr/webhooks` ([openapi/mfr.yaml](../openapi/mfr.yaml)): URL, event types, enable/disable, secret rotation, a test
event and the delivery log (30 days).

## Event types

Body: [WebhookEvent](../schemas/webhooks/event.json) `{id, type, at, manufacturer_id, data}`.

| Type | When | `data` |
| --- | --- | --- |
| `device.provisioned` | A unit was registered | did, hw_type_id, serial, auth_kind, key_id, cert_not_after |
| `device.revoked` | A unit was revoked | did, hw_type_id |
| `device.claimed` | A unit was paired to a home (first activation or after reset) | did, hw_type_id, method, fw, country (of the cloud region) |
| `device.unclaimed` | A unit was removed from a home | did, hw_type_id |
| `hw_type.reviewed` | Review finished | hw_type_id, model_code, status (approved/rejected), review_note |
| `firmware.verified` / `firmware.rejected` | Upload checked | firmware_id, hw_type_id, version, reason |
| `campaign.status_changed` | Campaign started, paused, halted or completed | campaign_id, firmware_id, status, current_step, failure_rate_pct, pause_reason |
| `ota.job_failed` | An update failed or rolled back | job_id, did, firmware_id, campaign_id, state, error_code |
| `api_key.status_changed` | Billing state of a key changed | key_id, status, previous_status |
| `webhook.test` | You asked for a test delivery | (empty) |

Events never contain user, household or location data. New event types may be added; you receive only the types an
endpoint subscribes to.

## Delivery

```
POST /lumio HTTP/1.1
Content-Type: application/json
Lumio-Webhook-Id: 01929a10-0000-7000-8000-000000000002
Lumio-Webhook-Signature: t=1761210000,v1=<64 hex characters>

{"id":"01929a10-0000-7000-8000-000000000002","type":"device.claimed",...}
```

- Answer any **2xx within 10 seconds**; do the work asynchronously. Other answers, timeouts and connection errors
  are retried with exponential backoff (about 1 min, 5 min, 30 min, 2 h, 6 h, 12 h, then every 24 h) for 3 days.
- An endpoint that failed every delivery for 3 days is disabled (`disabled_reason: failing`) and the org admins get an
  email. Re-enable it with `PATCH {enabled: true}`.
- Delivery is **at least once** and **not ordered**: de-duplicate by `id`, and use `at` to order.

## Verifying a delivery

`Lumio-Webhook-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`. The HMAC key is the UTF-8
bytes of the whole secret string (`whsec_…`). During the 24 hours after a secret rotation the header carries two `v1`
values, one per secret.

1. Parse `t` and every `v1`.
2. Reject if `|now − t| > 300` seconds (replays).
3. Compute the HMAC over the **raw** request body (before any JSON parsing) and compare in constant time with each
   `v1`; accept if one matches.

Vector: [test-vectors/webhook-signature.json](../test-vectors/webhook-signature.json). Reference:
`verifyWebhook()` in [src/signatures.ts](../src/signatures.ts).
