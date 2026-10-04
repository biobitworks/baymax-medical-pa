import { registerApiRoute } from '@mastra/core/server';
import { createAppleHealthHandler } from '../persistence/apple-health-handler';
import { appleHealthStore } from '../lib/health-reader';

const handle = createAppleHealthHandler(appleHealthStore);
export const appleHealthRoutes = [
  ...['GET', 'POST', 'DELETE'].map(method => registerApiRoute('/health/apple/connection', {
    method: method as 'GET' | 'POST' | 'DELETE', handler: c => handle(c.req.raw),
  })),
  registerApiRoute('/health/apple/import', { method: 'POST', handler: c => handle(c.req.raw) }),
];
