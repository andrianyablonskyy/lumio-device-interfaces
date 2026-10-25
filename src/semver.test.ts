import { describe, expect, it } from 'vitest';
import { acceptsUpdate, compareSemver } from './semver.js';

describe('semver', () => {
  it('orders versions, pre-releases before releases', () => {
    const sorted = [
      '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1',
      '1.0.0', '1.2.0', '1.10.0', '2.0.0'
    ];
    expect([...sorted].reverse().sort(compareSemver)).toEqual(sorted);
  });

  it('accepts only strictly newer firmware that satisfies min_from_version (anti-rollback)', () => {
    expect(acceptsUpdate('1.4.2', '1.5.0')).toBe(true);
    expect(acceptsUpdate('1.5.0', '1.5.0')).toBe(false);
    expect(acceptsUpdate('1.5.0', '1.4.9')).toBe(false);
    expect(acceptsUpdate('1.1.0', '1.5.0', '1.2.0')).toBe(false);
    expect(acceptsUpdate('1.2.0', '1.5.0', '1.2.0')).toBe(true);
    expect(() => compareSemver('1.2', '1.2.0')).toThrow();
  });
});
