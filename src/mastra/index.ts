import { Mastra } from "@mastra/core";
import { baymaxAgent } from "./agents/baymax-agent";

export const mastra = new Mastra({
  agents: { baymaxAgent },
});
