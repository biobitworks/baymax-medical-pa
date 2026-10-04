import { readFile } from 'node:fs/promises';
const summaryPdf = await readFile(new URL('../../output/pdf/jordan-mercer-health-followup-2026-10-04.pdf', import.meta.url));

// Synthetic data only. Every backend request is intercepted before it reaches the server.
export async function mockReadmeData(page) {
  const workspace = {
    "state": {
      "version": 1,
      "remember": false,
      "ready": true,
      "name": "Jordan",
      "energy": "",
      "activeMinutes": 0,
      "week": [],
      "done": [],
      "water": 3,
      "tripReady": false,
      "checklist": [],
      "reminders": true,
      "nudge": "Gentle",
      "city": "San Francisco",
      "travelDate": "2026-10-09",
      "date": "2026-10-10",
      "goal": "Build Personal Agents Hackathon",
      "planItems": [
        {
          "label": "Take a 10-minute walk",
          "done": false
        },
        {
          "label": "Make time for a real meal",
          "done": false
        },
        {
          "label": "Pack medication documents",
          "done": false
        },
        {
          "label": "Set a wind-down reminder",
          "done": false
        },
        {
          "label": "Schedule your next routine checkup",
          "done": false
        }
      ],
      "brief": "HEALTH BRIEF — review before sharing\n\nPatient: Jordan Mercer (sample profile)\nReason for visit: Routine follow-up before travel.\n\nRecent progress: More consistent walks and sleep.\nQuestions: Which records should I bring? When should I repeat my bloodwork?",
      "activePlanId": null,
      "activeBriefId": null,
      "recipient": "",
      "subject": "My health brief for our appointment",
      "conversation": {
        "messages": [],
        "headId": null
      }
    },
    "revision": 0
  };
  const preferences = { name: 'Jordan', goals: { steps: 7500, activeMinutes: 30 }, notifications: 'off', onboarded: true };
  const metrics = [6400, 8100, 5200, 7600, 9100, 4200, 7800].map((steps, i) => {
    const date = new Date(); date.setDate(date.getDate() - i);
    return { date: date.toLocaleDateString('en-CA'), steps, activeMinutes: [26, 38, 20, 34, 45, 18, 31][i], hydrationMl: [1500, 2000, 1750, 2250, 2000, 1500, 2000][i], sleepHours: [7.2, 7.6, 6.8, 7.4, 7.5, 6.9, 7.3][i] };
  });
  const checkins = metrics.map((day, i) => ({ date: day.date, energy: ['good', 'good', 'okay', 'great', 'good', 'okay', 'good'][i] }));
  const daily = metrics.map(day => ({ ...day, achieved: day.steps >= 7500 && day.activeMinutes >= 30 }));
  await page.context().unroute('**/*');
  await page.context().route('**/*', async route => {
    const request = route.request();
    const path = request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    const backend = /^\/(?:api(?:\/|$)|care-state(?:\/|$)|health(?:\/|$)|records(?:\/|$)|conversations(?:\/|$)|demo(?:\/|$)|travel(?:\/|$))/.test(path);
    if (!backend) return route.continue();
    let body = {};
    if (path === '/care-state') body = request.method() === 'GET' ? workspace : { revision: 1 };
    else if (path === '/health/preferences') body = preferences;
    else if (path === '/health/overview') body = { today: metrics[0], todayCheckin: checkins[0], metrics, checkins, metricsSummary: {}, checkinsSummary: {} };
    else if (path === '/health/fitness') body = { preferences, goals: preferences.goals, today: daily[0], daily, achievedDays: 4, weeklyMinutes: 212, weeklyTarget: 210, source: 'demo' };
    else if (path === '/health/summary.pdf') return route.fulfill({ status: 200, contentType: 'application/pdf', body: summaryPdf });
    else if (path === '/health/apple/connection') body = { connected: false, lastSyncAt: null, daily: [] };
    else if (path === '/conversations') body = { conversations: [] };
    else if (path.startsWith('/conversations/')) body = { conversation: workspace.state.conversation };
    else if (path === '/health/runs') body = { runs: [], summary: { totalMiles: 0, totalMinutes: 0, averagePaceMinPerMi: 0, longestRunMi: 0, observations: [] } };
    else if (path === '/health/water') body = { today: metrics[0] };
    else if (path === '/health/checkin') body = { checkin: checkins[0] };
    else return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'README recording: backend requests are mocked.' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}
