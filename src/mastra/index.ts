import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { Observability, DefaultExporter, SensitiveDataFilter } from "@mastra/observability";
import { baymaxAgent } from "./agents/baymax-agent";
import { healthRoutes } from "./routes/health";
import { travelRoutes } from "./routes/travel";

export const mastra = new Mastra({
  agents: { baymaxAgent },
  server: { apiRoutes: [...travelRoutes, ...healthRoutes] },
  // `mastra dev` runs from .mastra/output, so ../../ is the project root.
  // Override with MASTRA_DB_URL if needed.
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: process.env.MASTRA_DB_URL ?? "file:../../mastra.db",
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "baymax",
        // Local only: no data leaves the machine.
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
