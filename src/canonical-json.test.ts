import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json.js';

describe('canonicalJson', () => {
  it('sorts keys at every level and drops whitespace and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: [true, null, 'x'], c: 'é"' }, z: undefined })).toBe('{"a":{"c":"é\\"","d":[true,null,"x"]},"b":1}');
  });

  it('refuses numbers that would not round-trip identically everywhere', () => {
    expect(() => canonicalJson({ size: 1.5 })).toThrow();
    expect(() => canonicalJson({ size: 2 ** 60 })).toThrow();
  });
});
