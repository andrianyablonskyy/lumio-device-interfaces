/*
 * Lumio device protocol v1: constants for device firmware (C99, no dependencies).
 * The normative description is in docs/ and schemas/; test/c-header.test.ts keeps these values equal to
 * src/constants.ts. Topic formats take (mid, did) or (mid, gateway did, sub-device did).
 */
#ifndef LUMIO_DEVICE_H
#define LUMIO_DEVICE_H

#define LUMIO_PROTOCOL_VERSION 1

/* MQTT */
#define LUMIO_MQTT_PORT 8883
#define LUMIO_MQTT_KEEPALIVE_S 60
#define LUMIO_MQTT_SESSION_EXPIRY_S 3600
#define LUMIO_MQTT_MAX_PAYLOAD_BYTES 16384
#define LUMIO_MQTT_RATE_SUSTAINED_PER_S 10
#define LUMIO_MQTT_RATE_BURST 50

/* Topics: snprintf(buf, len, LUMIO_TOPIC_FMT, mid, did, LUMIO_TOPIC_TELEMETRY) */
#define LUMIO_TOPIC_FMT "dev/%s/%s/%s"
#define LUMIO_SUB_TOPIC_FMT "dev/%s/%s/sub/%s/%s"
#define LUMIO_TOPIC_TELEMETRY "telemetry"          /* device -> cloud, QoS 0 */
#define LUMIO_TOPIC_EVENT "event"                  /* device -> cloud, QoS 1 */
#define LUMIO_TOPIC_STATE_REPORTED "state/reported" /* device -> cloud, QoS 1, retained */
#define LUMIO_TOPIC_STATE_DESIRED "state/desired"  /* cloud -> device, QoS 1, retained */
#define LUMIO_TOPIC_CLAIM "claim"                  /* device -> cloud, QoS 1 */
#define LUMIO_TOPIC_CLAIM_RESULT "claim/result"    /* cloud -> device, QoS 1 */
#define LUMIO_TOPIC_OTA_NOTIFY "ota/notify"        /* cloud -> device, QoS 1 */
#define LUMIO_TOPIC_OTA_PROGRESS "ota/progress"    /* device -> cloud, QoS 1 */
#define LUMIO_TOPIC_ANALYTICS "analytics"          /* device -> cloud, QoS 0 */
#define LUMIO_TOPIC_LWT "lwt"                      /* Last Will, QoS 1 */
#define LUMIO_LWT_PAYLOAD "{\"online\":false}"

/* Reserved names */
#define LUMIO_DEVICE_CHANNEL "device"
#define LUMIO_DESIRED_FACTORY_RESET "factory_reset"
#define LUMIO_DESIRED_JOIN_MODE "join_mode"
#define LUMIO_DESIRED_JOIN_TOKEN "join_token"

/* Timing */
#define LUMIO_CLAIM_TOKEN_TTL_S 600
#define LUMIO_CLAIM_RESULT_TIMEOUT_S 15
#define LUMIO_OTA_PROGRESS_MIN_INTERVAL_S 5
#define LUMIO_OTA_ROLLBACK_CONNECT_TIMEOUT_S 300
#define LUMIO_ANALYTICS_MIN_PERIOD_S 300
#define LUMIO_SIGNATURE_TOLERANCE_S 300

/* Pairing over Bluetooth LE (128-bit UUIDs) */
#define LUMIO_BLE_SERVICE_UUID "6c756d69-6f00-4b1e-9e00-000000000001"
#define LUMIO_BLE_INFO_UUID "6c756d69-6f00-4b1e-9e00-000000000002"      /* read: DeviceInfo JSON */
#define LUMIO_BLE_PROVISION_UUID "6c756d69-6f00-4b1e-9e00-000000000003" /* write: provisioning blob frames */
#define LUMIO_BLE_STATUS_UUID "6c756d69-6f00-4b1e-9e00-000000000004"    /* notify: ProvisionStatus JSON */
#define LUMIO_BLE_LOCAL_NAME_PREFIX "Lumio-"
#define LUMIO_BLE_FRAME_LAST 0x80
#define LUMIO_BLE_FRAME_INDEX_MASK 0x7f

/* Pairing in Wi-Fi setup mode */
#define LUMIO_AP_SSID_PREFIX "Lumio-"
#define LUMIO_AP_ADDRESS "192.168.4.1"

/* Provisioning blob: version | app ephemeral P-256 public key (65) | nonce (12) | ciphertext | GCM tag (16) */
#define LUMIO_PROVISION_BLOB_VERSION 1
#define LUMIO_PROVISION_HKDF_INFO "lumio-provision-v1"
#define LUMIO_PROVISION_MAX_PLAINTEXT_BYTES 512
#define LUMIO_PROVISION_PUBKEY_BYTES 65
#define LUMIO_PROVISION_NONCE_BYTES 12
#define LUMIO_PROVISION_TAG_BYTES 16

/* OTA states (OtaProgressMsg.state) */
#define LUMIO_OTA_OFFERED "offered"
#define LUMIO_OTA_DEFERRED "deferred"
#define LUMIO_OTA_DOWNLOADING "downloading"
#define LUMIO_OTA_VERIFIED "verified"
#define LUMIO_OTA_INSTALLING "installing"
#define LUMIO_OTA_SUCCESS "success"
#define LUMIO_OTA_FAILED "failed"
#define LUMIO_OTA_ROLLED_BACK "rolled_back"

#endif /* LUMIO_DEVICE_H */
