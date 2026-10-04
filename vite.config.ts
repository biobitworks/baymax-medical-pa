import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    watch: { usePolling: true },
    // Mastra dev server (npm run agent:dev)
    proxy: {
      "/api": "http://localhost:4111",
      "/travel": "http://localhost:4111",
      "/health": "http://localhost:4111",
      "/records": "http://localhost:4111",
    },
  },
});
