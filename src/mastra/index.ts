import { Mastra } from "@mastra/core";
import { baymaxAgent } from "./agents/baymax-agent";
import { travelRoutes } from "./routes/travel";

export const mastra = new Mastra({
  agents: { baymaxAgent },
  server: { apiRoutes: travelRoutes },
});
