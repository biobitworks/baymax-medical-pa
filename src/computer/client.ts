// Capabilities live only in this module; never persist them or put them in model messages.
let capability: { value: string; expiresAt: number } | null = null;

export function getComputerCapability(): string | undefined {
  if (capability && capability.expiresAt <= Date.now()) capability = null;
  return capability?.value;
}

export function lockComputer() { capability = null; }

export class ComputerError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function responseError(response: Response, secret?: string): Promise<never> {
  let message = `Computer request failed (${response.status}).`;
  try {
    const data = await response.json();
    if (typeof data.error === 'string') message = data.error;
    else if (typeof data.message === 'string') message = data.message;
  } catch { /* A proxy may return a non-JSON error. */ }
  if (secret) message = message.split(secret).join('[redacted]');
  if (response.status === 401 || response.status === 403) {
    lockComputer();
    message = 'Computer access expired or was denied. Unlock it again with your private access key.';
  }
  throw new ComputerError(message, response.status);
}

export async function unlockComputer(accessKey: string) {
  lockComputer();
  const response = await fetch('/computer/session', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { authorization: `Bearer ${accessKey}`, 'content-type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) return responseError(response, accessKey);
  const data = await response.json();
  if (typeof data.capability !== 'string' || !data.capability || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) {
    throw new ComputerError('The computer returned an invalid access session.', 502);
  }
  capability = { value: data.capability, expiresAt: data.expiresAt };
  return { expiresAt: data.expiresAt as number };
}

export async function computerRequest<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  if (!/^\/computer\/(?:status|actions|screenshot|control)$/.test(path) && !(path === '/computer/session' && method === 'DELETE')) throw new ComputerError('Invalid computer endpoint.', 400);
  const token = getComputerCapability();
  if (!token) throw new ComputerError('Computer access expired. Unlock it again.', 401);
  const response = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) return responseError(response, token);
  if (response.headers.get('content-type')?.includes('image/')) return await response.blob() as T;
  return (response.status === 204 ? undefined : await response.json()) as T;
}
