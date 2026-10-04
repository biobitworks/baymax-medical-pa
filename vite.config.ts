import { defineConfig } from "vite";
const proxy = { "/api": "http://localhost:4111", "/care-state": "http://localhost:4111", "/travel": "http://localhost:4111", "/health": "http://localhost:4111" };
export default defineConfig({
  preview: { proxy },
  server: {
    host: "0.0.0.0",
    watch: { usePolling: true },
    // Mastra dev server (npm run agent:dev)
    proxy,
  },
});
