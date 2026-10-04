import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComputerAccess, checkComputerOrigin } from '../src/mastra/computer/access';

test('computer access rejects missing keys and issues expiring capabilities after unlock', () => {
  let now = 100;
  const access = new ComputerAccess('x'.repeat(32), () => now);
  assert.throws(() => access.unlock('wrong'), /access key/i);
  assert.equal(access.allows('x'.repeat(32)), false, 'server key is not an agent capability');
  const grant = access.unlock('x'.repeat(32));
  assert.equal(access.allows(grant.capability), true);
  now = grant.expiresAt;
  assert.equal(access.allows(grant.capability), false);
});
test('locking revokes a capability and disabled setup cannot be unlocked', () => {
  const access = new ComputerAccess('x'.repeat(32));
  const grant = access.unlock('x'.repeat(32));
  access.revoke(grant.capability);
  assert.equal(access.allows(grant.capability), false);
  assert.throws(() => new ComputerAccess('').unlock(''), /configured/i);
});
test('mutation origins must match production; development supports local Vite proxy', () => {
  const request = (origin?: string) => new Request('http://localhost:4111/computer/actions', {method:'POST', headers: origin ? {origin} : {}});
  assert.equal(checkComputerOrigin(request('https://care.example'), 'https://care.example', true), true);
  assert.equal(checkComputerOrigin(request('https://other.example'), 'https://care.example', true), false);
  assert.equal(checkComputerOrigin(request(), undefined, false), false);
  assert.equal(checkComputerOrigin(request('http://localhost:5173'), undefined, false), true);
  assert.equal(checkComputerOrigin(request('http://evil.example'), undefined, false), false);
});
