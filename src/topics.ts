// MQTT topic names and the broker ACL: a device may use only dev/{mid}/{its did}/..., a gateway also the topics of its
// sub-devices under dev/{mid}/{gateway did}/sub/{sub did}/...
import { TOPICS, type TopicKind } from './constants.js';

const DID = /^[a-z0-9]{3,8}-[A-Za-z0-9]{8,32}$/;
const SUFFIX_TO_KIND = new Map<string, TopicKind>(Object.entries(TOPICS).map(([kind, t]) => [t.suffix, kind as TopicKind]));

export interface ParsedTopic {
  mid: string;
  did: string;
  sub_did?: string;
  kind: TopicKind;
}

export function midOf(did: string): string {
  if (!DID.test(did)) {
    throw new TypeError(`invalid device id: ${did}`);
  }
  return did.slice(0, did.indexOf('-'));
}

export function topic(did: string, kind: TopicKind, subDid?: string): string {
  const base = `dev/${midOf(did)}/${did}`;
  if (subDid !== undefined && !DID.test(subDid)) {
    throw new TypeError(`invalid sub-device id: ${subDid}`);
  }
  return `${base}${subDid === undefined ? '' : `/sub/${subDid}`}/${TOPICS[kind].suffix}`;
}

export function parseTopic(name: string): ParsedTopic | null {
  const m = /^dev\/([a-z0-9]{3,8})\/([^/]+)(?:\/sub\/([^/]+))?\/(.+)$/.exec(name);
  if (!m) {
    return null;
  }
  const [, mid, did, subDid, suffix] = m as unknown as [string, string, string, string | undefined, string];
  const kind = SUFFIX_TO_KIND.get(suffix);
  if (!kind || !DID.test(did) || midOf(did) !== mid || (subDid !== undefined && !DID.test(subDid))) {
    return null;
  }
  return subDid === undefined ? { mid, did, kind } : { mid, did, sub_did: subDid, kind };
}

export interface AclRequest {
  clientId: string;
  action: 'publish' | 'subscribe';
  topic: string;
  gateway?: boolean;
}

// Mirrors the broker ACL: publish only device-to-cloud topics, subscribe only cloud-to-device topics, own prefix only.
// Subscriptions may use the single-level wildcard '+' for the sub-device id (gateways) and nothing else.
export function aclAllows({ clientId, action, topic: name, gateway = false }: AclRequest): boolean {
  if (!DID.test(clientId)) {
    return false;
  }
  const concrete = gateway && action === 'subscribe' ? name.replace(/\/sub\/\+\//, '/sub/x0000000-00000000/') : name;
  if (/[+#]/.test(concrete)) {
    return false;
  }
  const parsed = parseTopic(concrete);
  if (!parsed || parsed.did !== clientId || (parsed.sub_did !== undefined && !gateway)) {
    return false;
  }
  const dir = TOPICS[parsed.kind].dir;
  if (parsed.kind === 'lwt') {
    return action === 'publish' && parsed.sub_did === undefined;
  }
  return action === 'publish' ? dir === 'D' : dir === 'C';
}
