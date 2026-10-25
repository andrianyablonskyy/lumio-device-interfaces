# Changelog

All notable changes to the Lumio device interfaces. The repository follows semantic versioning; the device protocol
version (`v` in MQTT payloads) changes only on breaking protocol changes.

## 0.1.0 (unreleased)

First public draft, device protocol v1.

- Device types (`device_type` on HW types) with channel rules per type, and the capabilities `voltage`, `current`,
  `volume` ([docs/11-device-types.md](docs/11-device-types.md)).

- MQTT device protocol: telemetry, events, reported/desired state, claim, OTA notify/progress, analytics, Last Will
  (AsyncAPI 3.0 + JSON Schema 2020-12).
- Device identity: certificates from CSR, PSK fallback with time-bound HMAC passwords, QR claim URI.
- Pairing: BLE GATT profile, Wi-Fi setup mode local API, ECDH P-256 + HKDF + AES-256-GCM provisioning blob.
- Firmware: signed manifests (Ed25519 over canonical JSON), OTA state machine and error codes, staged campaigns.
- Manufacturer API (OpenAPI 3.1): provisioning, HW types, test devices, firmware, campaigns, fleet analytics, webhooks.
- Webhooks: event catalogue, signed deliveries, retry policy.
- C99 header, TypeScript reference implementation and test vectors.
