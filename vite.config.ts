import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "MASTRA_");
  const agentUrl = env.MASTRA_API_URL || "http://localhost:4111";
  const proxy = Object.fromEntries(
    ["/computer", "/api", "/care-state", "/travel", "/health", "/records", "/conversations", "/demo/reset"].map((p) => [p, agentUrl]),
  );
  return {
  plugins: [VitePWA({
    strategies: "injectManifest",
    srcDir: "src",
    filename: "sw.js",
    registerType: "prompt",
    injectRegister: false,
    includeManifestIcons: false,
    injectManifest: {
      globPatterns: ["assets/**/*.{js,css}", "icons/*.png", "offline.html"],
    },
    manifest: {
      id: "/",
      name: "Baymax · A little care, every day",
      short_name: "Baymax",
      description: "Your personal care companion for everyday check-ins and healthcare preparation.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f7f8f5",
      theme_color: "#f7f8f5",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
  })],
    preview: { proxy },
    server: {
      host: "0.0.0.0",
      watch: { usePolling: true },
      // Mastra dev server (npm run agent:dev)
      proxy,
    },
  };
});
