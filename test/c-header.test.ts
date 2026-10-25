// The C header for firmware must define the same values as src/constants.ts, and compile as C99 when a compiler exists.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as C from '../src/constants.js';
import { validatorFor } from '../src/schemas.js';
import { ROOT } from './helpers/specs.js';

const header = join(ROOT, 'c', 'include', 'lumio_device.h');
const defines = new Map([...readFileSync(header, 'utf8').matchAll(/^#define (LUMIO_\w+) (.+?)(?:\s*\/\*.*\*\/)?$/gm)].map((m) => {
  const raw = m[2]!.trim();
  return [m[1]!, raw.startsWith('"') ? JSON.parse(raw) as string : Number(raw)] as const;
}));

const scalar = Object.entries(C).filter(([, v]) => typeof v === 'string' || typeof v === 'number') as [string, string | number][];

describe('c/include/lumio_device.h', () => {
  it.each(scalar)('defines LUMIO_%s like src/constants.ts', (name, value) => {
    expect(defines.get(`LUMIO_${name}`)).toBe(value);
  });

  it.each(Object.entries(C.TOPICS))('defines the %s topic suffix', (_kind, t) => {
    expect([...defines.values()]).toContain(t.suffix);
  });

  it('defines every OTA progress state', () => {
    const states = (validatorFor('OtaProgressMsg').schema as { properties: { state: { enum: string[] } } }).properties.state.enum;
    for (const s of states) {
      expect(defines.get(`LUMIO_OTA_${s.toUpperCase()}`)).toBe(s);
    }
  });

  it('compiles as C99', () => {
    let cc: string | undefined;
    for (const candidate of ['cc', 'gcc', 'clang']) {
      try {
        execFileSync(candidate, ['--version'], { stdio: 'ignore' });
        cc = candidate;
        break;
      }
      catch {
        // try the next compiler
      }
    }
    if (!cc) {
      console.warn('no C compiler found: skipped compiling lumio_device.h');
      return;
    }
    execFileSync(cc, ['-std=c99', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', '-x', 'c', header]);
  });
});
