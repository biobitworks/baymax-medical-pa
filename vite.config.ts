import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "MASTRA_");
  const agentUrl = env.MASTRA_API_URL || "http://localhost:4111";
  const proxy = Object.fromEntries(["/api", "/care-state", "/travel", "/health", "/records", "/conversations", "/demo"].map(path => [path, agentUrl]));
  return { preview: { proxy }, server: { host: "0.0.0.0", watch: { usePolling: true }, proxy } };
});
