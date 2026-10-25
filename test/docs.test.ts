// Every relative link in the documentation points at a file that exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT } from './helpers/specs.js';

const pages = ['README.md', 'CHANGELOG.md', ...readdirSync(join(ROOT, 'docs')).map((f) => join('docs', f))];

it.each(pages)('%s has no broken relative links', (page) => {
  const text = readFileSync(join(ROOT, page), 'utf8');
  for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (!/^[a-z]+:/.test(target!)) {
      expect(existsSync(join(ROOT, dirname(page), target!)), `${page} -> ${target}`).toBe(true);
    }
  }
});
