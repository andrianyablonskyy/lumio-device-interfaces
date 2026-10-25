import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { renderTypes } from './helpers/render-types.js';
import { ROOT } from './helpers/specs.js';

it('src/generated/types.ts is up to date with schemas/ (run npm run gen)', async () => {
  expect(readFileSync(join(ROOT, 'src', 'generated', 'types.ts'), 'utf8')).toBe(await renderTypes());
}, 30_000);
