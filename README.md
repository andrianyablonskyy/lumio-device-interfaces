# Lumio device interfaces

Everything a device manufacturer needs to make hardware work with Lumio, the multi-vendor smart-home cloud and app:
the device protocol, pairing, firmware updates, analytics, event notifications and the manufacturer API.

| You build | Start with |
| --- | --- |
| Device firmware | [docs/02-device-identity.md](docs/02-device-identity.md), [docs/03-mqtt.md](docs/03-mqtt.md), [docs/04-pairing.md](docs/04-pairing.md), [c/include/lumio_device.h](c/include/lumio_device.h) |
| Factory / production line tooling | [docs/09-manufacturer-api.md](docs/09-manufacturer-api.md) (provisioning) |
| Firmware release pipeline | [docs/07-firmware-updates.md](docs/07-firmware-updates.md) |
| Fleet monitoring, back-office integration | [docs/10-analytics.md](docs/10-analytics.md), [docs/08-webhooks.md](docs/08-webhooks.md) |
| A new HW type (channels, device type) | [docs/11-device-types.md](docs/11-device-types.md), [schemas/capabilities.json](schemas/capabilities.json) |

New here? Read [docs/01-overview.md](docs/01-overview.md) first: it walks through the whole integration in order.

## What is in this repository

| Path | Contents |
| --- | --- |
| [schemas/](schemas/) | JSON Schema (draft 2020-12) for every message and data structure. **Normative.** |
| [asyncapi/mqtt.yaml](asyncapi/mqtt.yaml) | AsyncAPI 3.0: MQTT topics, directions, QoS, retain flags and payloads |
| [openapi/mfr.yaml](openapi/mfr.yaml) | OpenAPI 3.1: manufacturer API (provisioning, HW types, firmware, campaigns, analytics, webhooks) |
| [openapi/device-local.yaml](openapi/device-local.yaml) | OpenAPI 3.1: HTTP API a device serves on its hotspot in Wi-Fi setup mode |
| [docs/](docs/) | Integration guide: behaviour, sequences, timing, error handling |
| [examples/](examples/) | Valid example payloads, one or more per schema (`<schema>[.<variant>].json`) |
| [test-vectors/](test-vectors/) | Fixed inputs and expected outputs for every signature and encryption step |
| [c/include/lumio_device.h](c/include/lumio_device.h) | C99 constants for firmware: topics, UUIDs, limits, states |
| [src/](src/) | Reference implementation in TypeScript (Node.js 20+): validators, topics/ACL, signing, provisioning crypto |

Where the documents disagree, the schemas win, then the AsyncAPI/OpenAPI documents, then the prose.

## Using it

```bash
npm install
npm run verify   # code style, types, and every regression test below
npm test         # tests only
```

The tests check that every schema compiles, every example is valid and known-bad payloads are rejected, that the
AsyncAPI and OpenAPI documents are valid and their examples match their schemas, that the reference code reproduces
every test vector, and that the C header matches the TypeScript constants.

**Validate your own payloads** with any JSON Schema 2020-12 validator, or with the reference code:

```ts
import { validate } from './src/index.js';
const result = validate('TelemetryMsg', JSON.parse(payload));   // schema title or $id
```

**Check your implementation** against [test-vectors/](test-vectors/): your firmware's provisioning-blob decryption,
manifest signature check and PSK password, and your backend's request signing and webhook verification, must produce
exactly the listed outputs. The keys in the vectors are derived from public strings: never ship them.

## Conformance checklist (device)

- [ ] Connects with mutual TLS (or PSK), client id = did, Last Will set, keep-alive 60 s ([03](docs/03-mqtt.md)).
- [ ] Subscribes to `state/desired`, `claim/result` and `ota/notify` before publishing.
- [ ] Every message carries `v`, `ts` (SNTP time, ms), `seq` (monotonic per boot) and `boot`.
- [ ] Publishes the full `state/reported` after connecting, after every change and after applying desired state, with `ack_version`.
- [ ] Applies desired state only when `version` is higher than the last applied one, and persists that version.
- [ ] Pairs over BLE and/or Wi-Fi setup mode with the encrypted provisioning blob ([04](docs/04-pairing.md)).
- [ ] Verifies the firmware manifest signature with the key in its bootloader and never installs a lower version ([07](docs/07-firmware-updates.md)).
- [ ] Rolls back automatically when the new image cannot reach the cloud within 5 minutes.
- [ ] Sends analytics at most every 5 minutes, with `reset_reason` after boot ([10](docs/10-analytics.md)).
- [ ] Factory reset (button or `factory_reset` command) erases Wi-Fi and owner data and reports a `reset` event.
- [ ] Stays within 16 KiB per message and 10 messages/s.

## Versioning

- The **device protocol** has a major version: the `v` field (currently `1`). Within a major version changes are
  backward compatible: new optional fields, new event types, new enum values in cloud-to-device messages. Devices and
  servers must ignore fields they do not know. A breaking change gets a new `v` and a migration period in which the
  cloud accepts both.
- This **repository** is versioned with semantic versioning (`package.json`, release tags `vX.Y.Z`); see
  [CHANGELOG.md](CHANGELOG.md).
- The schemas are strict (`additionalProperties: false`) so that tests catch typos; validate against the schema
  version your firmware was built for.

## Status

Pre-release (0.x). Hostnames (`*.lumio.io`) are provisional until general availability. Report problems or ask
questions through GitHub issues in this repository.
