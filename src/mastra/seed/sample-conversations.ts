import type { StoredConversation } from "../../shared/workspace";

interface Turn { user: string; assistant: string }

const toConversation = (turns: Turn[], start: Date): StoredConversation => {
  const messages: StoredConversation["messages"] = [];
  let parentId: string | null = null;
  let at = start.getTime();
  const stamp = () => new Date((at += 4000)).toISOString();
  turns.forEach((turn, n) => {
    const userId = `seed-u${n}-${start.getTime()}`;
    const assistantId = `seed-a${n}-${start.getTime()}`;
    messages.push({
      parentId,
      message: { id: userId, role: "user", createdAt: stamp(), content: [{ type: "text", text: turn.user }], metadata: { custom: {} }, attachments: [] },
    } as StoredConversation["messages"][number]);
    messages.push({
      parentId: userId,
      message: {
        id: assistantId, role: "assistant", createdAt: stamp(), content: [{ type: "text", text: turn.assistant }],
        status: { type: "complete", reason: "unknown" },
        metadata: { steps: [], custom: {}, unstable_data: [], unstable_state: null, unstable_annotations: [] },
      },
    } as StoredConversation["messages"][number]);
    parentId = assistantId;
  });
  return { headId: parentId, messages };
};

const daysAgo = (today: Date, days: number, hour: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

export interface SampleConversation {
  id: string;
  title: string;
  updatedAt: string;
  conversation: StoredConversation;
}

/** Fixed ids so reseeding replaces the samples instead of duplicating them. */
export const SAMPLE_CONVERSATIONS = (today: Date): SampleConversation[] => [
  {
    id: "5a0c1e00-0000-4000-8000-000000000001",
    title: "What do my latest HbA1c and glucose results mean?",
    when: daysAgo(today, 1, 18),
    turns: [{
      user: "What do my latest HbA1c and glucose results mean?",
      assistant: "From your records: on 2026-08-12 your HbA1c was 6.7% (flagged above the 5.6% reference) and fasting glucose was 132 mg/dL. In April they were 6.9% and 141 mg/dL, so both have moved down a little. I can't diagnose anything, but this is a good trend to bring to your next appointment. Would you like me to draft a short brief with these numbers and a few questions for your doctor?",
    }, {
      user: "Yes, what questions should I ask?",
      assistant: "A few to consider: What HbA1c target makes sense for me? How often should I be retested? Are there lifestyle changes you'd prioritize first, like movement, meals, or sleep? Is there anything in my lipid panel (ApoB and LDL were flagged above range) we should follow up on together?",
    }],
  },
  {
    id: "5a0c1e00-0000-4000-8000-000000000002",
    title: "Give me a summary of my last week",
    when: daysAgo(today, 3, 9),
    turns: [{
      user: "Give me a summary of my last week",
      assistant: "Here's the gentle version. Energy was on the lower side more often than not, water intake stayed well under the usual target, and movement was light, with a short run or two. Low energy tended to show up on the days with less water and shorter sleep, which is worth watching. One small idea: keep a glass of water at your desk and aim for a ten-minute walk after lunch.",
    }],
  },
  {
    id: "5a0c1e00-0000-4000-8000-000000000003",
    title: "Help me ease into a running routine",
    when: daysAgo(today, 6, 20),
    turns: [{
      user: "Help me ease into a running routine",
      assistant: "Love that. Since you run a few times a month at an easy pace, start with two or three short run-walk sessions a week, around 15 to 20 minutes, and keep the pace conversational. Add a little time or distance only every second week. If anything hurts or feels off, pause and check in with your clinician.",
    }],
  },
].map(({ when, turns, ...rest }: any) => ({ ...rest, updatedAt: when.toISOString(), conversation: toConversation(turns, when) }));
