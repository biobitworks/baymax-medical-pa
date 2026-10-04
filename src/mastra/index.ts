import { Mastra } from "@mastra/core";
import { registerApiRoute } from "@mastra/core/server";
import { createStateHandler } from "./persistence/handler";
import { CareStore } from "./persistence/store";
import { query } from "./persistence/database";
import { baymaxAgent } from "./agents/baymax-agent";
import { travelRoutes } from "./routes/travel";

const handleCareState = createStateHandler(new CareStore(query));

export const mastra = new Mastra({
  agents: { baymaxAgent },
  server: {
    apiRoutes: [...travelRoutes, ...["GET", "PUT", "DELETE"].map(method =>
      registerApiRoute("/care-state", {
        method: method as "GET" | "PUT" | "DELETE",
        handler: c => handleCareState(c.req.raw),
      }),
    )],
  },
});
