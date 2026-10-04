import { createHash } from 'node:crypto';

export const SESSION_COOKIE = 'baymax_session';
export function sessionHashOf(request: Request): string | undefined {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? createHash('sha256').update(token).digest('hex') : undefined;
}

export function allowsBrowserWrite(request: Request, configuredOrigin = process.env.APP_ORIGIN): boolean {
  const supplied = request.headers.get('origin');
  if (!supplied) return false;
  const url = new URL(request.url);
  if (supplied === (configuredOrigin || url.origin)) return true;
  if (configuredOrigin || process.env.NODE_ENV === 'production') return false;
  try {
    const origin = new URL(supplied);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.protocol === 'http:';
  } catch { return false; }
}

// This value is always overwritten from the HTTP cookie by server middleware.
export const HEALTH_SESSION_KEY = 'baymaxHealthSession';
export function bindHealthSession(request: Request, context: { set: (key: string, value: unknown) => void }) {
  context.set(HEALTH_SESSION_KEY, sessionHashOf(request) ?? null);
}
