// One Thing engine and habit ladder: formulas F9.1 to F9.13 (PRD v4 section 7).
// The engine chooses; Genie only words it.

import { round, addDays, daysBetween, fmtHours, sum } from './util.js';

// A launch library has about 120 reviewed actions; the demo ships a representative 34.
// effort: 'high' actions are filtered on Recover days and get feasibility x 0.7 under F8.12.
export const ACTIONS = [
  // Sleep
  { id: 'decaf-pm', pillar: 'sleep', title: 'Switch your afternoon coffee to decaf', twoMin: 'Make only your last coffee a half-caf', uplift: 8, f: 0.8, moment: 'evening', evidence: 'A',
    why: (x) => x.lateCafDays > 0 ? `Late caffeine landed within 8 hours of bed on ${x.lateCafDays} of the last 7 days, and those nights averaged ${fmtHours(x.sleepOnCafDays)}.` : `Caffeine after 2 pm can cut deep sleep even when you fall asleep fine.` },
  { id: 'wind-down', pillar: 'sleep', title: 'Start a 20-minute wind-down at {bed}', twoMin: 'Dim the lights 10 minutes before bed', uplift: 7, f: 0.75, moment: 'evening', evidence: 'B',
    why: (x) => `Your last 3 nights averaged ${fmtHours(x.avgSleep3)}, about ${fmtHours(Math.max(0, x.need - x.avgSleep3))} under your need.` },
  { id: 'same-wake', pillar: 'sleep', title: 'Wake at the same time tomorrow, weekend included', twoMin: 'Set one alarm for your usual wake time', uplift: 6, f: 0.7, moment: 'evening', evidence: 'A',
    why: (x) => `Your sleep midpoint moved ${x.midDev ?? 0} minutes from your usual this week.` },
  { id: 'screens-off', pillar: 'sleep', title: 'Phone on the charger outside the bedroom tonight', twoMin: 'Turn on Do Not Disturb at {bed}', uplift: 5, f: 0.6, moment: 'evening', evidence: 'B',
    why: (x) => `Your average bedtime this week was ${x.bedClock}, later than the ${x.usualBed} you planned.` },
  { id: 'morning-light', pillar: 'sleep', title: 'Get 10 minutes of daylight before 10 am', twoMin: 'Have your coffee by a window', uplift: 4, f: 0.85, moment: 'morning', evidence: 'B',
    why: () => `Morning light anchors your body clock and makes it easier to fall asleep on time.` },
  // Recovery
  { id: 'breathing', pillar: 'recovery', title: 'Do 5 minutes of slow breathing after lunch', twoMin: '6 slow breaths, in for 4 and out for 6', uplift: 5, f: 0.85, moment: 'meal', evidence: 'B',
    why: (x) => x.hrvZ != null ? `Your HRV is ${x.hrvZ > 0 ? '+' : ''}${x.hrvZ} SD from your normal and stress was ${x.stress} of 5 this morning.` : `Stress was ${x.stress ?? 3} of 5 in this morning's check-in.` },
  { id: 'easy-day', pillar: 'recovery', title: 'Swap hard training for a 20-minute easy walk', twoMin: 'Take a 5-minute walk outside', uplift: 7, f: 0.8, moment: 'morning', evidence: 'B',
    why: (x) => `Recovery is ${x.recovery} today${x.rhrDelta != null ? `, with resting heart rate ${x.rhrDelta > 0 ? '+' : ''}${x.rhrDelta} bpm vs your normal` : ''}.` },
  { id: 'nap', pillar: 'recovery', title: 'Take a 20-minute nap before 3 pm', twoMin: 'Lie down with eyes closed for 10 minutes', uplift: 4, f: 0.5, moment: 'meal', evidence: 'B', block: ['shift-late'],
    why: (x) => `Short sleep last night (${fmtHours(x.lastSleep)}) is the main thing pulling Recovery down.` },
  { id: 'stretch', pillar: 'recovery', title: 'Do a 10-minute mobility routine tonight', twoMin: 'Two minutes of hip and back stretches', uplift: 4, f: 0.8, moment: 'evening', evidence: 'C',
    why: (x) => `Soreness was ${x.soreness ?? 3} of 5 this morning.` },
  // Activity
  { id: 'walk-lunch', pillar: 'activity', title: 'Take a 15-minute walk after lunch', twoMin: 'Walk for 5 minutes after you eat', uplift: 8, f: 0.85, moment: 'meal', evidence: 'A', ladder: 'move-daily',
    why: (x) => `You averaged ${x.avgSteps?.toLocaleString?.() ?? '--'} steps this week against a target of ${x.stepTarget.toLocaleString()}.` },
  { id: 'steps-goal', pillar: 'activity', title: 'Reach {target} steps today', twoMin: 'Add one 10-minute walk', uplift: 7, f: 0.75, moment: 'evening', evidence: 'A', ladder: 'move-daily',
    why: (x) => `Yesterday you walked ${x.steps?.toLocaleString?.() ?? '--'} steps.` },
  { id: 'strength-2', pillar: 'activity', title: 'Do a 20-minute strength session today', twoMin: '3 rounds of 10 squats and 10 push-ups', uplift: 9, f: 0.65, effort: 'high', moment: 'morning', evidence: 'A', ladder: 'strength-2',
    why: (x) => `You have ${x.strengthSessions} effective strength session${x.strengthSessions === 1 ? '' : 's'} in the last 7 days; 2 a week is the goal.` },
  { id: 'brisk-30', pillar: 'activity', title: 'Do 30 minutes of brisk walking or cycling', twoMin: '10 brisk minutes', uplift: 8, f: 0.7, effort: 'high', moment: 'morning', evidence: 'A', ladder: 'aerobic-150',
    why: (x) => `You have ${x.mvpa7} of 150 moderate-equivalent minutes this week.` },
  { id: 'stairs', pillar: 'activity', title: 'Take the stairs every time today', twoMin: 'Take the stairs once', uplift: 3, f: 0.9, moment: 'morning', evidence: 'C',
    why: () => `Small bouts of movement add up toward your weekly minutes.` },
  // Nutrition
  { id: 'protein-bfast', pillar: 'nutrition', title: 'Add 25 g of protein to breakfast', twoMin: 'Add a Greek yogurt or two eggs', uplift: 8, f: 0.85, moment: 'meal', evidence: 'A',
    why: (x) => `Yesterday's protein was ${x.proteinPct}% of your ${x.proteinTarget} g target.` },
  { id: 'veg-half', pillar: 'nutrition', title: 'Make half your dinner plate vegetables', twoMin: 'Add one handful of vegetables to dinner', uplift: 6, f: 0.75, moment: 'meal', evidence: 'A',
    why: (x) => `Fiber has been ${x.fiberPct}% of your target on recent logged days.` },
  { id: 'log-meals', pillar: 'nutrition', title: 'Snap a photo of all three meals today', twoMin: 'Snap a photo of lunch', uplift: 6, f: 0.9, moment: 'meal', evidence: 'C',
    why: (x) => `You logged ${x.mealsLogged} of ${x.usualMeals} usual meals, so Fuel only counts part of its weight.` },
  { id: 'fruit-snack', pillar: 'nutrition', title: 'Swap your afternoon snack for fruit and nuts', twoMin: 'Keep a piece of fruit at your desk', uplift: 5, f: 0.8, moment: 'meal', evidence: 'B',
    why: () => `It adds fiber and steadies energy for the late afternoon dip.` },
  { id: 'eat-enough', pillar: 'nutrition', title: 'Have a proper lunch with protein and carbs', twoMin: 'Add a sandwich or rice bowl to lunch', uplift: 7, f: 0.8, moment: 'meal', evidence: 'A', noED: false,
    why: (x) => `Recent days came in under your energy need, which can drag recovery and mood.` },
  { id: 'post-train-protein', pillar: 'nutrition', title: 'Have 25 to 30 g of protein within 2 hours of training', twoMin: 'Drink a glass of milk after training', uplift: 5, f: 0.85, moment: 'meal', evidence: 'A', needsFitness: true,
    why: (x) => `Your goal is ${x.fitnessGoal}, which raises protein to 1.6 g per kg.` },
  // Hydration
  { id: 'water-am', pillar: 'hydration', title: 'Drink a large glass of water before your first coffee', twoMin: 'One glass of water when you wake', uplift: 6, f: 0.9, moment: 'morning', evidence: 'B',
    why: (x) => `You logged ${x.fluidL} L yesterday against a ${x.waterTargetL} L target.` },
  { id: 'bottle', pillar: 'hydration', title: 'Keep a filled bottle on your desk and finish it by 3 pm', twoMin: 'Fill a bottle now', uplift: 6, f: 0.85, moment: 'morning', evidence: 'C',
    why: (x) => `Water is at ${x.hydration ?? 0} today; you are usually behind by mid-afternoon.` },
  // Cycle care (only when cycle tracking is on, F8.12)
  { id: 'cycle-heat', pillar: 'recovery', title: 'Use a heat pack and take a gentle 15-minute walk', twoMin: '5 minutes of gentle stretching with heat', uplift: 4, f: 1.0, moment: 'evening', evidence: 'B', cycleCare: true,
    why: (x) => `You logged ${x.topSymptom} today, and gentle movement and warmth often help.` },
  { id: 'cycle-iron', pillar: 'nutrition', title: 'Add an iron-rich food to dinner (lentils, spinach, lean red meat)', twoMin: 'Add a handful of spinach to one meal', uplift: 4, f: 1.0, moment: 'meal', evidence: 'A', cycleCare: true, needsHeavy: true,
    why: () => `You logged heavy flow on 2 or more days this cycle; iron needs are higher on those days.` },
  { id: 'cycle-sleep', pillar: 'sleep', title: 'Go to bed 30 minutes earlier tonight', twoMin: 'Start winding down 15 minutes earlier', uplift: 5, f: 1.0, moment: 'evening', evidence: 'B', cycleCare: true,
    why: (x) => `Fatigue is high today (${x.fatigue} of 3); extra sleep helps more than pushing through.` },
  // Fitness ladder rungs (F12.20)
  { id: 'program', pillar: 'activity', title: 'Follow today\'s planned session from Train', twoMin: 'Do just the first exercise', uplift: 8, f: 0.7, effort: 'high', moment: 'morning', evidence: 'A', ladder: 'program', needsFitness: true,
    why: (x) => `Your ${x.fitnessGoal} program has ${x.plannedToday} planned today.` },
];

export const LADDER = [
  { id: 'move-daily', title: 'Move daily', rule: 'Hit your step target 5 of 7 days' },
  { id: 'strength-2', title: '2 strength sessions a week', rule: '2 effective sessions every week' },
  { id: 'aerobic-150', title: '150 minutes of aerobic activity', rule: 'Including 1 harder session' },
  { id: 'program', title: 'A structured program', rule: 'Follow your Train plan 3 days a week' },
  { id: 'progressive', title: 'Progressive plan with tests', rule: 'Retest every 8 to 12 weeks' },
];

export const actionById = (id) => ACTIONS.find((a) => a.id === id);

export function fill(text, x) {
  return text.replace('{bed}', x.windDownClock || '10:00 pm').replace('{target}', (x.stepTarget || 8000).toLocaleString());
}

// F9.6 personal success rate with a Beta(3,2) prior
export function successRate(history, id) {
  const h = history.filter((r) => r.actionId === id);
  const offered = h.length;
  const done = h.filter((r) => r.outcome === 'done').length;
  const partly = h.filter((r) => r.outcome === 'partly').length;
  return (3 + done + 0.5 * partly) / (5 + offered);
}

export function habitState(history, today) {
  // history: [{date, actionId, accepted, outcome}] newest last
  const last7 = history.filter((r) => daysBetween(r.date, today) < 7 && daysBetween(r.date, today) >= 0);
  // Focus habit: an action chosen (accepted) twice in 7 days (F9.9); stays 14-21 days.
  let focus = null;
  const accepted = history.filter((r) => r.accepted && daysBetween(r.date, today) <= 21);
  const counts = {};
  for (const r of accepted) (counts[r.actionId] ||= []).push(r.date);
  for (const [id, dates] of Object.entries(counts)) {
    dates.sort();
    for (let i = 1; i < dates.length; i++) {
      if (daysBetween(dates[i - 1], dates[i]) < 7) {
        if (!focus || dates[i - 1] > focus.since) focus = { actionId: id, since: dates[i - 1] };
        break;
      }
    }
  }
  const graduated = [];
  const weekDone = (id, endOffset) => {
    const end = addDays(today, -endOffset);
    return history.filter((r) => r.actionId === id && r.outcome === 'done' && r.date <= end && daysBetween(r.date, end) < 7).length;
  };
  const ids = [...new Set(history.map((r) => r.actionId))];
  for (const id of ids) {
    // F9.10 graduate when done >= 5 of 7 days in 2 consecutive weeks
    for (let off = 0; off < 60; off += 7) {
      if (weekDone(id, off) >= 5 && weekDone(id, off + 7) >= 5) { graduated.push({ actionId: id, on: addDays(today, -off) }); break; }
    }
  }
  if (focus && graduated.find((g) => g.actionId === focus.actionId)) focus = null;
  let focusDetail = null;
  if (focus) {
    const day = daysBetween(focus.since, today) + 1;
    const week = (w) => {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(focus.since, w * 7 + i);
        const r = history.find((x) => x.date === d && x.actionId === focus.actionId);
        days.push({ date: d, outcome: d > today ? 'future' : r?.outcome || (d === today ? 'today' : 'missed') });
      }
      return days;
    };
    focusDetail = { ...focus, day, of: 21, weeks: [week(0), week(1), week(2)], doneThisWeek: weekDone(focus.actionId, 0) };
    if (day > 21) focusDetail = null;
  }
  const skips7 = last7.filter((r) => ['skipped', 'notforme'].includes(r.outcome));
  const backOff = skips7.length >= 3; // F9.11
  // F9.12 keep doing: >= 3 of 7 completions with the largest contribution
  const doneCounts = {};
  for (const r of last7.filter((r) => r.outcome === 'done')) doneCounts[r.actionId] = (doneCounts[r.actionId] || 0) + 1;
  const keep = Object.entries(doneCounts).filter(([id, n]) => n >= 3 && id !== focus?.actionId)
    .map(([id, n]) => ({ id, n, u: (actionById(id)?.uplift || 0) * n }))
    .sort((a, b) => b.u - a.u)[0];
  const graduatedIds = graduated.map((g) => g.actionId);
  const grad = graduatedIds.filter((id) => id !== focus?.actionId);
  const keepDoing = keep ? { actionId: keep.id, n: keep.n } : grad.length ? { actionId: grad[0], n: weekDone(grad[0], 0) } : null;
  return { focus: focusDetail, graduated, backOff, skips7: skips7.length, keepDoing };
}

export function chooseOneThing({ pillars, e, band, readiness, profile, cycle, history, today, facts, fitnessGoal }) {
  // F9.1 gaps
  const gaps = {};
  for (const c of Object.keys(e)) {
    const s = pillars[c]?.score;
    gaps[c] = s == null ? 0 : Math.max(0, 80 - s) * e[c];
  }
  const state = habitState(history, today);
  const lowDay = band === 'Recover' || (readiness != null && readiness < 50);
  const candidates = [];
  for (const a of ACTIONS) {
    // F9.2 candidates
    if (a.cycleCare && !cycle?.enabled) continue;
    if (a.needsHeavy && !cycle?.heavyFlow) continue;
    if (a.cycleCare && a.id === 'cycle-heat' && !(cycle?.SB >= 34)) continue;
    if (a.cycleCare && a.id === 'cycle-sleep' && !(facts.fatigue >= 2)) continue;
    if (a.needsFitness && !fitnessGoal) continue;
    if (!a.cycleCare && !(gaps[a.pillar] > 0) && state.focus?.actionId !== a.id) continue;
    // F9.3 filters
    if (a.effort === 'high' && lowDay) continue;
    if (a.id === 'eat-enough' && !(facts.underEating)) continue;
    if (profile.edFlag && ['eat-enough', 'log-meals'].includes(a.id)) continue;
    if (profile.pregnant && a.effort === 'high') continue;
    if (a.id === 'nap' && profile.shiftWork) continue;
    if (a.id === 'post-train-protein' && !facts.trainedToday) continue;
    candidates.push(a);
  }
  const offered7 = (id) => history.filter((r) => r.actionId === id && daysBetween(r.date, today) < 7 && daysBetween(r.date, today) > 0).length;
  const scored = candidates.map((a) => {
    const c = a.pillar;
    const s = pillars[c]?.score ?? 60;
    const g = Math.min(100 - s, a.uplift) * (e[c] || 0.1) * (a.cycleCare ? 1 : 1); // F9.4
    let f = a.f; // F9.5
    if (cycle?.SB >= 50 && a.effort === 'high') f *= 0.7;
    if (a.cycleCare && cycle?.SB >= 50) f = 1.0;
    const p = successRate(history, a.id); // F9.6
    const n = offered7(a.id);
    const nu = state.focus?.actionId === a.id ? 1.0 : n === 0 ? 1.0 : n === 1 ? 0.7 : 0.4; // F9.7
    const U = g * f * p * nu; // F9.8
    return { action: a, g: round(g, 2), f: round(f, 2), p: round(p, 2), nu, U: round(U, 3) };
  }).sort((a, b) => b.U - a.U || (a.action.effort === 'high') - (b.action.effort === 'high'));
  let pick = scored[0];
  // Focus habit stays the One Thing for 14-21 days unless blocked
  if (state.focus) {
    const fh = scored.find((x) => x.action.id === state.focus.actionId);
    if (fh) pick = fh;
  }
  if (!pick) return { oneThing: null, ranked: [], state };
  const smaller = state.backOff;
  return {
    oneThing: {
      id: pick.action.id,
      title: fill(smaller ? pick.action.twoMin : pick.action.title, facts),
      twoMin: fill(pick.action.twoMin, facts),
      why: pick.action.why(facts),
      pillar: pick.action.pillar,
      moment: pick.action.moment,
      evidence: pick.action.evidence,
      math: { g: pick.g, f: pick.f, p: pick.p, nu: pick.nu, U: pick.U },
      isFocus: state.focus?.actionId === pick.action.id,
      focusDay: state.focus?.actionId === pick.action.id ? state.focus.day : null,
      backOff: smaller,
    },
    ranked: scored.slice(0, 5).map((x) => ({ id: x.action.id, title: fill(x.action.title, facts), U: x.U, pillar: x.action.pillar })),
    state,
    gaps,
  };
}
