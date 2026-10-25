# 6. Events and notifications

Devices report things that *happen* as events: topic `dev/{mid}/{did}/event`, QoS 1, schema
[EventMsg](../schemas/mqtt/event.json).

```json
{"v":1,"ts":1761210001234,"seq":43,"boot":"b7Kq2Xp9","channel":"door","type":"opened"}
```

Events drive the user's alerts (push, email, SMS for critical ones) and automations ("when the button is double
pressed, turn on the lights"). Lumio decides who is notified and how; the device only reports facts. Send each event
once, as it happens; QoS 1 and the envelope `(boot, seq)` take care of retries and duplicates. Events that happened
while offline may be sent after reconnecting with their original `ts` (keep at most 50 in a queue; drop the oldest).

## Standard event types

Use these types for catalogue capabilities so that the app, alerts and automations understand them without
configuration. List the types a channel emits in its `events` in the HW type.

| Capability | Event types | Notes |
| --- | --- | --- |
| `button` | `single`, `double`, `long` | `data.count` for multi-press beyond double |
| `contact` | `opened`, `closed` | also report the state in telemetry (`contact`: `open`/`closed`) |
| `motion` | `detected`, `cleared` | |
| `water_leak` | `leak`, `dry` | `leak` creates a **critical** alert by default |
| `smoke` | `detected`, `cleared`, `test` | `detected` creates a **critical** alert by default |
| `lock` | `locked`, `unlocked`, `jammed` | `data.method`: `manual`, `keypad`, `remote`, `auto` |
| any actuator | `command_failed` | a desired value could not be applied; `data.code` (e.g. `overload`, `x_motor_stall`) |

Device-level events use channel `device`:

| Type | When | Data |
| --- | --- | --- |
| `reset` | Factory reset started (button or `factory_reset` command); send **before** erasing Wi-Fi | `trigger`: `button` or `cloud` |
| `tamper` | Enclosure opened or device moved, where the hardware detects it | |
| `overheat` | Device shut a load off for its own protection | `temperature_c` |

Manufacturer-specific types start with `x_` (for example `x_filter_change_due`); they appear in the device history
and can be used as automation triggers, but create no default alerts.

## What not to send as events

- Periodic values (temperature, power): use `telemetry`; thresholds are evaluated in the cloud.
- Actuator state (switch on/off): report `state/reported`; the cloud derives "turned on" itself.
- Battery level: telemetry channel `battery` or the `battery` field of the reported state; the cloud raises
  "battery low".
- Connectivity: the cloud detects offline devices from the Last Will and missing messages.

## Notifications for manufacturers

Fleet-level notifications (a unit was claimed, a campaign paused, an update failed) reach your systems as
[webhooks](08-webhooks.md). User alerts are never sent to manufacturers.
