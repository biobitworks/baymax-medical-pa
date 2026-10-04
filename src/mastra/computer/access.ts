import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
const hash = (value: string) => createHash('sha256').update(value).digest();
const lifetime = 60 * 60 * 1000;

/** The deployment key only unlocks the UI; agent calls require a short-lived grant. */
export class ComputerAccess {
  private grants = new Map<string, number>();
  constructor(private key: string, private now: () => number = Date.now) {}
  get configured() { return this.key.length >= 32; }
  unlock(key: string) {
    if (!this.configured) throw new Error('Computer access is not configured. Set BAYMAX_COMPUTER_ACCESS_KEY (at least 32 characters).');
    if (!timingSafeEqual(hash(key), hash(this.key))) throw new Error('The computer access key is incorrect.');
    this.prune();
    if (this.grants.size >= 32) throw new Error('Too many open computer sessions. Lock an existing session or wait for it to expire.');
    const capability = randomBytes(32).toString('base64url');
    const expiresAt = this.now() + lifetime;
    this.grants.set(hash(capability).toString('hex'), expiresAt);
    return { capability, expiresAt };
  }
  allows(capability: unknown): boolean {
    this.prune();
    return typeof capability === 'string' && this.grants.has(hash(capability).toString('hex'));
  }
  revoke(capability: string) { this.grants.delete(hash(capability).toString('hex')); }
  private prune() { for (const [key, expires] of this.grants) if (expires <= this.now()) this.grants.delete(key); }
}

export function checkComputerOrigin(request: Request, appOrigin = process.env.APP_ORIGIN, production = process.env.NODE_ENV === 'production') {
  const supplied = request.headers.get('origin');
  if (!supplied) return false;
  try {
    const origin = new URL(supplied);
    if (appOrigin) return origin.origin === new URL(appOrigin).origin;
    const server = new URL(request.url);
    const local = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    return origin.origin === server.origin || (!production && server.protocol === 'http:' && origin.protocol === 'http:' && local(server.hostname) && local(origin.hostname));
  } catch { return false; }
}
