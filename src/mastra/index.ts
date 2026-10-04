import { Mastra } from "@mastra/core";
import { registerApiRoute } from "@mastra/core/server";
import { createStateHandler } from "./persistence/handler";
import { CareStore } from "./persistence/store";
import { query } from "./persistence/database";
import { LibSQLStore } from "@mastra/libsql";
import { Observability, DefaultExporter, SensitiveDataFilter } from "@mastra/observability";
import { baymaxAgent } from "./agents/baymax-agent";
import { healthRoutes } from "./routes/health";
import { travelRoutes } from "./routes/travel";
import { recordsRoutes } from "./routes/records";
import { conversationRoutes } from "./routes/conversations";
import { demoRoutes } from "./routes/demo";

const handleCareState = createStateHandler(new CareStore(query));

export const mastra = new Mastra({
  agents: { baymaxAgent },
  server: {
    apiRoutes: [...travelRoutes, ...healthRoutes, ...recordsRoutes, ...conversationRoutes, ...demoRoutes, ...["GET", "PUT", "DELETE"].map(method =>
      registerApiRoute("/care-state", {
        method: method as "GET" | "PUT" | "DELETE",
        handler: c => handleCareState(c.req.raw),
      }),
    )],
  },
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
