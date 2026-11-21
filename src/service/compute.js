// Assembles a user's data from storage + wearable adapters and runs every engine for a date.
// Pure functions of their inputs: the browser demo and the server run the same code.

import {
  addDays, daysBetween, round, mean, sum, fmtHours, minToClock, circularMeanMin, ageFrom, weekday, median,
} from '../engine/util.js';
import {
  ENGINE_VERSION, WEIGHTS, bandFor, recoveryBaselines, sleepNeed, sleepScore, recoveryScore,
  activityScore, nutritionScore, energyNeed, waterTarget, hydrationScore, fuse, readiness, confidence,
  loadBalance, hrMax, stepTarget, checkinScore,
} from '../engine/wellness.js';
import { cycleContext, SYMPTOMS } from '../engine/cycle.js';
import { chooseOneThing, habitState, actionById, fill } from '../engine/onething.js';
import { sessionVerdict, nextLoad, EXERCISES, SPLITS, buildPlan } from '../engine/fitness.js';
import { deviceById } from '../engine/simulate.js';
import { FOODS } from '../engine/foods.js';

const PRIORITY_SLEEP = { ring: 4, watch: 3, band: 2, bed: 3, phone: 1 };
const PRIORITY_STEPS = { watch: 4, band: 3, ring: 2, phone: 1, bed: 0 };

// F0.7 primary device per metric, user override first; DATA-03 workout de-duplication
export function mergeSources(perDevice, devices, overrides = {}) {
  const kindOf = (id) => deviceById(id)?.kind || 'watch';
  const pick = (metric, prio) => {
    if (overrides[metric] && perDevice[overrides[metric]]) return overrides[metric];
    return Object.keys(perDevice).sort((a, b) => (prio[kindOf(b)] || 0) - (prio[kindOf(a)] || 0))[0] || null;
  };
  const sleepDev = pick('sleep', PRIORITY_SLEEP);
  const stepsDev = Object.keys(perDevice).filter((d) => perDevice[d].steps?.length).sort((a, b) => (PRIORITY_STEPS[kindOf(b)] || 0) - (PRIORITY_STEPS[kindOf(a)] || 0))[0];
  let nights = sleepDev ? perDevice[sleepDev].nights : [];
  // VO2 max comes from whichever device estimates it (often a watch while a ring owns sleep)
  const vo2ByDate = {};
  for (const d of Object.keys(perDevice)) for (const n of perDevice[d].nights || []) if (n.vo2max) vo2ByDate[n.date] = n.vo2max;
  if (Object.keys(vo2ByDate).length) nights = nights.map((n) => (n.vo2max || !vo2ByDate[n.date] ? n : { ...n, vo2max: vo2ByDate[n.date] }));
  const stepsByDate = {};
  if (stepsDev) for (const s of perDevice[stepsDev].steps) stepsByDate[s.date] = s.steps;
  const workouts = [];
  for (const d of Object.keys(perDevice)) {
    for (const w of perDevice[d].workouts || []) {
      const dup = workouts.find((x) => x.date === w.date && Math.abs((x.startMin ?? 0) - (w.startMin ?? 0)) <= 15 && x.type === w.type);
      if (!dup) workouts.push(w);
    }
  }
  return { nights, stepsByDate, workouts, sleepDev, stepsDev };
}

export function assemble(data, wear, date) {
  const p = data.profile;
  // manual sleep from check-ins becomes a night (phone-only path)
  const manualNights = [];
  for (const [d, day] of Object.entries(data.days)) {
    const c = day.checkin;
    if (c?.sleepHours) manualNights.push({ date: d, tstH: c.sleepHours, rating: c.sleepQuality ?? 3, source: 'manual', stages: false });
  }
  let nights = wear.nights.map((n) => {
    const c = data.days[n.date]?.checkin;
    if (n.estimate && c?.sleepHours) return { ...n, tstH: c.sleepHours, rating: c.sleepQuality ?? 3, confirmed: true };
    if (n.estimate) return { ...n, rating: c?.sleepQuality ?? 3 };
    return n;
  });
  for (const m of manualNights) if (!nights.find((n) => n.date === m.date)) nights.push(m);
  // Simulated physiology only: on simulated nights, caffeine within 8 h of bed the day before
  // shortens sleep by about 40 minutes, so the demo shows the pattern the engine looks for.
  const bedM = p.usualBedMin ?? 23 * 60;
  nights = nights.map((n) => {
    if (!n.simulated || n.confirmed) return n;
    const prev = data.days[addDays(n.date, -1)];
    const late = (prev?.caffeine || []).some((x) => ((bedM - x.minute + 1440) % 1440) / 60 < 8.8);
    return late ? { ...n, tstH: round(n.tstH - 0.65, 2), eff: n.eff != null ? round(n.eff - 0.03, 3) : n.eff } : n;
  });
  nights = nights.filter((n) => n.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const manualWorkouts = (data.train.workouts || []).filter((w) => w.date <= date);
  const workouts = [...wear.workouts.filter((w) => w.date <= date)];
  for (const w of manualWorkouts) {
    const dup = workouts.find((x) => x.date === w.date && Math.abs((x.startMin ?? 0) - (w.startMin ?? 0)) <= 15 && x.type === w.type);
    if (!dup) workouts.push(w);
  }
  // phone steps for phone-only days from live tracking
  const stepsByDate = { ...wear.stepsByDate };
  for (const [d, day] of Object.entries(data.days)) if (day.extraSteps) stepsByDate[d] = (stepsByDate[d] || 0) + day.extraSteps;
  return { nights, workouts: workouts.sort((a, b) => (a.date < b.date ? -1 : 1)), stepsByDate };
}

export function bedtimeMin(profile, nights) {
  if (profile.usualBedMin != null) return profile.usualBedMin;
  const b = nights.filter((n) => n.bedStartMin != null).slice(-14).map((n) => n.bedStartMin);
  return b.length ? Math.round(circularMeanMin(b)) : 23 * 60;
}

export function computeCore(data, wear, date) {
  const p = data.profile;
  const asm = assemble(data, wear, date);
  const { nights, workouts, stepsByDate } = asm;
  const day = data.days[date] || {};
  const checkin = day.checkin || null;
  const hasWearable = (data.devices || []).some((d) => d.connected && deviceById(d.id)?.hrv);
  const wearNights = nights.filter((n) => n.hrv);
  const isTeen = ageFrom(p.dob, date) < 18;
  const cyc = cycleContext(data.cycle, nights, date, isTeen);
  const night = nights.find((n) => n.date === date);
  const N = sleepNeed(p, nights, date);
  const sleep = sleepScore({ night, priorNights: nights.filter((n) => n.date < date), N: N.N, rating: checkin?.sleepQuality });
  const base = recoveryBaselines(wearNights, date);
  const recovery = recoveryScore({ base, checkin, wearable: hasWearable && !!night?.hrv, cycleAdj: cyc.adj, nightsWithHrv: wearNights.length });
  const hasSteps = Object.keys(stepsByDate).some((d) => d < date && daysBetween(d, date) <= 2);
  const activity = activityScore({ profile: p, stepsByDate, workouts, today: date, hasSteps });
  const steps14 = [];
  for (let i = 1; i <= 14; i++) if (stepsByDate[addDays(date, -i)] != null) steps14.push(stepsByDate[addDays(date, -i)]);
  const en = energyNeed(p, date, steps14.length ? mean(steps14) : null, activity?.mvpa7 ?? 0, data.cycle?.lifeStage);
  const bed = bedtimeMin(p, nights);
  const proteinTarget = data.train.plan?.proteinGPerKg || 1.2;
  const nutrition = nutritionScore({ profile: p, meals: day.meals || [], caffeine: day.caffeine || [], alcohol: day.alcohol || 0, need: en.need, bedtimeMin: bed, proteinTarget });
  const exHours = sum(workouts.filter((w) => w.date === date).map((w) => w.minutes || 0)) / 60;
  const wt = waterTarget(p, exHours, !!day.hot);
  const fluid = sum((day.water || []).map((w) => w.ml));
  const hydration = hydrationScore({ fluidMl: fluid, target: wt });
  const illness = !!checkin?.flags?.includes('unwell');
  const fused = fuse({ sleep, recovery, activity, nutrition, hydration, illness, wearable: hasWearable, tstH: night?.tstH, z: recovery?.z, delta: recovery?.delta });
  const hm = hrMax(p, date, workouts);
  const lb = loadBalance(workouts, date, hm.value);
  const ready = readiness(sleep, recovery, lb.LB);
  const conf = confidence(hasWearable, nutrition?.cov ?? 0);
  return {
    date, asm, day, checkin, hasWearable, cyc, night, N, sleep, base, recovery, activity, en, bed, nutrition, wt, fluid, hydration,
    fused, lb, ready, conf, hm, illness,
    band: fused.WS != null ? bandFor(fused.WS) : null,
  };
}

function reasonSentence(c) {
  if (c.fused.WS == null) return 'Check in to get your status. Three taps is enough.';
  if (c.fused.capped) return c.fused.capReason;
  const neg = [];
  const pos = [];
  if (c.sleep) (c.sleep.score < 65 ? neg : c.sleep.score >= 80 ? pos : []).push(c.sleep.t < c.N.N - 0.5 ? 'short sleep' : c.sleep.score < 65 ? 'restless sleep' : 'good sleep');
  if (c.recovery) {
    if (c.recovery.score < 60) neg.push(c.checkin && c.checkin.stress >= 4 ? 'a high-stress check-in' : 'lower recovery');
    else if (c.recovery.score >= 80) pos.push('strong recovery');
  }
  if (c.activity && c.activity.score >= 80) pos.push('an active week');
  if (c.activity && c.activity.score < 50) neg.push('a quiet week of movement');
  const band = c.band.name;
  const tail = { Thrive: 'A great day to push a little.', Steady: 'A normal day, just keep training easy.', 'Ease up': 'Keep today lighter than planned.', Recover: 'Rest and refuel today.' }[band];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (neg.length) return `${cap(neg.slice(0, 2).join(' and '))}. ${tail}`;
  if (pos.length) return `${cap(pos.slice(0, 2).join(' and '))}. ${tail}`;
  return `Everything is close to your normal. ${tail}`;
}

export function factsFor(data, c, history7) {
  const nights = c.asm.nights;
  const last3 = nights.filter((n) => daysBetween(n.date, c.date) < 3);
  let lateCafDays = 0;
  const cafNights = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(c.date, -i - 1);
    const caf = data.days[d]?.caffeine || [];
    if (caf.some((x) => ((c.bed - x.minute + 1440) % 1440) / 60 < 8.8)) {
      lateCafDays++;
      const n = nights.find((x) => x.date === addDays(d, 1));
      if (n) cafNights.push(n.tstH);
    }
  }
  const y = data.days[addDays(c.date, -1)] || {};
  const yMeals = y.meals || [];
  const yProtein = sum(yMeals.map((m) => m.protein || 0));
  const kg = data.profile.weightKg || 70;
  const pt = round((data.train.plan?.proteinGPerKg || 1.2) * kg);
  const steps7 = [];
  for (let i = 1; i <= 7; i++) { const s = c.asm.stepsByDate[addDays(c.date, -i)]; if (s != null) steps7.push(s); }
  const mids = nights.filter((n) => n.midMin != null).slice(-8);
  const midDev = mids.length > 3 ? Math.round(mean(mids.slice(-7).map((n) => Math.abs(n.midMin - circularMeanMin(mids.map((m) => m.midMin)))))) : 0;
  const bedClock = minToClock(circularMeanMin(nights.filter((n) => n.bedStartMin != null).slice(-7).map((n) => n.bedStartMin)) || c.bed);
  const sym = data.cycle?.symptoms?.[c.date] || {};
  const top = SYMPTOMS.map((s) => [s.label.toLowerCase(), sym[s.key] || 0]).sort((a, b) => b[1] - a[1])[0];
  const fiberDays = Object.entries(data.days).filter(([d, v]) => d < c.date && daysBetween(d, c.date) <= 7 && (v.meals || []).length).map(([, v]) => sum(v.meals.map((m) => m.fiber || 0)));
  const yFluid = sum((y.water || []).map((w) => w.ml));
  const underDays = Object.entries(data.days).filter(([d, v]) => d < c.date && daysBetween(d, c.date) <= 7 && (v.meals || []).length >= (data.profile.usualMeals || 3)).filter(([, v]) => sum(v.meals.map((m) => m.kcal)) < 0.7 * c.en.need).length;
  return {
    lateCafDays, sleepOnCafDays: cafNights.length ? mean(cafNights) : null,
    avgSleep3: last3.length ? mean(last3.map((n) => n.tstH)) : c.N.N, need: c.N.N, lastSleep: c.night?.tstH,
    midDev, bedClock, usualBed: minToClock(c.bed),
    windDownClock: minToClock(c.bed - 20),
    hrvZ: c.recovery?.z ?? null, rhrDelta: c.recovery?.delta ?? null, recovery: c.recovery?.score != null ? Math.round(c.recovery.score) : '--',
    stress: c.checkin?.stress, soreness: c.checkin?.soreness,
    avgSteps: steps7.length ? Math.round(mean(steps7)) : null, steps: c.activity?.steps, stepTarget: c.activity?.target || 8000,
    mvpa7: c.activity?.mvpa7 ?? 0, strengthSessions: c.activity?.strengthSessions ?? 0,
    proteinPct: pt ? Math.round((100 * yProtein) / pt) : 0, proteinTarget: pt,
    fiberPct: fiberDays.length ? Math.round((100 * mean(fiberDays)) / ((14 * c.en.need) / 1000)) : 0,
    mealsLogged: (c.day.meals || []).length, usualMeals: data.profile.usualMeals || 3,
    fluidL: round(yFluid / 1000, 1), waterTargetL: round(c.wt / 1000, 1), hydration: c.hydration?.score != null ? Math.round(c.hydration.score) : 0,
    topSymptom: top && top[1] > 0 ? top[0] : 'symptoms', fatigue: sym.fatigue || 0,
    underEating: underDays >= 3 && !data.profile.edFlag,
    fitnessGoal: data.train.plan?.goal ? data.train.plan.goal.replace('general', 'general fitness') : null,
    plannedToday: todaysPlanned(data, c.date)?.name || 'no session',
    trainedToday: c.asm.workouts.some((w) => w.date === c.date && w.strength),
  };
}

export function todaysPlanned(data, date) {
  const plan = data.train.plan;
  if (!plan) return null;
  const daysMap = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6] };
  const tdays = plan.trainingDays || daysMap[Math.min(5, Math.max(2, plan.days))] || [1, 3, 5];
  const moved = (data.train.moved || []).find((m) => m.from === date);
  if (moved) return null;
  const movedIn = (data.train.moved || []).find((m) => m.to === date);
  const dow = weekday(date);
  if (!tdays.includes(dow) && !movedIn) return null;
  const idx = movedIn ? movedIn.sessionIndex : tdays.indexOf(dow);
  return { ...plan.sessions[idx % plan.sessions.length], index: idx % plan.sessions.length };
}

export function nextTrainingDay(data, date) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    if (todaysPlanned(data, d)) return d;
  }
  return addDays(date, 2);
}

export function todaysSession(data, c) {
  const planned = todaysPlanned(data, c.date);
  const v = sessionVerdict(c.ready, c.fused.capped || (c.band?.name === 'Recover'));
  const override = data.train.overrides?.[c.date];
  if (!planned) {
    return { rest: true, title: 'Rest day', subtitle: 'A 20-minute walk keeps you moving', verdict: v, plan: data.train.plan || null };
  }
  const sets = data.train.sets || [];
  const exercises = planned.exercises.map((e) => {
    const nl = nextLoad(e.id, sets, data.train.plan.goal);
    const ex = EXERCISES[e.id];
    let nSets = e.sets;
    if (v.code === 'lighter') nSets = Math.max(1, Math.round(e.sets * 0.65));
    if (v.code === 'push') nSets = e.sets + 1;
    const last = sets.filter((s) => s.exercise === e.id).slice(-1)[0];
    return {
      ...e, name: ex.name, groups: ex.groups, sets: nSets,
      ...(ex.bodyweight
        ? { load: null, change: null, loadReason: `Bodyweight: when you reach ${ex.range?.[1] ?? e.reps[1]} reps on every set, slow the lowering to 3 seconds.` }
        : { load: nl.load, change: nl.change, loadReason: nl.reason }),
      last: last ? (ex.bodyweight ? `${last.reps} reps` : `${last.load} kg x ${last.reps}`) : null,
      done: sets.filter((s) => s.exercise === e.id && s.date === c.date).length,
    };
  });
  const verdictCode = override?.code || v.code;
  return {
    rest: verdictCode === 'rest', title: planned.name, minutes: data.train.plan.minutes,
    subtitle: verdictCode === 'rest' ? 'Rest, walk or mobility today' : verdictCode === 'lighter' ? 'Lighter: about a third less volume' : verdictCode === 'push' ? 'Push: you may add a set' : 'As planned, keep 2 reps in reserve',
    verdict: override ? { ...v, verdict: override.verdict, code: override.code, overridden: true } : v, exercises, plan: data.train.plan, index: planned.index,
  };
}

export function buildToday(data, wear, date, history) {
  const c = computeCore(data, wear, date);
  const facts = factsFor(data, c);
  const pillars = { sleep: c.sleep, recovery: c.recovery, activity: c.activity, nutrition: c.nutrition, hydration: c.hydration };
  const ot = chooseOneThing({
    pillars, e: c.fused.e.sleep !== undefined ? { ...WEIGHTS, ...Object.fromEntries(Object.entries(c.fused.e).map(([k, v]) => [k, v || WEIGHTS[k]])) } : WEIGHTS,
    band: c.band?.name, readiness: c.ready, profile: data.profile, cycle: c.cyc, history, today: date, facts, fitnessGoal: data.train.plan?.goal,
  });
  // Previous 7 days of status for "vs avg"
  const prev = [];
  for (let i = 1; i <= 7; i++) {
    const pc = computeCore(data, wear, addDays(date, -i));
    if (pc.fused.WS != null) prev.push(pc.fused.WS);
  }
  const avg7 = prev.length ? Math.round(mean(prev)) : null;
  const todayRec = history.find((r) => r.date === date);
  const keep = ot.state.keepDoing ? actionById(ot.state.keepDoing.actionId) : null;
  return {
    c, facts, pillars, oneThing: ot.oneThing, ranked: ot.ranked, habit: ot.state, gaps: ot.gaps,
    oneThingRecord: todayRec || null,
    keepDoing: keep ? { id: keep.id, title: fill(keep.title, facts), n: ot.state.keepDoing.n } : null,
    reason: reasonSentence(c), avg7, vsAvg: avg7 != null && c.fused.WS != null ? c.fused.WS - avg7 : null,
    session: todaysSession(data, c), engineVersion: ENGINE_VERSION,
  };
}

export function mealIdea(profile, nutrition, en) {
  const allergies = (profile.allergies || []).map((a) => a.toLowerCase());
  const diet = profile.diet || 'none';
  const ideas = [
    { name: 'Salmon, quinoa and roasted vegetables', items: [['salmon-baked', 140], ['quinoa-cooked', 150], ['roasted-vegetables', 130]], tags: ['fish'] },
    { name: 'Chicken grain bowl with greens', items: [['grilled-chicken-breast', 140], ['brown-rice-cooked', 160], ['mixed-green-salad', 100], ['avocado', 50]], tags: ['meat'] },
    { name: 'Lentil dal with rice and spinach', items: [['dal-lentil-curry-', 250], ['white-rice-cooked', 160], ['spinach-raw', 60]], tags: ['vegan'] },
    { name: 'Tofu stir-fry with broccoli and rice', items: [['tofu-firm', 150], ['broccoli-steamed', 120], ['brown-rice-cooked', 160]], tags: ['vegan', 'soy'] },
    { name: 'Greek yogurt bowl with berries and almonds', items: [['greek-yogurt-plain', 200], ['blueberries', 100], ['almonds', 20]], tags: ['vegetarian', 'milk', 'tree nuts'] },
  ];
  const ok = ideas.filter((i) => {
    if (['vegan'].includes(diet) && !i.tags.includes('vegan')) return false;
    if (['vegetarian'].includes(diet) && !i.tags.some((t) => ['vegan', 'vegetarian'].includes(t))) return false;
    if (diet === 'pescatarian' && i.tags.includes('meat')) return false;
    if (allergies.some((a) => i.tags.includes(a) || (a === 'fish' && i.tags.includes('fish')))) return false;
    return true;
  });
  const pick = ok[new Date().getDate() % Math.max(1, ok.length)] || ideas[2];
  const items = pick.items.map(([id, g]) => ({ foodId: FOODS.find((f) => f.id === id)?.id || id, grams: g }));
  return { name: pick.name, items };
}
