import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// The injected manifest contains only public build assets, icons and the offline
// page. No runtime caching: health data and API responses stay out of CacheStorage.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
const navigation = new NetworkOnly();
registerRoute(new NavigationRoute(async options => {
  try {
    return await navigation.handle(options);
  } catch {
    return await matchPrecache('/offline.html');
  }
}, { denylist: [/^\/api(?:\/|\?|$)/, /^\/travel(?:\/|\?|$)/] }));

// Initial installation takes control. Later versions wait for explicit consent.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
