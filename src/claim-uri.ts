// QR claim: lumio://claim?did=<did>&cs=<claim secret> printed on the device label or box.
const DID = /^[a-z0-9]{3,8}-[A-Za-z0-9]{8,32}$/;
const SECRET = /^[a-z2-7]{26}$/;

export function claimUri(did: string, claimSecret: string): string {
  if (!DID.test(did) || !SECRET.test(claimSecret)) {
    throw new TypeError('invalid did or claim secret');
  }
  return `lumio://claim?did=${did}&cs=${claimSecret}`;
}

export function parseClaimUri(uri: string): { did: string; claim_secret: string } | null {
  const m = /^lumio:\/\/claim\?did=([^&]+)&cs=([^&]+)$/.exec(uri.trim());
  return m && DID.test(m[1]!) && SECRET.test(m[2]!) ? { did: m[1]!, claim_secret: m[2]! } : null;
}
