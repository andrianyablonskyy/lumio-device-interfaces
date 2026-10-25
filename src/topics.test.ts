import { describe, expect, it } from 'vitest';
import { aclAllows, midOf, parseTopic, topic } from './topics.js';

const did = 'acme-P2A1B2C3D4';
const sub = 'acme-ZB00112233';

describe('topics', () => {
  it('builds and parses device and sub-device topics', () => {
    expect(midOf(did)).toBe('acme');
    expect(topic(did, 'stateReported')).toBe('dev/acme/acme-P2A1B2C3D4/state/reported');
    expect(topic(did, 'telemetry', sub)).toBe('dev/acme/acme-P2A1B2C3D4/sub/acme-ZB00112233/telemetry');
    expect(parseTopic('dev/acme/acme-P2A1B2C3D4/ota/progress')).toEqual({ mid: 'acme', did, kind: 'otaProgress' });
    expect(parseTopic(`dev/acme/${did}/sub/${sub}/event`)).toEqual({ mid: 'acme', did, sub_did: sub, kind: 'event' });
  });

  it('rejects malformed topics', () => {
    expect(parseTopic('dev/acme/acme-P2A1B2C3D4/unknown')).toBeNull();
    expect(parseTopic('dev/other/acme-P2A1B2C3D4/event')).toBeNull();
    expect(parseTopic('dev/acme/acme-short/event')).toBeNull();
    expect(() => topic('not a did', 'event')).toThrow();
  });
});

describe('ACL', () => {
  const allows = (action: 'publish' | 'subscribe', t: string, gateway = false) => aclAllows({ clientId: did, action, topic: t, gateway });

  it('lets a device publish device-to-cloud topics and subscribe cloud-to-device topics under its own prefix', () => {
    expect(allows('publish', topic(did, 'telemetry'))).toBe(true);
    expect(allows('publish', topic(did, 'stateReported'))).toBe(true);
    expect(allows('subscribe', topic(did, 'stateDesired'))).toBe(true);
    expect(allows('subscribe', topic(did, 'otaNotify'))).toBe(true);
  });

  it('denies the wrong direction', () => {
    expect(allows('publish', topic(did, 'stateDesired'))).toBe(false);
    expect(allows('publish', topic(did, 'claimResult'))).toBe(false);
    expect(allows('subscribe', topic(did, 'telemetry'))).toBe(false);
  });

  it('denies other devices, wildcards and sub-device topics for non-gateways', () => {
    expect(allows('publish', topic('acme-OTHER00001', 'telemetry'))).toBe(false);
    expect(allows('subscribe', 'dev/acme/#')).toBe(false);
    expect(allows('subscribe', `dev/acme/${did}/+`)).toBe(false);
    expect(allows('publish', topic(did, 'telemetry', sub))).toBe(false);
  });

  it('lets a gateway relay sub-devices, including a + subscription for their commands', () => {
    expect(allows('publish', topic(did, 'telemetry', sub), true)).toBe(true);
    expect(allows('subscribe', `dev/acme/${did}/sub/+/state/desired`, true)).toBe(true);
    expect(allows('subscribe', `dev/acme/${did}/sub/+/telemetry`, true)).toBe(false);
    expect(allows('publish', topic(did, 'lwt', sub), true)).toBe(false);
  });
});
