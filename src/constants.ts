// Protocol constants. c/include/lumio_device.h defines the same values for firmware (test/c-header.test.ts keeps them equal).

export const PROTOCOL_VERSION = 1;

// MQTT
export const MQTT_PORT = 8883;
export const MQTT_KEEPALIVE_S = 60;
export const MQTT_SESSION_EXPIRY_S = 3600;
export const MQTT_MAX_PAYLOAD_BYTES = 16384;
export const MQTT_RATE_SUSTAINED_PER_S = 10;
export const MQTT_RATE_BURST = 50;

// Topic suffixes after dev/{mid}/{did}/ with direction (D = device to cloud, C = cloud to device), QoS and retain flag.
export const TOPICS = {
  telemetry: { suffix: 'telemetry', dir: 'D', qos: 0, retain: false, schema: 'TelemetryMsg' },
  event: { suffix: 'event', dir: 'D', qos: 1, retain: false, schema: 'EventMsg' },
  stateReported: { suffix: 'state/reported', dir: 'D', qos: 1, retain: true, schema: 'ReportedStateMsg' },
  stateDesired: { suffix: 'state/desired', dir: 'C', qos: 1, retain: true, schema: 'DesiredStateMsg' },
  claim: { suffix: 'claim', dir: 'D', qos: 1, retain: false, schema: 'ClaimMsg' },
  claimResult: { suffix: 'claim/result', dir: 'C', qos: 1, retain: false, schema: 'ClaimResultMsg' },
  otaNotify: { suffix: 'ota/notify', dir: 'C', qos: 1, retain: false, schema: 'OtaNotifyMsg' },
  otaProgress: { suffix: 'ota/progress', dir: 'D', qos: 1, retain: false, schema: 'OtaProgressMsg' },
  analytics: { suffix: 'analytics', dir: 'D', qos: 0, retain: false, schema: 'AnalyticsMsg' },
  lwt: { suffix: 'lwt', dir: 'D', qos: 1, retain: false, schema: 'LastWillMsg' }
} as const;
export type TopicKind = keyof typeof TOPICS;

// Reserved names
export const DEVICE_CHANNEL = 'device';
export const DESIRED_FACTORY_RESET = 'factory_reset';
export const DESIRED_JOIN_MODE = 'join_mode';
export const DESIRED_JOIN_TOKEN = 'join_token';

// Timing
export const CLAIM_TOKEN_TTL_S = 600;
export const CLAIM_RESULT_TIMEOUT_S = 15;
export const OTA_PROGRESS_MIN_INTERVAL_S = 5;
export const OTA_ROLLBACK_CONNECT_TIMEOUT_S = 300;
export const ANALYTICS_MIN_PERIOD_S = 300;
export const SIGNATURE_TOLERANCE_S = 300;

// Pairing over Bluetooth LE
export const BLE_SERVICE_UUID = '6c756d69-6f00-4b1e-9e00-000000000001';
export const BLE_INFO_UUID = '6c756d69-6f00-4b1e-9e00-000000000002';
export const BLE_PROVISION_UUID = '6c756d69-6f00-4b1e-9e00-000000000003';
export const BLE_STATUS_UUID = '6c756d69-6f00-4b1e-9e00-000000000004';
export const BLE_LOCAL_NAME_PREFIX = 'Lumio-';

// Pairing in Wi-Fi setup mode (device hotspot)
export const AP_SSID_PREFIX = 'Lumio-';
export const AP_ADDRESS = '192.168.4.1';

// Provisioning blob (docs/04-pairing.md)
export const PROVISION_BLOB_VERSION = 1;
export const PROVISION_HKDF_INFO = 'lumio-provision-v1';
export const PROVISION_MAX_PLAINTEXT_BYTES = 512;
