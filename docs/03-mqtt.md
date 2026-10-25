# 3. MQTT connection and topics

Machine-readable: [asyncapi/mqtt.yaml](../asyncapi/mqtt.yaml). Constants: [c/include/lumio_device.h](../c/include/lumio_device.h).

## Connection

| Setting | Value |
| --- | --- |
| Endpoint | `mqtts://mqtt.<region>.lumio.io:8883` (the app sends `mqtt_host` during pairing) |
| TLS | 1.2+ (1.3 preferred), mutual TLS with the device certificate; server certificate checked against the Lumio CA chain |
| Client id | the did |
| Protocol | MQTT 5 preferred, 3.1.1 supported |
| Keep-alive | 60 s |
| Session | clean start false, session expiry 3600 s (MQTT 5); clean session false (3.1.1) |
| Last Will | topic `dev/{mid}/{did}/lwt`, payload `{"online":false}`, QoS 1, not retained |

Reconnect with exponential backoff and jitter: 1 s, 2 s, 4 s … capped at 5 minutes, ±20 % random. After a
`not authorized` CONNACK (revoked, disabled, HW type not approved) back off for at least 1 hour.

## Startup order

1. Get time from SNTP (needed for `ts`, PSK passwords and certificate validation).
2. CONNECT with the Last Will.
3. SUBSCRIBE `state/desired`, `claim/result`, `ota/notify` (QoS 1). The retained desired state arrives right away.
4. If a claim is pending, PUBLISH `claim` ([04](04-pairing.md)).
5. PUBLISH the full `state/reported` (with `fw` and `ack_version`). This also marks the device online.
6. If an update was just installed, PUBLISH `ota/progress` `success` ([07](07-firmware-updates.md)).
7. PUBLISH `analytics` with `reset_reason` ([10](10-analytics.md)).

## Topics

`{mid}` = manufacturer short id, `{did}` = device id. A device may use only its own prefix `dev/{mid}/{did}/`.

| Topic | Direction | QoS | Retained | Payload schema |
| --- | --- | --- | --- | --- |
| `dev/{mid}/{did}/telemetry` | device → cloud | 0 | no | [TelemetryMsg](../schemas/mqtt/telemetry.json) |
| `dev/{mid}/{did}/event` | device → cloud | 1 | no | [EventMsg](../schemas/mqtt/event.json) |
| `dev/{mid}/{did}/state/reported` | device → cloud | 1 | yes | [ReportedStateMsg](../schemas/mqtt/state-reported.json) |
| `dev/{mid}/{did}/state/desired` | cloud → device | 1 | yes | [DesiredStateMsg](../schemas/mqtt/state-desired.json) |
| `dev/{mid}/{did}/claim` | device → cloud | 1 | no | [ClaimMsg](../schemas/mqtt/claim.json) |
| `dev/{mid}/{did}/claim/result` | cloud → device | 1 | no | [ClaimResultMsg](../schemas/mqtt/claim-result.json) |
| `dev/{mid}/{did}/ota/notify` | cloud → device | 1 | no | [OtaNotifyMsg](../schemas/mqtt/ota-notify.json) |
| `dev/{mid}/{did}/ota/progress` | device → cloud | 1 | no | [OtaProgressMsg](../schemas/mqtt/ota-progress.json) |
| `dev/{mid}/{did}/analytics` | device → cloud | 0 | no | [AnalyticsMsg](../schemas/mqtt/analytics.json) |
| `dev/{mid}/{did}/lwt` | broker → cloud (Last Will) | 1 | no | [LastWillMsg](../schemas/mqtt/lwt.json) |

**ACL.** Devices may publish only device-to-cloud topics and subscribe only cloud-to-device topics under their own
prefix; no `#` wildcards. Anything else is refused (MQTT 5 reason code `0x87`) and counted.

**Gateways** (HW type category `gateway`) relay sub-devices under
`dev/{mid}/{gateway did}/sub/{sub did}/<suffix>` with the same suffixes and payloads (except `lwt`). A gateway may
subscribe to `dev/{mid}/{gateway did}/sub/+/state/desired` (and the other cloud-to-device suffixes) with `+` in the
sub-device position only. A sub-device counts as online while its gateway is online and it reported within its
`report_interval_s`.

## Payload rules

- UTF-8 JSON, at most **16 KiB** per message. Field names are `snake_case`.
- Every device-to-cloud message (except the Last Will) carries the [envelope](../schemas/common.json):
  `v` = 1, `ts` = Unix time in **milliseconds**, `seq` = counter starting at 0 after each boot and increasing by one
  per message, `boot` = random 8-32 character id chosen at boot. The cloud drops a repeated `(boot, seq)`, so retries
  after a lost PUBACK are safe.
- Unknown fields must be ignored by the receiver. The schemas are strict so that tests catch typos; never send fields
  that are not in the schema version you implement.
- Rate limit: 10 messages/s sustained, bursts up to 50. Excess messages are dropped and counted in the fleet health.
  Batch telemetry values of one moment into one message.

## Telemetry vs. events vs. state

| Use | For | Example |
| --- | --- | --- |
| `telemetry` | Sampled sensor values, sent periodically or on significant change | power 42.1 W, temperature 21.4 °C |
| `event` | Something that happened at a moment, may trigger alerts and automations | button double press, door opened, leak |
| `state/reported` | Current settable state of actuators (what the user controls) | switch on, brightness 60 |

Send each sensor value at least every `report_interval_s` of its channel, and promptly on a significant change
(e.g. > 0.5 °C or > 5 %), but not more often than once per second per channel.
