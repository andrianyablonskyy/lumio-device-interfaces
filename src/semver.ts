// Version ordering for anti-rollback and min_from_version checks. Pre-release versions sort before their release.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;

export function parseSemver(version: string): { core: [number, number, number]; pre?: string } {
  const m = SEMVER.exec(version);
  if (!m) {
    throw new TypeError(`not a semantic version: ${version}`);
  }
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] };
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const d = pa.core[i]! - pb.core[i]!;
    if (d !== 0) {
      return Math.sign(d);
    }
  }
  if (pa.pre === pb.pre) {
    return 0;
  }
  if (pa.pre === undefined) {
    return 1;
  }
  if (pb.pre === undefined) {
    return -1;
  }
  return comparePre(pa.pre, pb.pre);
}

function comparePre(a: string, b: string): number {
  const xa = a.split('.');
  const xb = b.split('.');
  for (let i = 0; i < Math.max(xa.length, xb.length); i++) {
    const ia = xa[i];
    const ib = xb[i];
    if (ia === undefined) {
      return -1;
    }
    if (ib === undefined) {
      return 1;
    }
    const na = /^\d+$/.test(ia);
    const nb = /^\d+$/.test(ib);
    if (na && nb && Number(ia) !== Number(ib)) {
      return Math.sign(Number(ia) - Number(ib));
    }
    if (na !== nb) {
      return na ? -1 : 1;
    }
    if (ia !== ib) {
      return ia < ib ? -1 : 1;
    }
  }
  return 0;
}

// The device-side OTA acceptance rule: strictly newer than the running version, and min_from_version satisfied.
export function acceptsUpdate(running: string, offered: string, minFromVersion?: string): boolean {
  return compareSemver(offered, running) > 0 && (minFromVersion === undefined || compareSemver(running, minFromVersion) >= 0);
}
