import { planSchema, briefSchema, type CareWorkspace } from '../shared/workspace';
export function applyToolResult(previous: CareWorkspace, kind: 'plan' | 'brief', result: unknown, toolCallId: string): CareWorkspace {
  if (kind === 'brief') return { ...previous, brief: briefSchema.parse(result).brief, activeBriefId: toolCallId };
  const plan = planSchema.parse(result);
  return { ...previous, goal: plan.title, date: plan.startDate ?? previous.date, planItems: plan.items, activePlanId: toolCallId,
    done: [...previous.done.filter(label => !plan.items.some(item => item.label === label)), ...plan.items.filter(item => item.done).map(item => item.label)] };
}
export function historicalCard(workspace: Pick<CareWorkspace, 'activePlanId' | 'activeBriefId'>, kind: string, toolCallId: string, result: unknown) {
  if (kind === 'plan' && toolCallId !== workspace.activePlanId) { const parsed = planSchema.safeParse(result); if (parsed.success) return { kind: 'plan' as const, data: parsed.data }; }
  if (kind === 'brief' && toolCallId !== workspace.activeBriefId) { const parsed = briefSchema.safeParse(result); if (parsed.success) return { kind: 'brief' as const, data: parsed.data }; }
  return undefined;
}
