import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "MASTRA_");
  const agentUrl = env.MASTRA_API_URL || "http://localhost:4111";
  return {
    server: {
      host: "0.0.0.0",
      watch: { usePolling: true },
      // Mastra dev server (npm run agent:dev)
      proxy: {
        "/api": agentUrl,
        "/travel": agentUrl,
        "/health": agentUrl,
      },
    },
  };
});
