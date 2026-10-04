# Baymax PWA

The user selected a PWA using the existing React/Vite interface. Add a root-scoped standalone manifest and Baymax PNG icons, including maskable and Apple touch icons. Offer an install button when the browser exposes its install prompt and Share > Add to Home Screen guidance on iOS.

Use vite-plugin-pwa with a custom Workbox worker. Precache only versioned JS/CSS, icons and a static offline page. Navigation uses the network and falls back to that page when disconnected. API requests, conversations, profiles, and external resources are never put in the service-worker cache. Existing session state remains unchanged.

Updates wait for user consent; explicitly explain that reloading clears the current session. Disable the worker in development. Add standalone safe-area padding and production hosting headers. Verify the production build in Chromium: manifest/icons, worker registration, install control, offline navigation, and sensitive request exclusion. Document browser installation and HTTPS hosting requirements. Deployment is a separate step.
