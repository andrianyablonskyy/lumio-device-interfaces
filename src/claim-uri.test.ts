import { expect, it } from 'vitest';
import { claimUri, parseClaimUri } from './claim-uri.js';
import { validate } from './schemas.js';

it('builds and parses QR claim URIs', () => {
  const uri = claimUri('acme-P2A1B2C3D4', 'mfrwgy3bmjzgk2ltnfzw4zlmmu');
  expect(validate('ClaimUri', uri).ok).toBe(true);
  expect(parseClaimUri(uri)).toEqual({ did: 'acme-P2A1B2C3D4', claim_secret: 'mfrwgy3bmjzgk2ltnfzw4zlmmu' });
  expect(parseClaimUri('lumio://claim?did=acme-P2A1B2C3D4&cs=short')).toBeNull();
  expect(parseClaimUri('https://evil.example/?did=acme-P2A1B2C3D4&cs=mfrwgy3bmjzgk2ltnfzw4zlmmu')).toBeNull();
  expect(() => claimUri('ACME', 'x')).toThrow();
});
