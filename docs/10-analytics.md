# 10. Device analytics

Devices report their own health so that you can see how a model and each firmware version behave in the field:
memory, connectivity, restarts and crashes. Analytics carry **no user data** and are separate from user telemetry.

## Device side

Topic `dev/{mid}/{did}/analytics`, QoS 0, schema [AnalyticsMsg](../schemas/mqtt/analytics.json):

```json
{"v":1,"ts":1761213600000,"seq":120,"boot":"b7Kq2Xp9","period_s":3600,"uptime_s":86400,
 "metrics":{"heap_free_b":81234,"heap_min_free_b":60112,"rssi_dbm":-62.5,"wifi_reconnects":0,"mqtt_reconnects":1,
            "publish_failures":0,"cmd_latency_ms":84,"relay_cycles":12,"x_mains_frequency_hz":50.01}}
```

- Send one message right after connecting following a boot, with `reset_reason` (and `crash` after a panic or
  watchdog reset), then one per period. Recommended period: 1 hour; minimum 5 minutes (`period_s` ≥ 300).
- Counters (`*_reconnects`, `publish_failures`, `flash_writes`, `relay_cycles`) cover the period and reset after
  each message. Gauges (`heap_free_b`, `rssi_dbm`, `cpu_temp_c`, `battery_*`) are the current or period-average value.
- Send only metrics your hardware measures. Custom metrics start with `x_` and are numbers.
- Analytics are best effort: do not queue them while offline, and never let them delay commands or telemetry.

| Metric | Unit | Kind |
| --- | --- | --- |
| `heap_free_b`, `heap_min_free_b` | bytes | gauge (min since boot) |
| `rssi_dbm` | dBm | period average |
| `wifi_reconnects`, `mqtt_reconnects`, `publish_failures` | count | period counter |
| `cmd_latency_ms` | ms | period average, desired received → reported |
| `cpu_temp_c` | °C | gauge |
| `battery_mv`, `battery_pct` | mV, % | gauge |
| `flash_writes`, `relay_cycles` | count | period counter (wear) |

`reset_reason`: `power_on`, `software` (planned restart), `ota`, `watchdog`, `panic`, `brownout`, `deep_sleep`,
`external` (reset pin), `unknown`. `crash.code` is your own snake_case code (e.g. the exception name), `crash.pc` the
program counter, `crash.task` the task name, `crash.fw` the version that crashed.

## Manufacturer side

Aggregates per hardware type ([openapi/mfr.yaml](../openapi/mfr.yaml)):

- `GET /mfr/analytics/metrics?hw_type_id=&metric=&fw_version=&from=&to=&resolution=hour|day`: per bucket the number
  of reporting devices and avg, p50, p95, min, max.
- `GET /mfr/analytics/resets?hw_type_id=&from=&to=`: restarts by reason and firmware version, and the top crash codes.

Privacy: buckets with fewer than 5 reporting devices are withheld (`suppressed_buckets`), there are no per-device
queries, and data is kept 90 days hourly and 2 years daily. Compare firmware versions during a campaign to catch a
regression before the next step.
