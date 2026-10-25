// Generates src/generated/types.ts (TypeScript types for every schema) from schemas/. Run: npm run gen.
// test/types.test.ts fails when the committed file is stale.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTypes } from '../test/helpers/render-types.js';

const out = join(import.meta.dirname, '..', 'src', 'generated', 'types.ts');
writeFileSync(out, await renderTypes());
console.log(`wrote ${out}`);
