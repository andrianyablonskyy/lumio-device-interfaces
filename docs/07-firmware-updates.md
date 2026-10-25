# 7. Firmware updates (OTA)

Firmware is signed by **you**, with an Ed25519 key whose public half is in your HW type (`fw_signing_pubkey`) and in
your device bootloader. Lumio verifies the signature before it offers an image, and the device verifies it again
before installing. A compromised cloud alone cannot ship firmware to your devices.

## Publishing an image

1. Build the image and compute its size and SHA-256.
2. Write the [FirmwareManifest](../schemas/firmware-manifest.json):

   ```json
   {"hw_type":"01928f3e-5a7b-7c00-8d00-0000000000a1","model_code":"P2","version":"1.5.0","min_from_version":"1.2.0",
    "size":1048576,"sha256":"d53dde0d…","mandatory":false,"created_at":"2026-10-20T09:00:00Z"}
   ```

3. Sign the **canonical JSON** of the manifest: keys sorted (by UTF-16 code unit order, as in RFC 8785), no
   whitespace, standard JSON string escaping, integers only, UTF-8. Signature = Ed25519 (64 bytes), base64. Keep the
   signing key offline or in an HSM. Vector: [test-vectors/firmware-manifest-signature.json](../test-vectors/firmware-manifest-signature.json).
4. `POST /mfr/firmware` → presigned multipart upload URLs; upload the parts; `POST /mfr/firmware/{fid}/complete`
   with manifest, signature, release notes. Lumio checks size, SHA-256 and signature; the image becomes `verified`
   (webhook `firmware.verified`) or `rejected` (`firmware.rejected` with the reason).
5. Create a **campaign** (`POST /mfr/campaigns`): target versions/countries, steps (cumulative % of the eligible fleet,
   default 1 → 10 → 50 → 100) and a failure threshold (default 2 %). Start it. Each step advances manually or after
   24 hours below the threshold; a step above it pauses the campaign (`campaign.status_changed`, reason
   `failure_threshold`). Lumio can halt all rollouts platform-wide in an emergency.

Users can also install an available update from the app, at once or in the night maintenance window (03:00 home time).

## Device protocol

States: `offered → (deferred) → downloading → verified → installing → success | failed | rolled_back`.

```mermaid
sequenceDiagram
  participant C as Cloud
  participant D as Device
  participant S as Firmware CDN
  C->>D: ota/notify {job_id, version, url, size, sha256, manifest, manifest_sig, install_after?}
  D->>D: verify manifest_sig with bootloader key; version > running; min_from_version
  D->>C: ota/progress offered (or failed / deferred)
  D->>S: GET url (Range requests)
  D->>C: ota/progress downloading pct (≤ every 5 s)
  D->>D: SHA-256 == manifest.sha256, write inactive slot
  D->>C: ota/progress verified
  D->>D: wait for install_after, then reboot into new slot
  D->>C: (new image) connect, ota/progress success
```

On [OtaNotifyMsg](../schemas/mqtt/ota-notify.json) the device:

1. Verifies `manifest_sig` over the canonical JSON of `manifest` with the key embedded in the bootloader, and that
   `manifest.version` = `version`, `manifest.sha256` = `sha256`, `manifest.size` = `size`, `manifest.model_code` is its
   own model. Failure → `failed` with `signature_invalid` (or `manifest_mismatch`).
2. **Anti-rollback**: refuses a version that is not strictly higher than the running one (`version_rejected`), or a
   running version below `min_from_version` (`min_from_version`). Prefer a hardware anti-rollback counter (eFuse) for
   security fixes.
3. Reports `offered`, or `deferred` when it cannot update now (low battery, user busy); the cloud offers again later.
4. Downloads over HTTPS with **range requests**, resuming after interruptions; reports `downloading` with `pct` at most
   every 5 s. The URL is valid for 1 hour: on HTTP 403/expiry report `downloading` with `error: "url_expired"` and wait
   for a new `ota/notify` with the same `job_id`.
5. Checks SHA-256 and writes the image to the inactive A/B slot, then reports `verified`.
6. Reboots into the new image right away, or not before `install_after` (Unix ms) when given. Reports `installing`
   just before rebooting.
7. The new image reconnects and reports `success` for the `job_id` (keep the job id across the reboot). If it
   cannot reach the cloud within **5 minutes**, the bootloader rolls back to the previous slot, and the old image
   reports `rolled_back`. Roll back also on crash loops (3 failed boots).

Only one job is active per device; a new `ota/notify` with another `job_id` replaces a job that has not reached
`installing`. Mandatory updates (`mandatory: true`) cannot be cancelled by the user, but follow the same protocol.

## Error codes (`OtaProgressMsg.error`)

| Code | Meaning |
| --- | --- |
| `signature_invalid` | Manifest signature does not verify with the bootloader key |
| `manifest_mismatch` | Manifest fields differ from the notify message or from the device model |
| `version_rejected` | Not newer than the running version (anti-rollback) |
| `min_from_version` | Running version too old for this image |
| `insufficient_space` | Inactive slot too small |
| `low_battery` | Not enough charge to update safely (send with `deferred`) |
| `url_expired` | Download URL expired; request a new one (with state `downloading`) |
| `download_failed` | Network errors after retries |
| `sha256_mismatch` | Downloaded image does not match |
| `flash_write_failed` | Writing the slot failed |
| `boot_failed` | New image did not boot or crashed (with `rolled_back`) |
| `no_connectivity` | New image could not reach the cloud within 5 minutes (with `rolled_back`) |
| `x_…` | Manufacturer-specific |

`failed` and `rolled_back` count towards the campaign failure rate; top codes appear in the campaign view and in
the `ota.job_failed` webhook.
