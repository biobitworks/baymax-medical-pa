import type { CareWorkspace } from '../shared/workspace';

type HealthOverview = {
  today: { hydrationMl: number; activeMinutes: number };
  todayCheckin: { energy: string } | null;
  metrics: { date: string; hydrationMl: number; activeMinutes: number }[];
  checkins: { date: string; energy: string }[];
};

export function initializeHealthOverview(workspace: CareWorkspace, data: HealthOverview): CareWorkspace {
  if (workspace.ready) return workspace;
  const energy = data.todayCheckin?.energy.toLowerCase();
  const levels = { low: 'Low', okay: 'Okay', good: 'Good', great: 'Great' } as const;
  const checkins = new Map(data.checkins.map(item => [item.date, item.energy]));
  return {
    ...workspace,
    water: Math.min(8, Math.max(0, Math.round(data.today.hydrationMl / 250))),
    activeMinutes: data.today.activeMinutes,
    energy: energy && energy in levels ? levels[energy as keyof typeof levels] : workspace.energy,
    week: [...data.metrics].reverse().map(item => ({ ...item, energy: checkins.get(item.date) as CareWorkspace['week'][number]['energy'] })),
  };
}
