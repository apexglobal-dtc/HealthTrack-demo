// Health Track application service. One implementation, two hosts:
//  - the browser demo (Claude Artifact) runs it with browser storage and simulated wearables
//  - the Next.js server runs it with Supabase Postgres and real adapters (Open Wearables, Junction)
// Every method takes the signed-in user's id; storage and adapters are injected.

import { addDays, daysBetween, isoDate, round, mean, sum, uid, fmtHours, minToClock, ageFrom, weekday, clockToMin } from '../engine/util.js';
import { ENGINE_VERSION, WEIGHTS, BANDS, checkinScore } from '../engine/wellness.js';
import { predict, phaseOn, SYMPTOMS, FLOWS, cycleLengths } from '../engine/cycle.js';
import { ACTIONS, LADDER, actionById, habitState, successRate, fill } from '../engine/onething.js';
import { fitnessScore, hrZones, loadMetrics, deloadSignals, buildPlan, EXERCISES, e1rm, roundToPlates } from '../engine/fitness.js';
import { MARKERS, markerByKey, parseLabText, foundationScore, SAMPLE_LAB_TEXT, markerStatus } from '../engine/foundation.js';
import { FOODS, findFood, searchFoods, matchFood, mealTotals, nutrientsFor } from '../engine/foods.js';
import { redFlag, SAFETY_RESPONSES, postCheck, buildPrompt, stubReply } from '../engine/genie.js';
import { DEVICE_CATALOG, deviceById, simulatedPeriods, simulateStrengthHistory } from '../engine/simulate.js';
import { dayFacts, planByCategory, buildCheckins, mealSlot } from './dayplan.js';
import { nutritionGoal, buildDay, groceryList, parseRequest, candidates, recipeById, RECIPES, SLOT_LABEL } from '../engine/mealplan.js';
import { caloriesBurned, energyBalance } from '../engine/burn.js';
import { PACES, deficitPlan, deficitSafety, dayDeficit, weekSummary, projection, calorieFloor } from '../engine/deficit.js';
import { computeCore, buildToday, mergeSources, todaysPlanned, nextTrainingDay, mealIdea, factsFor } from './compute.js';

export const PRICING = {
  plus: { monthly: 12.99, yearly: 99.99, name: 'Health Track Plus' },
  essentials: { monthly: 9.99, yearly: 89.99, name: 'Health Track Essentials (Genie + Nutrition)' },
  trialDays: 30,
};

const DOCS = ['profile', 'days', 'history', 'train', 'cycle', 'labs', 'chat', 'memory', 'devices', 'reminders', 'mealplan'];
const EMPTY = { days: {}, history: [], train: { sets: [], workouts: [], plan: null, tests: [], moved: [], overrides: {} }, cycle: { enabled: false, periods: [], flow: {}, symptoms: {} }, labs: { results: [], reports: [] }, chat: { messages: [], actions: [] }, memory: { goals: [], constraints: [], preferences: { tone: 'gentle' }, notes: [] }, devices: [], reminders: [], mealplan: { prefs: null, overrides: {}, notes: {}, grocery: [] } };

export function createService({ store, wearables, ai, now = () => new Date() }) {
  const today = () => isoDate(now());
  const cache = new Map();

  async function load(u) {
    const out = {};
    await Promise.all(DOCS.map(async (k) => { out[k] = (await store.get(u, k)) ?? structuredClone(EMPTY[k] ?? null); }));
    out.profile ||= null;
    out.train = { ...EMPTY.train, ...(out.train || {}) };
    out.cycle = { ...EMPTY.cycle, ...(out.cycle || {}) };
    return out;
  }
  async function save(u, key, value) {
    if (key === 'days') {
      // keep the document small: last 150 days
      const cutoff = addDays(today(), -150);
      for (const d of Object.keys(value)) if (d < cutoff) delete value[d];
    }
    if (key === 'chat') value.messages = value.messages.slice(-80);
    cache.delete(u);
    await store.set(u, key, value);
  }

  async function wearData(u, data) {
    const t = today();
    const key = `${u}:${t}:${JSON.stringify(data.devices)}:${(data.cycle.periods || []).length}`;
    if (cache.get(u)?.key === key) return cache.get(u).wear;
    const per = {};
    for (const d of (data.devices || []).filter((x) => x.connected)) {
      per[d.id] = await wearables.fetch({ userId: u, seed: data.profile.seed, device: d.id, provider: d.provider || 'simulated', from: addDays(t, -75), to: t, periods: data.profile.simPeriods || null });
    }
    const wear = mergeSources(per, data.devices, data.profile.sourceOverrides || {});
    cache.set(u, { key, wear });
    return wear;
  }

  async function ctx(u) {
    const data = await load(u);
    if (!data.profile) throw Object.assign(new Error('Finish onboarding first'), { code: 'no_profile' });
    const wear = await wearData(u, data);
    return { data, wear };
  }

  function entitlements(profile) {
    const sub = profile?.subscription || {};
    const t = today();
    const trialActive = sub.plan === 'trial' && sub.trialEnd >= t;
    const full = trialActive || sub.plan === 'plus' || profile?.orgMember;
    const ess = sub.plan === 'essentials';
    return { full, essentials: ess, train: full, cycleInsights: full, labs: full, genie: full || ess, nutrition: full || ess, trialActive, active: full || ess };
  }

  // ---------------- account and onboarding ----------------
  async function bootstrap(u) {
    const profile = await store.get(u, 'profile');
    return { profile, entitlements: entitlements(profile), today: today(), pricing: PRICING, ai: ai.available(), engineVersion: ENGINE_VERSION };
  }

  async function completeOnboarding(u, ob) {
    const t = today();
    const profile = {
      name: ob.name || 'Friend', dob: ob.dob || '1992-05-14', sex: ob.sex || 'prefer_not', heightCm: Number(ob.heightCm) || 170,
      weightKg: ob.weightKg ? Number(ob.weightKg) : null, units: ob.units || 'metric', goals: ob.goals || [], struggles: ob.struggles || [],
      usualBedMin: ob.bedtime ? clockToMin(ob.bedtime) : 23 * 60, usualWakeMin: ob.wake ? clockToMin(ob.wake) : 7 * 60,
      sleepNeedH: ob.sleepNeedH ? Number(ob.sleepNeedH) : null, shiftWork: !!ob.shiftWork, pregnant: !!ob.pregnant,
      activityLevel: ob.activityLevel || 'moderate', workoutsPerWeek: ob.workoutsPerWeek ?? 3, usualMeals: ob.usualMeals || 3,
      mealTimes: ob.mealTimes || { breakfast: '07:30', lunch: '12:30', dinner: '19:00' }, allergies: ob.allergies || [], diet: ob.diet || 'none',
      edFlag: !!ob.edFlag, edScreenPassed: !ob.edFlag, consents: ob.consents || {}, seed: ob.seed || uid('seed'), createdAt: t,
      subscription: { plan: 'none' }, theme: 'system', weightGoal: ob.weightGoal || 'maintain', setupSkipped: Array.isArray(ob.setupSkipped) ? ob.setupSkipped.slice(0, 10) : [],
    };
    if (ob.cycle === 'yes' && ob.sex !== 'male') {
      profile.simPeriods = simulatedPeriods(profile.seed, t, 3);
      await save(u, 'cycle', { enabled: true, storage: ob.cycleStorage || 'device', lifeStage: ob.lifeStage || 'none', typicalLength: Number(ob.typicalLength) || 29, periods: profile.simPeriods.slice(-1), flow: {}, symptoms: {} });
    }
    await save(u, 'profile', profile);
    const devices = (ob.devices || []).map((id) => ({ id, name: deviceById(id)?.name || id, connected: true, provider: ob.provider || 'simulated', connectedAt: t }));
    await save(u, 'devices', devices);
    await save(u, 'memory', { goals: profile.goals.map((g) => ({ id: uid('m'), text: g })), constraints: [...profile.allergies.map((a) => ({ id: uid('m'), text: `Allergy: ${a}` })), ...(ob.injuries ? [{ id: uid('m'), text: ob.injuries }] : [])], preferences: { tone: 'gentle' }, notes: [] });
    if (ob.checkin) await checkin(u, ob.checkin);
    return bootstrap(u);
  }

  // Returning users finish or change the setup answers later (the same screens as onboarding).
  async function updateSetup(u, ob) {
    const p = await store.get(u, 'profile');
    if (!p) throw new Error('Please finish sign-up first');
    const t = today();
    const keys = ['name', 'dob', 'sex', 'units', 'goals', 'struggles', 'shiftWork', 'pregnant', 'activityLevel', 'workoutsPerWeek', 'usualMeals', 'allergies', 'diet', 'consents'];
    for (const k of keys) if (k in ob && ob[k] !== '' && ob[k] != null) p[k] = ob[k];
    if (ob.name != null) p.name = String(ob.name).trim() || p.name;
    if (ob.heightCm) p.heightCm = Number(ob.heightCm) || p.heightCm;
    if ('weightKg' in ob) p.weightKg = ob.weightKg ? Number(ob.weightKg) : null;
    if (ob.bedtime) p.usualBedMin = clockToMin(ob.bedtime);
    if (ob.wake) p.usualWakeMin = clockToMin(ob.wake);
    if (Array.isArray(ob.setupSkipped)) p.setupSkipped = ob.setupSkipped.slice(0, 10);
    if (Array.isArray(ob.devices)) {
      const old = (await store.get(u, 'devices')) || [];
      const devs = ob.devices.map((id) => old.find((d) => d.id === id) || { id, name: deviceById(id)?.name || id, connected: true, provider: 'simulated', connectedAt: t });
      await save(u, 'devices', devs);
    }
    if (ob.cycle === 'yes' && p.sex !== 'male') {
      const c = await store.get(u, 'cycle');
      if (!c?.enabled) {
        p.simPeriods = p.simPeriods || simulatedPeriods(p.seed, t, 3);
        await save(u, 'cycle', { ...(c || { flow: {}, symptoms: {} }), enabled: true, storage: ob.cycleStorage || 'device', lifeStage: ob.lifeStage || 'none', typicalLength: Number(ob.typicalLength) || 29, periods: c?.periods?.length ? c.periods : p.simPeriods.slice(-1) });
      }
    }
    await save(u, 'profile', p);
    if (Array.isArray(ob.goals) || Array.isArray(ob.allergies)) {
      const m = (await store.get(u, 'memory')) || { goals: [], constraints: [], preferences: { tone: 'gentle' }, notes: [] };
      if (Array.isArray(ob.goals)) m.goals = p.goals.map((g) => m.goals.find((x) => x.text === g) || { id: uid('m'), text: g });
      if (Array.isArray(ob.allergies)) m.constraints = [...m.constraints.filter((c) => !/^Allergy: /.test(c.text)), ...p.allergies.map((a) => ({ id: uid('m'), text: `Allergy: ${a}` }))];
      await save(u, 'memory', m);
    }
    return bootstrap(u);
  }

  async function seedDemoPersona(u) {
    const t = today();
    const seed = 'maya-demo-v1';
    const periods = simulatedPeriods(seed, t, 5);
    const profile = {
      name: 'Maya', dob: '1992-03-08', sex: 'female', heightCm: 167, weightKg: 63, units: 'metric', goals: ['Sleep better', 'More energy', 'Build strength'],
      struggles: ['I drink coffee late in the day', 'I sleep at odd times after shifts'], usualBedMin: 23 * 60, usualWakeMin: 7 * 60, sleepNeedH: 7.75,
      shiftWork: false, pregnant: false, activityLevel: 'moderate', workoutsPerWeek: 3, usualMeals: 3, mealTimes: { breakfast: '07:30', lunch: '12:30', dinner: '19:00' },
      allergies: ['Peanuts'], diet: 'none', edFlag: false, edScreenPassed: true, consents: { sleep: true, heart: true, activity: true, nutrition: true }, seed, createdAt: addDays(t, -60),
      subscription: { plan: 'trial', billing: 'yearly', trialStart: addDays(t, -9), trialEnd: addDays(t, 21) }, theme: 'system', weightGoal: 'maintain', simPeriods: periods, demo: true,
    };
    await save(u, 'profile', profile);
    await save(u, 'devices', [{ id: 'oura', name: 'Oura Ring', connected: true, provider: 'simulated', connectedAt: addDays(t, -60) }, { id: 'apple_watch', name: 'Apple Watch', connected: true, provider: 'simulated', connectedAt: addDays(t, -60) }]);
    const sh = simulateStrengthHistory({ seed, from: addDays(t, -56), to: t, scale: 0.6 });
    const plan = buildPlan('muscle', 3, 45, 'intermediate');
    await save(u, 'train', { sets: sh.sets, workouts: sh.workouts, plan, tests: [], moved: [], overrides: {} });
    // cycle: symptoms and flow for the last periods
    const flow = {}, symptoms = {};
    for (const p of periods) for (let d = p.start, i = 0; d <= p.end; d = addDays(d, 1), i++) flow[d] = [4, 4, 3, 2, 1, 1][i] ?? 1;
    const lastP = periods[periods.length - 1];
    for (let i = 0; i < 3; i++) symptoms[addDays(lastP.start, i)] = { cramps: 2 - Math.min(i, 2), fatigue: 2, headache: i === 0 ? 1 : 0, bloating: 1, breast: 0, mood: 1 };
    await save(u, 'cycle', { enabled: true, storage: 'device', lifeStage: 'none', typicalLength: 29, periods, flow, symptoms });
    // 45 days of logs and One Thing history
    const days = {}, history = [];
    const rnd = (k) => { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000; };
    const meals = [
      [['oatmeal-cooked', 240], ['blueberries', 80], ['greek-yogurt-plain', 120]],
      [['grain-bowl-with-chicken', 380]], [['turkey-sandwich', 220], ['apple', 150]], [['salmon-baked', 140], ['quinoa-cooked', 150], ['roasted-vegetables', 130]],
      [['pasta-cooked', 250], ['mixed-green-salad', 100]], [['chicken-curry', 250], ['white-rice-cooked', 160]], [['scrambled-eggs', 100], ['whole-wheat-toast', 60]],
    ];
    for (let i = 45; i >= 1; i--) {
      const d = addDays(t, -i);
      const r = rnd(d);
      const day = { meals: [], water: [], caffeine: [] };
      day.checkin = { energy: 2 + Math.round(r * 3), soreness: 1 + Math.round(rnd(d + 's') * 3), stress: 2 + Math.round(rnd(d + 't') * 2), mood: 3 + Math.round(r * 2), at: '07:10' };
      const nMeals = r < 0.2 ? 1 : r < 0.55 ? 2 : 3;
      const times = [7 * 60 + 40, 12 * 60 + 40, 19 * 60 + 10];
      for (let m = 0; m < nMeals; m++) {
        const items = meals[(i * 3 + m) % meals.length].map(([foodId, grams]) => ({ foodId, grams, confirmed: true }));
        const tot = mealTotals(items);
        day.meals.push({ id: uid('meal'), minute: times[m], name: ['Breakfast', 'Lunch', 'Dinner'][m], items, ...tot, confirmed: rnd(d + m) > 0.25, source: 'photo' });
      }
      const glasses = 3 + Math.round(rnd(d + 'w') * 5);
      for (let g = 0; g < glasses; g++) day.water.push({ minute: 8 * 60 + g * 90, ml: 250 });
      day.caffeine.push({ minute: 7 * 60 + 30, mg: 95 });
      if (rnd(d + 'c') < (i <= 4 ? 0.05 : i <= 9 ? 0.85 : 0.5)) day.caffeine.push({ minute: 16 * 60, mg: 95 });
      days[d] = day;
      // One Thing history: decaf focus habit started 4 days ago
      if (i > 4) {
        const ids = ['walk-lunch', 'water-am', 'protein-bfast', 'wind-down', 'walk-lunch', 'water-am', 'veg-half'];
        const id = ids[i % ids.length];
        const o = rnd(d + 'o');
        history.push({ date: d, actionId: id, accepted: o > 0.15, outcome: o > 0.45 ? 'done' : o > 0.3 ? 'partly' : o > 0.15 ? 'skipped' : null });
      } else {
        history.push({ date: d, actionId: 'decaf-pm', accepted: true, outcome: i === 4 ? 'partly' : 'done' });
      }
    }
    // water-am graduated earlier: done 5+ of 7 for two weeks (weeks 4-5 ago)
    for (let i = 35; i >= 22; i--) {
      const d = addDays(t, -i);
      const h = history.find((x) => x.date === d);
      if (h && i % 7 !== 3) Object.assign(h, { actionId: 'water-am', accepted: true, outcome: 'done' });
    }
    // today: a morning check-in already done, breakfast logged, two glasses of water
    days[t] = {
      checkin: { energy: 3, soreness: 3, stress: 4, mood: 3, at: '07:02' },
      meals: [{ id: uid('meal'), minute: 7 * 60 + 35, name: 'Breakfast', items: [{ foodId: 'greek-yogurt-plain', grams: 170, confirmed: true }, { foodId: 'granola', grams: 40, confirmed: true }, { foodId: 'blueberries', grams: 80, confirmed: true }], confirmed: true, source: 'photo' }],
      water: [{ minute: 7 * 60, ml: 300 }, { minute: 9 * 60 + 30, ml: 250 }], caffeine: [{ minute: 7 * 60 + 20, mg: 95 }],
    };
    Object.assign(days[t].meals[0], mealTotals(days[t].meals[0].items));
    await save(u, 'days', days);
    await save(u, 'history', history);
    const labDate = addDays(t, -49);
    const parsed = parseLabText(SAMPLE_LAB_TEXT);
    await save(u, 'labs', { results: parsed.markers.map((m) => ({ key: m.key, value: m.value, unit: m.unit, date: labDate, confirmed: true, source: 'PDF upload' })), reports: [{ id: uid('lab'), date: labDate, name: 'Sample lab report.pdf', markers: parsed.markers.length }] });
    await save(u, 'memory', {
      goals: [{ id: uid('m'), text: 'Sleep better' }, { id: uid('m'), text: 'More energy for shifts' }, { id: uid('m'), text: 'Build strength, 3 sessions a week' }],
      constraints: [{ id: uid('m'), text: 'Allergy: peanuts' }, { id: uid('m'), text: 'Mild left knee pain on deep lunges' }],
      preferences: { tone: 'gentle', units: 'metric', notes: 'Prefers morning workouts on days off' }, notes: [],
    });
    await save(u, 'chat', { messages: [], actions: [] });
    await save(u, 'reminders', []);
    return bootstrap(u);
  }

  // ---------------- Today ----------------
  async function getToday(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const td = buildToday(data, wear, t, data.history);
    const c = td.c;
    const p = data.profile;
    // Things to do today: max 4 items (information budget)
    const plan = [];
    const fluid = c.fluid;
    if (fluid < c.wt) plan.push({ time: '10:00 am', minute: 600, text: `Water: ${round((c.wt - fluid) / 1000, 1)} L to go`, kind: 'water', done: false });
    if (td.session && !td.session.rest) plan.push({ time: '6:00 pm', minute: 1080, text: `${td.session.title} · ${td.session.minutes} min`, kind: 'train', done: td.session.exercises.every((e) => e.done >= e.sets) });
    else plan.push({ time: '12:45 pm', minute: 765, text: '20-minute walk after lunch', kind: 'walk', done: false });
    if (td.oneThing) plan.push({ time: td.oneThing.moment === 'evening' ? minToClock(c.bed - 20) : td.oneThing.moment === 'meal' ? '12:30 pm' : '8:00 am', minute: 0, text: td.oneThing.title, kind: 'onething', done: td.oneThingRecord?.outcome === 'done' });
    plan.push({ time: minToClock(c.bed - 20), minute: c.bed - 20, text: 'Start wind-down', kind: 'sleep', done: false });
    const steps7 = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); steps7.push({ date: d, steps: c.asm.stepsByDate[d] ?? (i === 0 ? Math.round((c.asm.stepsByDate[addDays(t, -1)] || 4000) * Math.min(1, (now().getHours() - 6) / 14)) : null) }); }
    const idea = mealIdea(p, c.nutrition, c.en);
    const ideaTot = mealTotals(idea.items);
    const baselineNights = c.base.validNights;
    const checkinDone = !!c.checkin;
    const checkinPct = c.checkin ? Math.round((100 * ['energy', 'soreness', 'stress', 'mood'].filter((k) => c.checkin[k] != null).length) / 4) : 0;
    const hour = now().getHours();
    const nt = nextTrainingDay(data, t);
    let planDay = null;
    try { planDay = await todayMealPlan(u, data, c); } catch (e) { planDay = null; }
    const facts = dayFacts({ planDay,
      date: t, profile: p, day: c.day, c, session: td.session, oneThing: td.oneThing, oneThingRecord: td.oneThingRecord,
      dinnerIdea: idea.name, stepsToday: c.asm.stepsByDate[t] ?? null, nextTrain: nt ? daysBetween(t, nt) : null, proteinPerKg: data.train.plan?.proteinGPerKg,
    });
    const showCal = p.edScreenPassed && !p.edFlag;
    const burned = showCal ? burnFor(data, c, t) : null;
    return {
      burned,
      planCategories: planByCategory(facts), checkins: buildCheckins(facts, nowMin()), basedOn: addDays(t, -1),
      date: t, name: p.name, greeting: hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening',
      status: c.fused.WS, band: c.band, bands: BANDS, eligible: c.fused.eligible, confidence: c.conf, reason: td.reason, vsAvg: td.vsAvg,
      readiness: c.ready, capped: c.fused.capped, capReason: c.fused.capReason, cap: c.fused.CAP,
      pillars: {
        sleep: c.sleep ? Math.round(c.sleep.score) : null, recovery: c.recovery ? Math.round(c.recovery.score) : null,
        activity: c.activity ? Math.round(c.activity.score) : null, nutrition: c.nutrition ? Math.round(c.nutrition.score) : null,
        hydration: c.hydration ? Math.round(c.hydration.score) : null,
      },
      oneThing: td.oneThing, oneThingRecord: td.oneThingRecord, keepDoing: td.keepDoing, habit: { focus: td.habit.focus, backOff: td.habit.backOff },
      session: td.session, plan: plan.slice(0, 4), steps7, stepTarget: c.activity?.target || 8000,
      mealIdea: { ...idea, ...ideaTot, items: idea.items.map((i) => ({ ...i, name: findFood(i.foodId)?.name })) },
      hasWearable: c.hasWearable, devices: data.devices, baselineNights, baselineActive: c.base.active,
      checkinDone, checkinPct, checkin: c.checkin,
      cycle: c.cyc.enabled && c.cyc.pred ? { day: c.cyc.pred.CD, phase: c.cyc.phase?.phase, label: c.cyc.phase?.label, next: c.cyc.pred.next } : null,
      fluid, waterTarget: c.wt, engineVersion: ENGINE_VERSION, evening: hour >= 17,
      entitlements: entitlements(p),
    };
  }

  async function checkin(u, ci) {
    const days = (await store.get(u, 'days')) || {};
    const t = ci.date || today();
    days[t] = days[t] || {};
    days[t].checkin = { ...(days[t].checkin || {}), ...ci, at: minToClock(now().getHours() * 60 + now().getMinutes()) };
    delete days[t].checkin.date;
    await save(u, 'days', days);
    return { ok: true };
  }

  async function oneThingRespond(u, { actionId, choice }) {
    const h = (await store.get(u, 'history')) || [];
    const t = today();
    let rec = h.find((r) => r.date === t);
    if (!rec) { rec = { date: t, actionId }; h.push(rec); }
    rec.actionId = actionId;
    rec.accepted = choice === 'accept' || choice === 'smaller';
    rec.smaller = choice === 'smaller';
    await save(u, 'history', h);
    return { ok: true };
  }

  async function oneThingOutcome(u, { actionId, outcome, why }) {
    const h = (await store.get(u, 'history')) || [];
    const t = today();
    let rec = h.find((r) => r.date === t);
    if (!rec) { rec = { date: t, actionId, accepted: true }; h.push(rec); }
    rec.outcome = outcome;
    if (why) rec.why = why;
    await save(u, 'history', h);
    const hs = habitState(h, t);
    return { ok: true, backOff: hs.backOff, successRate: round(successRate(h, actionId), 2) };
  }

  // ---------------- logging ----------------
  async function mutateDay(u, date, fn) {
    const days = (await store.get(u, 'days')) || {};
    days[date] = days[date] || {};
    fn(days[date]);
    await save(u, 'days', days);
    return days[date];
  }
  const nowMin = () => now().getHours() * 60 + now().getMinutes();

  async function logMeal(u, meal) {
    const t = meal.date || today();
    const items = meal.items.map((i) => ({ foodId: i.foodId, grams: Number(i.grams), gramsLow: i.gramsLow, gramsHigh: i.gramsHigh, confidence: i.confidence, confirmed: !!meal.confirmed }));
    const tot = mealTotals(items);
    const rec = { id: uid('meal'), minute: meal.minute ?? nowMin(), name: meal.name || mealName(nowMin()), items, ...tot, confirmed: !!meal.confirmed, source: meal.source || 'manual', ...(meal.slot ? { slot: meal.slot } : {}) };
    await mutateDay(u, t, (d) => { (d.meals ||= []).push(rec); });
    if (meal.saveAsUsual) {
      const p = await store.get(u, 'profile');
      p.savedMeals = [...(p.savedMeals || []).slice(-5), { name: rec.name + ' (usual)', items: items.map(({ foodId, grams }) => ({ foodId, grams })) }];
      await save(u, 'profile', p);
    }
    return rec;
  }
  async function deleteMeal(u, { date, id }) { await mutateDay(u, date || today(), (d) => { d.meals = (d.meals || []).filter((m) => m.id !== id); }); return { ok: true }; }
  async function logWater(u, { ml }) { await mutateDay(u, today(), (d) => { (d.water ||= []).push({ minute: nowMin(), ml: Number(ml) }); }); return { ok: true }; }
  async function logCaffeine(u, { mg = 95, alsoWater = 0 }) {
    await mutateDay(u, today(), (d) => { (d.caffeine ||= []).push({ minute: nowMin(), mg }); if (alsoWater) (d.water ||= []).push({ minute: nowMin(), ml: alsoWater }); });
    return { ok: true };
  }
  async function logAlcohol(u) { await mutateDay(u, today(), (d) => { d.alcohol = (d.alcohol || 0) + 1; }); return { ok: true }; }
  async function logSupplement(u, { name }) { await mutateDay(u, today(), (d) => { (d.supplements ||= []).push({ minute: nowMin(), name }); }); return { ok: true }; }
  async function undoLast(u, { kind }) {
    await mutateDay(u, today(), (d) => { if (d[kind]?.length) d[kind].pop(); });
    return { ok: true };
  }

  async function logMenu(u) {
    const p = await store.get(u, 'profile');
    const days = (await store.get(u, 'days')) || {};
    const y = days[addDays(today(), -1)]?.meals || [];
    const m = nowMin();
    const ranked = y.slice().sort((a, b) => Math.abs(a.minute - m) - Math.abs(b.minute - m));
    return {
      sameAsYesterday: ranked.slice(0, 2).map((x) => ({ name: x.name, items: x.items.map(({ foodId, grams }) => ({ foodId, grams, name: findFood(foodId)?.name })), kcal: x.kcal })),
      saved: (p.savedMeals || []).map((s) => ({ ...s, kcal: mealTotals(s.items).kcal })),
    };
  }

  // ---------------- food photo (PRD 8.4) ----------------
  async function analyzeFood(u, { image, note }) {
    let items = null, stub = false, model = null;
    if (ai.available() && (image || (note && note.trim().length > 2))) {
      try {
        const r = await ai.food({ image, note, foodNames: FOODS.map((f) => f.name) });
        items = r.items; model = r.model;
      } catch (e) { items = null; }
    }
    if (!items) { items = stubFood(note); stub = true; }
    const mapped = items.map((it) => {
      const f = matchFood(it.match || it.name) || null;
      if (!f) return { name: it.name, unmatched: true };
      const lo = Number(it.grams_low) || f.portions.S, hi = Number(it.grams_high) || f.portions.L;
      const mid = Math.round((lo + hi) / 2); // F5.11
      return { name: it.name, foodId: f.id, foodName: f.name, grams: mid, gramsLow: Math.round(lo), gramsHigh: Math.round(hi), confidence: it.confidence ?? 0.7, portions: f.portions, source: f.source };
    });
    const ok = mapped.filter((m) => !m.unmatched);
    return { items: ok, unmatched: mapped.filter((m) => m.unmatched).map((m) => m.name), totals: mealTotals(ok), stub, model };
  }

  // ---------------- Insights ----------------
  async function insights(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const td = buildToday(data, wear, t, data.history);
    const series = (fn, n = 14) => { const out = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(t, -i); const cc = computeCore(data, wear, d); out.push({ date: d, v: fn(cc) }); } return out; };
    const statusSeries = series((cc) => cc.fused.WS);
    const sources = (k) => {
      if (k === 'sleep') return c.night ? (c.night.source === 'manual' ? 'Manual' : c.night.estimate ? 'Phone estimate' : 'Synced') : 'Not yet';
      if (k === 'recovery') return c.recovery?.mode === 'phone' ? 'Manual' : c.recovery ? 'Synced' : 'Not yet';
      if (k === 'activity') return c.hasWearable || Object.keys(c.asm.stepsByDate).length ? 'Synced' : 'Manual';
      if (k === 'nutrition') return (c.day.meals || []).length ? 'Logging' : 'Not yet';
      if (k === 'hydration') return (c.day.water || []).length ? 'Logging' : 'Not yet';
      return 'Manual';
    };
    const labs = foundationScore(data.labs.results || [], t);
    const fit = data.train.plan || c.asm.workouts.length ? fitnessScore({ profile: data.profile, today: t, nights: c.asm.nights, workouts: c.asm.workouts, sets: data.train.sets, tests: data.train.tests }) : null;
    return {
      readiness: c.ready, readinessLine: c.ready == null ? 'Check in to see readiness' : c.ready >= 75 ? 'Ready to push today' : c.ready >= 60 ? 'Ready for a balanced day' : c.ready >= 50 ? 'Keep it light today' : 'Rest and recover today',
      confidence: c.conf, status: c.fused.WS, statusSeries,
      tiles: [
        { key: 'sleep', name: 'Sleep', score: c.sleep ? Math.round(c.sleep.score) : null, source: sources('sleep'), detail: c.sleep ? fmtHours(c.sleep.t) : '--' },
        { key: 'recovery', name: 'Recovery', score: c.recovery ? Math.round(c.recovery.score) : null, source: sources('recovery'), detail: c.recovery?.z != null ? `HRV ${c.recovery.z > 0 ? '+' : ''}${c.recovery.z} SD` : 'Check-in based' },
        { key: 'activity', name: 'Activity', score: c.activity ? Math.round(c.activity.score) : null, source: sources('activity'), detail: c.activity ? `${c.activity.mvpa7} of 150 min` : '--' },
        { key: 'nutrition', name: 'Diet and nutrition', score: c.nutrition ? Math.round(c.nutrition.score) : null, source: sources('nutrition'), detail: `${(c.day.meals || []).length} of ${data.profile.usualMeals || 3} meals` },
        { key: 'hydration', name: 'Hydration', score: c.hydration ? Math.round(c.hydration.score) : null, source: sources('hydration'), detail: `${round(c.fluid / 1000, 1)} of ${round(c.wt / 1000, 1)} L` },
        { key: 'fitness', name: 'Fitness', score: fit?.FS ?? null, source: fit ? 'Weekly' : 'Not yet', detail: fit ? `${fit.confidence} confidence` : 'Set a training goal' },
        { key: 'biomarkers', name: 'Biomarkers', score: labs.score, source: labs.score != null ? 'PDF upload' : 'Not yet', detail: labs.score != null ? `Tested ${labs.testDate}` : 'Upload a lab PDF' },
      ],
      explained: explain(c, td),
      entitlements: entitlements(data.profile),
    };
  }

  function explain(c, td) {
    const e = c.fused.e;
    const rows = [
      { key: 'sleep', name: 'Sleep', score: c.sleep?.score, w: WEIGHTS.sleep, eff: e.sleep, driver: c.sleep ? `${fmtHours(c.sleep.t)} vs a need of ${fmtHours(c.N.N)}; quality from ${c.sleep.qSource}` : 'No sleep data yet' },
      { key: 'recovery', name: 'Recovery', score: c.recovery?.score, w: WEIGHTS.recovery, eff: e.recovery, driver: c.recovery ? (c.recovery.mode === 'wearable' ? `HRV ${c.recovery.z > 0 ? '+' : ''}${c.recovery.z} SD, resting HR ${c.recovery.delta > 0 ? '+' : ''}${c.recovery.delta} bpm vs your normal${c.recovery.CHK != null ? ', check-in ' + Math.round(c.recovery.CHK) : ''}${c.recovery.adjusted ? ' (cycle-adjusted)' : ''}` : `Check-in ${Math.round(c.recovery.CHK ?? c.recovery.score)}${c.recovery.mode === 'calibrating' ? ', baseline still building' : ''}`) : 'Do your morning check-in' },
      { key: 'activity', name: 'Activity', score: c.activity?.score, w: WEIGHTS.activity, eff: e.activity, driver: c.activity ? `${c.activity.steps != null ? c.activity.steps.toLocaleString() + ' steps yesterday, ' : ''}${c.activity.mvpa7} of 150 min this week, ${c.activity.strengthSessions} strength session${c.activity.strengthSessions === 1 ? '' : 's'}` : 'No movement data yet' },
      { key: 'nutrition', name: 'Fuel', score: c.nutrition?.score, w: WEIGHTS.nutrition, eff: e.nutrition, driver: c.nutrition ? `${c.nutrition.confirmed + c.nutrition.unconfirmed} of ${c.nutrition.usual} meals logged, so it counts ${Math.round(c.nutrition.cov * 100)}% of its weight` : 'Log a meal to add Fuel' },
      { key: 'hydration', name: 'Hydration', score: c.hydration?.score, w: WEIGHTS.hydration, eff: e.hydration, driver: c.hydration ? `${c.fluid} of ${c.wt} ml` : 'Log water to add it' },
    ].map((r) => ({ ...r, score: r.score == null ? null : Math.round(r.score), contrib: r.score == null ? 0 : round((r.eff * r.score) / (c.fused.TW || 1), 1), gap: r.score == null ? 0 : round(Math.max(0, 80 - r.score) * r.eff, 2) }));
    const lever = rows.slice().sort((a, b) => b.gap - a.gap)[0];
    return {
      status: c.fused.WS, raw: c.fused.RAW, TW: c.fused.TW, rows, cap: c.fused.capped ? { value: c.fused.CAP, reason: c.fused.capReason } : null, eligible: c.fused.eligible,
      lever: lever?.gap > 0 ? { pillar: lever.name, oneThing: td.oneThing?.title } : null,
      readiness: c.ready, lb: c.lb, confidence: c.conf, engineVersion: ENGINE_VERSION,
      sources: [...new Set([c.night?.source, ...Object.keys(c.asm.stepsByDate).length ? [c.asm.workouts[0]?.source] : []].filter(Boolean))].map((s) => deviceById(s)?.name || s),
    };
  }

  async function sleepDetail(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const nights = c.asm.nights.filter((n) => daysBetween(n.date, t) < 7);
    return {
      score: c.sleep, need: c.N, usualBed: minToClock(c.bed), nights: nights.map((n) => ({ date: n.date, start: n.bedStartMin, end: n.bedEndMin, tst: n.tstH, eff: n.eff, deep: n.deepH, rem: n.remH, source: n.source, estimate: !!n.estimate })),
      avg7: nights.length ? round(mean(nights.map((n) => n.tstH)), 2) : null, phoneEstimate: c.night?.estimate && !c.night?.confirmed,
      insight: (() => { const f = factsFor(data, c); return f.lateCafDays >= 2 && f.sleepOnCafDays ? `On the ${f.lateCafDays} days you had caffeine within 8 hours of bed, you slept ${fmtHours(f.sleepOnCafDays)} on average.` : `Your sleep midpoint moved ${f.midDev} minutes from your usual this week.`; })(),
    };
  }

  async function recoveryDetail(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const nights = c.asm.nights.filter((n) => n.hrv && daysBetween(n.date, t) < 30);
    return {
      score: c.recovery, base: { ...c.base, hrvBaselineMs: c.base.hrvBaselineMs && round(c.base.hrvBaselineMs, 1), rhrBaseline: c.base.rhrBaseline && round(c.base.rhrBaseline, 1) },
      hrv: nights.map((n) => ({ date: n.date, v: n.hrv })), rhr: nights.map((n) => ({ date: n.date, v: n.rhr })),
      hrvBand: c.base.hrvBaselineMs ? [round(Math.exp(Math.log(c.base.hrvBaselineMs) - c.base.hrvSigma), 1), round(Math.exp(Math.log(c.base.hrvBaselineMs) + c.base.hrvSigma), 1)] : null,
      rhrBand: c.base.rhrBaseline ? [round(c.base.rhrBaseline - c.base.rhrSigma, 1), round(c.base.rhrBaseline + c.base.rhrSigma, 1)] : null,
      cycle: c.cyc.enabled && c.cyc.phase?.phase === 'Luteal' ? { learned: !!c.cyc.shift, note: c.cyc.shift ? `Luteal phase: resting heart rate up to ${c.cyc.shift.dRhr} bpm higher is normal for you, so Recovery adjusts for it.` : 'Luteal phase: resting heart rate often runs a little higher now. After 2 cycles we learn your own shift.' } : null,
      checkin: c.checkin, hasWearable: c.hasWearable,
    };
  }

  // Calories burned for a day (energy out). Today counts only the part of the day that has passed.
  function burnFor(data, c, d) {
    const t = today();
    const isToday = d === t;
    const nm = nowMin();
    let steps = c.asm.stepsByDate[d];
    if (steps == null && isToday) steps = Math.round((c.asm.stepsByDate[addDays(t, -1)] || 4000) * Math.min(1, Math.max(0, (now().getHours() - 6) / 14)));
    const wk = c.asm.workouts.filter((w) => w.date === d && (!isToday || (w.startMin ?? 0) + (w.minutes || 0) <= nm));
    const activeKcal = data.days[d]?.activeKcal ?? null;
    return caloriesBurned({ REE: c.en.REE, weightKg: data.profile.weightKg, steps, workouts: wk, activeKcal, dayFraction: isToday ? nm / 1440 : 1 });
  }

  async function nutritionDay(u, { date } = {}) {
    const { data, wear } = await ctx(u);
    const t = date || today();
    const c = computeCore(data, wear, t);
    const meals = c.day.meals || [];
    const tot = { kcal: sum(meals.map((m) => m.kcal)), protein: sum(meals.map((m) => m.protein)), carbs: sum(meals.map((m) => m.carbs || 0)), fat: sum(meals.map((m) => m.fat || 0)), fiber: sum(meals.map((m) => m.fiber)) };
    const showCalories = data.profile.edScreenPassed && !data.profile.edFlag;
    const kg = data.profile.weightKg || 70;
    const pt = data.train.plan?.proteinGPerKg || 1.2;
    const idea = mealIdea(data.profile, c.nutrition, c.en);
    const days7 = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); days7.push({ date: d, protein: round(sum((data.days[d]?.meals || []).map((m) => m.protein))), fluid: sum((data.days[d]?.water || []).map((w) => w.ml)) }); }
    return {
      date: t, meals: meals.map((m) => ({ ...m, items: m.items.map((i) => ({ ...i, name: findFood(i.foodId)?.name })) })),
      totals: Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, round(v)])),
      targets: { kcal: c.en.need, protein: round(pt * kg), carbsRange: [round(0.45 * c.en.need / 4), round(0.6 * c.en.need / 4)], fat: round(0.3 * c.en.need / 9), fiber: round(14 * c.en.need / 1000) },
      kcalRange: meals.length ? [sum(meals.map((m) => m.kcalLow || m.kcal)), sum(meals.map((m) => m.kcalHigh || m.kcal))] : null,
      score: c.nutrition, showCalories, idea: { ...idea, ...mealTotals(idea.items), items: idea.items.map((i) => ({ ...i, name: findFood(i.foodId)?.name })) },
      burn: (() => { const b = burnFor(data, c, t); const eatenK = meals.length ? round(tot.kcal) : 0; return { ...b, eaten: eatenK, net: energyBalance({ eatenKcal: eatenK, burnedKcal: b.total }), fullDay: data.profile.weightGoal === 'lose' ? round(c.en.REE * c.en.AF) : round(c.en.need) }; })(),
      water: { fluid: c.fluid, target: c.wt, logs: c.day.water || [] }, caffeine: { logs: c.day.caffeine || [], cutoffMin: c.bed - 8.8 * 60, bed: c.bed }, days7,
    };
  }

  // ---------------- Meal plan ----------------
  function labFlags(data) {
    const latest = {};
    for (const r of data.labs?.results || []) if (!latest[r.key] || r.date >= latest[r.key].date) latest[r.key] = r;
    return Object.values(latest).map((r) => { const m = markerByKey(r.key); return m ? { key: r.key, low: r.value < m.opt[0], high: r.value > m.opt[1] } : null; }).filter(Boolean);
  }
  function goalFor(data, c, d, t) {
    const planned = todaysPlanned(data, d);
    const isToday = d === t;
    return nutritionGoal({
      profile: data.profile, en: c.en, trainingToday: !!planned,
      trainingCode: planned ? (isToday && c.ready != null ? (c.ready >= 80 ? 'push' : c.ready < 50 ? 'lighter' : 'planned') : 'planned') : null,
      shortSleep: isToday && c.night?.tstH != null && c.night.tstH < (c.N?.N || 7.5) - 1,
      cyclePhase: isToday ? (c.cyc?.phase?.phase || null) : null, labs: labFlags(data), waterMl: isToday ? c.wt : null,
    });
  }
  function loggedSlots(data, d) {
    const out = {};
    for (const m of data.days[d]?.meals || []) out[m.slot || mealSlot(m).toLowerCase()] = true;
    return out;
  }
  function planDays(data, c, mp, from, n) {
    const t = today();
    const prefs = mp.prefs || {};
    const days = [];
    let recent = [];
    for (let i = -2; i < n; i++) {
      const d = addDays(from, i);
      const goal = goalFor(data, c, d, t);
      const day = buildDay({ date: d, goal, profile: data.profile, prefs, override: mp.overrides?.[d] || {}, recent, logged: loggedSlots(data, d) });
      recent = [...recent, ...day.meals.map((m) => m.recipeId).filter(Boolean)].slice(-8);
      if (i >= 0) days.push({ ...day, goal });
    }
    return days;
  }
  async function mealPlanDoc(u) { return (await store.get(u, 'mealplan')) || structuredClone(EMPTY.mealplan); }
  async function todayMealPlan(u, data, c) {
    const mp = await mealPlanDoc(u);
    return planDays(data, c, mp, today(), 1)[0];
  }
  async function mealPlan(u, { date } = {}) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const mp = await mealPlanDoc(u);
    const week = planDays(data, c, mp, t, 7);
    const sel = week.find((x) => x.date === (date || t)) || week[0];
    const showCalories = data.profile.edScreenPassed !== false && !data.profile.edFlag;
    const GOAL_PHRASE = { 'Sleep better': 'better sleep', 'More energy': 'more energy', 'Lose weight': 'losing weight', 'Build strength': 'building strength', 'Manage stress': 'managing stress', 'Eat better': 'eating better', 'Get fitter': 'getting fitter', 'Feel balanced': 'feeling balanced' };
    const masterGoal = data.profile.weightGoal === 'lose' ? 'losing weight at a safe pace' : GOAL_PHRASE[(data.profile.goals || [])[0]] || 'feeling your best';
    return {
      date: sel.date, today: t, prefs: mp.prefs, needsSetup: !mp.prefs, showCalories, masterGoal,
      goal: sel.goal, day: sel, note: mp.notes?.[sel.date] || null,
      week: week.map((x) => ({ date: x.date, kcal: x.totals.kcal, goalKcal: x.goal.kcal, meals: x.meals.filter((m) => m.slot !== 'snack').map((m) => ({ slot: m.slot, name: m.out ? 'Eating out' : m.name, prep: m.prep, kcal: m.out ? m.budget : Math.round(m.totals?.kcal || 0) })) })),
      grocery: groceryList(week, mp.grocery || []), groceryChecked: (mp.grocery || []).length,
      allergies: data.profile.allergies || [], diet: data.profile.diet || 'none',
      provenance: 'Calories and macros are calculated per gram from USDA FoodData Central values (rounded). Recipes come from the Health Track recipe library. When Claude adjusts a plan it only picks library recipes and portion sizes; it never sets the numbers.',
      aiAvailable: ai.available(),
    };
  }
  async function mealPlanAction(u, { date, op, slot, value }) {
    const mp = await mealPlanDoc(u);
    const d = date || today();
    mp.overrides ||= {}; mp.notes ||= {};
    const ov = (mp.overrides[d] ||= {});
    if (op === 'prefs') mp.prefs = { skill: value?.skill === 'beginner' ? 'beginner' : 'confident', prepMax: [15, 30, 45].includes(Number(value?.prepMax)) ? Number(value.prepMax) : 30 };
    else if (op === 'swap') { ov[slot] = { swaps: ((ov[slot]?.swaps) || 0) + 1 }; }
    else if (op === 'out') { ov[slot] = ov[slot]?.out ? {} : { out: true, by: 'you' }; }
    else if (op === 'reset') { delete mp.overrides[d]; delete mp.notes[d]; }
    else if (op === 'grocery') { const s = new Set(mp.grocery || []); if (s.has(value)) s.delete(value); else s.add(value); mp.grocery = [...s]; }
    else if (op === 'groceryClear') { mp.grocery = []; }
    else if (op === 'log') {
      const { data, wear } = await ctx(u);
      const c = computeCore(data, wear, today());
      const day = planDays(data, c, mp, d, 1)[0];
      const m = day.meals.find((x) => x.slot === slot);
      if (!m || m.out || !m.items) throw new Error('Nothing to log for that meal');
      await logMeal(u, { date: d, items: m.items.map((i) => ({ foodId: i.foodId, grams: i.grams })), name: m.name, slot, confirmed: true, source: 'plan' });
      return { ok: true };
    }
    await save(u, 'mealplan', mp);
    return { ok: true };
  }
  async function adjustMealPlan(u, { date, text }) {
    const { data, wear } = await ctx(u);
    const t = today();
    const d = date || t;
    const c = computeCore(data, wear, t);
    const mp = await mealPlanDoc(u);
    const day = planDays(data, c, mp, d, 1)[0];
    const req = String(text || '').slice(0, 400);
    let result = null;
    if (ai.available()) {
      const options = ['breakfast', 'lunch', 'dinner', 'snack'].map((s) => ({ slot: s, recipes: candidates(s, data.profile, mp.prefs || {}).map((r) => ({ id: r.id, name: r.name, kcal: Math.round(r.base.kcal), protein: Math.round(r.base.protein), tags: r.tags, ingredients: r.items.map((i) => i.foodId) })) }));
      const system = `You adjust a one-day meal plan for a wellness app. Reply with JSON only: {"changes":[{"slot":"breakfast|lunch|dinner|snack","recipeId":"<id from options or omit>","portion":<0.6-1.6 or omit>,"out":<true if the person eats this meal out>}],"explanation":"<one or two plain sentences to the person>"}.
Rules: only use recipe ids from the options (they already respect allergies and diet). Never state calorie or nutrient numbers; the app calculates them. If eating out, set out:true for that meal and make other meals a little smaller with portion 0.8-0.9. If the person mentions an ingredient they have, pick recipes containing it. Keep the day's goal in mind: ${day.goal.focus.map((f) => f.why).join(' ')}`;
      const msg = `Today's plan: ${day.meals.map((m) => `${m.slot}: ${m.out ? 'eating out' : m.name}`).join('; ')}.
Options: ${JSON.stringify(options)}
Request: ${req}`;
      try {
        const r = await ai.genie({ system, messages: [{ role: 'user', content: msg }] });
        if (r && Array.isArray(r.changes)) {
          const ov = {};
          for (const ch of r.changes.slice(0, 4)) {
            if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(ch.slot)) continue;
            if (ch.out) { ov[ch.slot] = { out: true, by: 'claude' }; continue; }
            const rec = ch.recipeId ? recipeById(ch.recipeId) : null;
            const ok = rec && rec.slot === ch.slot && candidates(ch.slot, data.profile, mp.prefs || {}).some((x) => x.id === rec.id);
            const portion = Number(ch.portion) >= 0.6 && Number(ch.portion) <= 1.6 ? Math.round(Number(ch.portion) * 20) / 20 : undefined;
            if (ok || portion) ov[ch.slot] = { ...(ok ? { recipeId: rec.id } : { recipeId: day.meals.find((m) => m.slot === ch.slot)?.recipeId }), ...(portion ? { portion } : {}), by: 'claude' };
          }
          if (Object.keys(ov).length) result = { override: ov, explanation: String(r.explanation || '').slice(0, 400), by: 'claude' };
        }
      } catch (e) { /* fall back to rules */ }
    }
    if (!result) { const r = parseRequest(req, day, data.profile); result = { ...r, by: 'rules' }; }
    mp.overrides ||= {}; mp.notes ||= {};
    if (result.matched !== false) mp.overrides[d] = { ...(mp.overrides[d] || {}), ...result.override };
    // an ingredient to use up: if nothing left today can use it, carry it to tomorrow and say so
    const pref = result.override?.prefer;
    if (pref) {
      const after = planDays(data, c, mp, d, 1)[0];
      const usedToday = after.meals.some((m) => !m.logged && !m.out && m.items?.some((i) => i.foodId === pref));
      if (!usedToday) {
        const tm = addDays(d, 1);
        mp.overrides[tm] = { ...(mp.overrides[tm] || {}), prefer: pref };
        const nm = (findFood(pref)?.name || pref).toLowerCase().split(',')[0];
        result.explanation = result.explanation.replace(/Meals now use the [^.]*\./, `The meals left today can't use the ${nm}, so tomorrow's plan does.`);
      }
    }
    mp.notes[d] = { text: req, explanation: result.explanation, by: result.by };
    await save(u, 'mealplan', mp);
    return { ok: true, explanation: result.explanation, by: result.by };
  }

  // ---------------- Calorie deficit ----------------
  async function deficit(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const p = data.profile;
    const c = computeCore(data, wear, t);
    const safety = deficitSafety({ profile: p, age: ageFrom(p.dob, t), lifeStage: data.cycle?.lifeStage });
    if (safety?.hidden) return { hidden: true, reason: safety.reason };
    const pace = PACES[p.deficitPace] ? p.deficitPace : 'gentle';
    const plan = deficitPlan({ REE: c.en.REE, AF: c.en.AF, sex: p.sex, weightKg: p.weightKg, pace });
    const paceOptions = Object.values(PACES).map((x) => ({ ...x, ...deficitPlan({ REE: c.en.REE, AF: c.en.AF, sex: p.sex, weightKg: p.weightKg, pace: x.id }) }));
    const kcalOf = (meals, k) => sum(meals.map((m) => m[k] ?? m.kcal ?? 0));
    const meals = c.day.meals || [];
    const usual = p.usualMeals || 3;
    const eaten = { low: round(kcalOf(meals, 'kcalLow')), high: round(kcalOf(meals, 'kcalHigh')), kcal: round(kcalOf(meals, 'kcal')), meals: meals.length, usual };
    const days7 = [];
    for (let i = 7; i >= 1; i--) {
      const d = addDays(t, -i);
      const dm = data.days[d]?.meals || [];
      const cd = computeCore(data, wear, d);
      const tdee = round(cd.en.REE * cd.en.AF);
      const kcal = round(kcalOf(dm, 'kcal'));
      const complete = dm.length >= usual || (dm.length >= 2 && kcal >= 0.6 * tdee); // all usual meals, or most of the day's food clearly logged
      const burned = burnFor(data, cd, d).total;
      days7.push({ date: d, tdee, burned, kcal, meals: dm.length, complete, deficit: complete ? tdee - kcal : null });
    }
    const week = weekSummary(days7);
    const log = (p.weightLog?.length ? p.weightLog : p.weightKg ? [{ date: p.createdAt || t, kg: p.weightKg }] : []).slice(-30);
    const enabled = p.weightGoal === 'lose' && !safety;
    return {
      hidden: false, paused: !!safety, pausedReason: safety?.reason || null, enabled, pace, paces: paceOptions, plan, floor: calorieFloor(p.sex),
      burned: burnFor(data, c, t),
      today: { ...eaten, deficit: meals.length ? dayDeficit({ tdee: plan.tdee, kcalLow: eaten.low, kcalHigh: eaten.high }) : null, left: round(plan.target - eaten.kcal), complete: meals.length >= usual },
      days7, week, weightKg: p.weightKg || null, targetKg: p.targetWeightKg || null, units: p.units || 'metric', weightLog: log,
      projection: enabled ? projection({ weightKg: p.weightKg, targetKg: p.targetWeightKg, daily: plan.daily, today: t }) : null,
      startedAt: p.deficitStartedAt || null,
    };
  }
  async function setDeficitGoal(u, { enabled, pace, targetKg, weightKg }) {
    const p = await store.get(u, 'profile');
    const t = today();
    if (weightKg != null && weightKg !== '') {
      const w = Number(weightKg);
      if (!(w >= 30 && w <= 300)) throw new Error('Please enter a weight between 30 and 300 kg.');
      if (w !== p.weightKg) { p.weightKg = w; p.weightLog = [...(p.weightLog || []).filter((x) => x.date !== t), { date: t, kg: w }].slice(-120); }
    }
    if (enabled === false) { p.weightGoal = 'maintain'; }
    else {
      if (!p.weightKg) throw new Error('Add your current weight first.');
      p.weightGoal = 'lose';
      if (PACES[pace]) p.deficitPace = pace;
      if (!p.deficitStartedAt) p.deficitStartedAt = t;
    }
    if (targetKg !== undefined) {
      const tk = targetKg === '' || targetKg == null ? null : Number(targetKg);
      if (tk != null && !(tk >= 30 && tk < (p.weightKg || 300))) throw new Error('A target weight needs to be below your current weight.');
      p.targetWeightKg = tk;
    }
    await save(u, 'profile', p);
    return deficit(u);
  }
  async function logWeight(u, { kg }) {
    const w = Number(kg);
    if (!(w >= 30 && w <= 300)) throw new Error('Please enter a weight between 30 and 300 kg.');
    const p = await store.get(u, 'profile');
    const t = today();
    p.weightKg = w;
    p.weightLog = [...(p.weightLog || []).filter((x) => x.date !== t), { date: t, kg: w }].slice(-120);
    await save(u, 'profile', p);
    return { ok: true };
  }

  // ---------------- Health Genie ----------------
  async function geniePacket(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const td = buildToday(data, wear, t, data.history);
    const c = td.c;
    const f = td.facts;
    const labs = foundationScore(data.labs.results || [], t);
    const consentCycle = data.cycle.enabled;
    const nextDay = nextTrainingDay(data, t);
    const planned = todaysPlanned(data, t);
    return {
      date: t, name: data.profile.name, status: c.fused.WS, band: c.band?.name, confidence: c.conf, readiness: c.ready,
      pillars: Object.fromEntries(Object.entries(td.pillars).map(([k, v]) => [k, v ? Math.round(v.score) : null])),
      avgSleep3: f.avgSleep3 ? fmtHours(f.avgSleep3) : null, sleepNeed: fmtHours(c.N.N), lastNight: c.night ? fmtHours(c.night.tstH) : null,
      hrvZ: c.recovery?.z ?? null, rhrDelta: c.recovery?.delta ?? null, lateCaffeineDays: f.lateCafDays,
      stepsYesterday: c.activity?.steps ?? null, stepTarget: c.activity?.target ?? null, aerobicMinutes7d: c.activity?.mvpa7 ?? null,
      oneThing: td.oneThing?.title || 'Check in first', oneThingWhy: td.oneThing?.why || null, focusHabit: td.habit.focus ? actionById(td.habit.focus.actionId)?.title : null,
      trainingVerdict: td.session?.verdict?.verdict, sessionNote: td.session?.verdict?.note, plannedSession: planned?.name || null,
      nextTrainingDay: new Date(nextDay + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' }),
      proteinSoFar: round(c.nutrition?.protein || 0), proteinTarget: round((data.train.plan?.proteinGPerKg || 1.2) * (data.profile.weightKg || 70)),
      fluidMl: c.fluid, waterTargetMl: c.wt, windDown: minToClock(c.bed - 20),
      allergies: (data.profile.allergies || []).join(', ') || null, goals: data.memory.goals.map((g) => g.text), constraints: data.memory.constraints.map((g) => g.text), tone: data.memory.preferences?.tone,
      cycle: consentCycle && c.cyc.pred ? { day: c.cyc.pred.CD, phase: c.cyc.phase?.phase, label: c.cyc.phase?.label, next: c.cyc.pred.next, normalNote: c.cyc.phase?.phase === 'Luteal' ? 'A slightly higher resting heart rate is normal for this phase.' : '' } : null,
      foundation: labs.score != null ? { score: labs.score, date: labs.testDate, worthALook: labs.rows.filter((r) => r.status === 'Worth a look').map((r) => r.name).join(', ') || null } : null,
    };
  }

  async function genieChat(u, { text }) {
    const chat = (await store.get(u, 'chat')) || { messages: [], actions: [] };
    const userMsg = { id: uid('msg'), role: 'user', text, at: now().toISOString() };
    chat.messages.push(userMsg);
    const flag = redFlag(text);
    let reply;
    if (flag) {
      // Approved copy only, no model free text; training paused (PRD 8.3)
      reply = { id: uid('msg'), role: 'assistant', safety: { key: flag, ...SAFETY_RESPONSES[flag] }, text: SAFETY_RESPONSES[flag].body, at: now().toISOString() };
      const train = (await store.get(u, 'train')) || EMPTY.train;
      train.overrides = { ...(train.overrides || {}), [today()]: { code: 'rest', verdict: 'Rest', reason: 'safety' } };
      await save(u, 'train', train);
      if (flag === 'ed') { const p = await store.get(u, 'profile'); p.edFlag = true; await save(u, 'profile', p); }
    } else {
      const packet = await geniePacket(u);
      let out = null, source = 'stub';
      if (ai.available()) {
        const prompt = buildPrompt(packet, chat.messages.slice(0, -1).filter((m) => !m.safety), text);
        for (let attempt = 0; attempt < 2 && !out; attempt++) {
          try {
            const r = await ai.genie(prompt);
            if (r && typeof r.reply === 'string') {
              const chk = postCheck(r.reply, packet, text); // F10.2
              if (chk.ok) { out = r; source = r.model || 'claude'; }
            }
          } catch (e) { if (e?.code === 'not_granted' || e?.code === 'sampling_disabled') break; }
        }
      }
      if (!out) out = stubReply(packet, text);
      reply = { id: uid('msg'), role: 'assistant', text: out.reply, chips: (out.chips || []).slice(0, 3), action: out.action ? { ...out.action, id: uid('act'), status: 'proposed' } : null, quickReplies: (out.quickReplies || []).slice(0, 2), source, at: now().toISOString() };
    }
    chat.messages.push(reply);
    await save(u, 'chat', chat);
    return { reply, messages: chat.messages };
  }

  async function genieStream(u) { return (await store.get(u, 'chat')) || { messages: [], actions: [] }; }

  async function genieAction(u, { messageId, decision }) {
    const chat = (await store.get(u, 'chat')) || { messages: [], actions: [] };
    const m = chat.messages.find((x) => x.id === messageId);
    if (!m?.action || m.action.status !== 'proposed') return { ok: false };
    const a = m.action;
    if (decision === 'confirm') {
      // Validated tool calls (PRD 8.1): the backend checks every parameter.
      if (a.type === 'log_water') { const ml = Math.min(1000, Math.max(50, Number(a.params?.ml) || 250)); await logWater(u, { ml }); a.result = `Logged ${ml} ml`; }
      else if (a.type === 'move_workout') {
        const train = (await store.get(u, 'train')) || EMPTY.train;
        const data = await load(u);
        const planned = todaysPlanned(data, today());
        const to = nextTrainingDay(data, today());
        if (planned) { train.moved = [...(train.moved || []), { from: today(), to, sessionIndex: planned.index }]; a.result = `Moved to ${new Date(to + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' })}; today is a 20 min zone 2 walk`; }
        else a.result = 'Nothing was planned today, so nothing moved';
        await save(u, 'train', train);
      } else if (a.type === 'set_reminder') {
        const r = (await store.get(u, 'reminders')) || [];
        r.push({ id: uid('rem'), time: String(a.params?.time || '9:00 pm').slice(0, 10), text: String(a.params?.text || a.title).slice(0, 80), created: today() });
        await save(u, 'reminders', r);
        a.result = `Reminder set for ${a.params?.time || '9:00 pm'}`;
      } else { a.result = 'That action is not available'; a.status = 'rejected'; }
      if (a.status !== 'rejected') a.status = 'done';
      chat.actions = [...(chat.actions || []), { at: now().toISOString(), title: a.title, result: a.result }];
    } else a.status = 'dismissed';
    await save(u, 'chat', chat);
    return { ok: true, action: a };
  }

  async function flagAnswer(u, { messageId }) {
    const chat = (await store.get(u, 'chat')) || { messages: [] };
    const m = chat.messages.find((x) => x.id === messageId);
    if (m) m.flagged = true;
    await save(u, 'chat', chat);
    return { ok: true };
  }

  async function getMemory(u) {
    const mem = (await store.get(u, 'memory')) || EMPTY.memory;
    const h = (await store.get(u, 'history')) || [];
    const ids = [...new Set(h.map((r) => r.actionId))];
    const works = ids.map((id) => ({ id, title: actionById(id)?.title, rate: Math.round(100 * successRate(h, id)), n: h.filter((r) => r.actionId === id).length }))
      .filter((x) => x.title && x.n >= 2).sort((a, b) => b.rate - a.rate).slice(0, 5);
    return { ...mem, worksForMe: works };
  }
  async function updateMemory(u, mem) {
    const cur = (await store.get(u, 'memory')) || EMPTY.memory;
    const next = { ...cur, ...mem };
    delete next.worksForMe;
    await save(u, 'memory', next);
    return getMemory(u);
  }

  // ---------------- Progress ----------------
  async function progress(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const h = data.history;
    const hs = habitState(h, t);
    // Heat calendar of One Thing outcomes, 12 weeks
    const cells = [];
    const start = addDays(t, -83 - weekday(addDays(t, -83)) + 1);
    for (let d = start; d <= t; d = addDays(d, 1)) {
      const r = h.find((x) => x.date === d);
      cells.push({ date: d, v: r?.outcome === 'done' ? 3 : r?.outcome === 'partly' ? 2 : r?.outcome === 'skipped' || r?.outcome === 'notforme' ? 1 : 0 });
    }
    // Momentum: recency-weighted One Thing follow-through over 28 days (demo definition, PD)
    const momentumAt = (end) => {
      let num = 0, den = 0;
      for (let i = 0; i < 28; i++) {
        const d = addDays(end, -i);
        const r = h.find((x) => x.date === d);
        const w = Math.pow(0.95, i);
        den += w;
        num += w * (r?.outcome === 'done' ? 1 : r?.outcome === 'partly' ? 0.5 : 0);
      }
      return Math.round((100 * num) / den);
    };
    const momentum = momentumAt(t);
    const trend = [3, 2, 1, 0].map((w) => momentumAt(addDays(t, -7 * w)));
    const doneN = h.filter((r) => r.outcome === 'done').length;
    let best = 0, run = 0;
    for (const cell of cells) { if (cell.v >= 2) { run++; best = Math.max(best, run); } else run = 0; }
    const ladderIdx = (() => {
      const g = hs.graduated.map((x) => actionById(x.actionId)?.ladder).filter(Boolean);
      let i = 0; while (i < LADDER.length && g.includes(LADDER[i].id)) i++; return i;
    })();
    // goals and habits progress (7/30 day)
    const last = (n) => h.filter((r) => daysBetween(r.date, t) < n);
    const rate = (arr) => (arr.length ? Math.round((100 * arr.filter((r) => r.outcome === 'done').length) / arr.length) : 0);
    const steps30 = [];
    for (let i = 29; i >= 0; i--) { const d = addDays(t, -i); steps30.push({ date: d, v: wear.stepsByDate[d] ?? null }); }
    const goalsRows = (data.profile.goals || []).map((g) => {
      const map = { 'Sleep better': 'sleep', 'More energy': 'recovery', 'Build strength': 'activity', 'Lose weight': 'nutrition', 'Eat better': 'nutrition', 'Move more': 'activity', 'Reduce stress': 'recovery', 'Train smarter': 'activity', 'Understand my data': 'sleep' };
      const pillar = map[g] || 'activity';
      const rs = last(7).filter((r) => actionById(r.actionId)?.pillar === pillar);
      return { goal: g, pillar, done: rs.filter((r) => r.outcome === 'done').length, of: 7 };
    });
    const weekly = weeklyReview(data, wear, t);
    return {
      momentum, trend, cells, doneN, graduatedN: hs.graduated.length, bestStreak: best,
      focus: hs.focus ? { ...hs.focus, title: fill(actionById(hs.focus.actionId)?.title || '', {}), twoMin: actionById(hs.focus.actionId)?.twoMin } : null,
      graduated: hs.graduated.map((g) => ({ ...g, title: fill(actionById(g.actionId)?.title || '', {}) })), backOff: hs.backOff,
      ladder: LADDER.map((l, i) => ({ ...l, state: i < ladderIdx ? 'graduated' : i === ladderIdx ? 'current' : 'locked' })),
      rate7: rate(last(7)), rate30: rate(last(30)), goalsRows, steps30, goals: data.profile.goals, struggles: data.profile.struggles, weekly,
    };
  }

  function weeklyReview(data, wear, t) {
    const wk = (off) => { const out = []; for (let i = 0; i < 7; i++) { const cc = computeCore(data, wear, addDays(t, -i - off)); out.push(cc); } return out; };
    const thisW = wk(0), prevW = wk(7);
    const avg = (arr, f) => { const v = arr.map(f).filter((x) => x != null); return v.length ? mean(v) : null; };
    const s1 = avg(thisW, (c) => c.night?.tstH), s0 = avg(prevW, (c) => c.night?.tstH);
    const ws1 = avg(thisW, (c) => c.fused.WS), ws0 = avg(prevW, (c) => c.fused.WS);
    const done = data.history.filter((r) => daysBetween(r.date, t) < 7 && r.outcome === 'done').length;
    const cards = [
      { type: 'Win', title: `${done} One Things done this week`, body: done >= 4 ? 'That is the habit-building zone. Small and steady is working.' : 'Every one counts. Next week, aim for one more.' },
      s1 != null && s0 != null ? { type: 'Pattern', title: `Sleep ${s1 >= s0 ? 'up' : 'down'} ${fmtHours(Math.abs(s1 - s0))} a night`, body: `You averaged ${fmtHours(s1)} this week vs ${fmtHours(s0)} last week. Weeks with fewer late coffees tended to go with longer sleep (an association, not proof).` } : null,
      ws1 != null ? { type: 'Pattern', title: `Average status ${Math.round(ws1)}`, body: ws0 != null ? `${ws1 >= ws0 ? 'Up' : 'Down'} ${Math.abs(Math.round(ws1 - ws0))} points from last week.` : 'Your first full week.' } : null,
      { type: 'Next week', title: 'One thing to protect', body: 'Keep your focus habit going 5 of 7 days. That is the rule that makes it stick.' },
    ].filter(Boolean);
    return { cards, generatedBy: 'Weekly review engine (structured data only)' };
  }

  async function updateGoals(u, { goals, struggles }) {
    const p = await store.get(u, 'profile');
    if (goals) p.goals = goals.slice(0, 3);
    if (struggles) p.struggles = struggles.slice(0, 3);
    await save(u, 'profile', p);
    return { ok: true };
  }

  // ---------------- Train ----------------
  async function train(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const td = buildToday(data, wear, t, data.history);
    const fit = fitnessScore({ profile: data.profile, today: t, nights: c.asm.nights, workouts: c.asm.workouts, sets: data.train.sets, tests: data.train.tests });
    const lm = loadMetrics(c.asm.workouts, t, c.hm.value);
    const readinessHistory = [];
    for (let i = 6; i >= 0; i--) readinessHistory.push(computeCore(data, wear, addDays(t, -i)).ready);
    const checkins = []; for (let i = 6; i >= 0; i--) checkins.push(data.days[addDays(t, -i)]?.checkin);
    const lowHrvDays = c.asm.nights.filter((n) => n.hrv && daysBetween(n.date, t) < 7 && c.base.hrvBaselineMs && Math.log(n.hrv) < Math.log(c.base.hrvBaselineMs) - c.base.hrvSigma).length;
    const dl = deloadSignals({ readinessHistory, nights: c.asm.nights, base: { lowHrvDays, delta: c.recovery?.delta }, checkins, lifts: fit.lifts, load: lm });
    // weekly hard sets per muscle group (F12.8)
    const groupSets = {};
    for (const s of data.train.sets.filter((s) => daysBetween(s.date, t) < 7 && (s.rir ?? 2) <= 4)) for (const g of EXERCISES[s.exercise]?.groups || []) groupSets[g] = (groupSets[g] || 0) + 1;
    const history = c.asm.workouts.filter((w) => daysBetween(w.date, t) < 60).slice().reverse().map((w) => ({ ...w, sourceName: w.source === 'healthtrack' || w.source === 'manual' ? (w.source === 'manual' ? 'Manual' : 'Health Track') : 'Device' }));
    const week = c.asm.workouts.filter((w) => daysBetween(w.date, t) < 7);
    return {
      plan: data.train.plan, session: td.session, readiness: c.ready, band: c.band?.name, fitness: fit, zones: hrZones(data.profile, t, c.asm.workouts, c.base.rhrBaseline),
      load: { ...c.lb, ...lm, daily: lm.daily.slice(-28) }, deload: dl, groupSets, weeklySetTarget: data.train.plan?.weeklySetsStart || 10,
      history, weekSummary: { sessions: week.length, minutes: sum(week.map((w) => w.minutes || 0)), acwr: c.lb.acwr },
      todaySets: data.train.sets.filter((s) => s.date === t), tests: data.train.tests, teen: ageFrom(data.profile.dob, t) < 18,
      entitlements: entitlements(data.profile),
    };
  }

  async function setTrainingGoal(u, cfg) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    const flagged = cfg.screen && Object.values(cfg.screen).some(Boolean);
    tr.plan = { ...buildPlan(cfg.goal, Number(cfg.days), Number(cfg.minutes), cfg.experience), equipment: cfg.equipment || [], injuries: cfg.injuries || '', lightOnly: flagged };
    tr.screen = cfg.screen || {};
    await save(u, 'train', tr);
    return tr.plan;
  }

  async function logSet(u, set) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    const t = today();
    const rec = { id: uid('set'), date: t, exercise: set.exercise, load: Number(set.load), reps: Number(set.reps), rir: Number(set.rir ?? 2), pain: !!set.pain, source: 'healthtrack' };
    tr.sets.push(rec);
    // a session workout record so Activity and load see it
    let w = tr.workouts.find((x) => x.date === t && x.type === 'Strength' && x.source === 'healthtrack');
    if (!w) { w = { id: uid('w'), date: t, startMin: nowMin(), type: 'Strength', minutes: 0, rpe: 7, strength: true, workingSets: 0, muscleGroups: [], source: 'healthtrack' }; tr.workouts.push(w); }
    w.workingSets += 1; w.minutes = Math.min(90, w.minutes + 4);
    w.muscleGroups = [...new Set([...w.muscleGroups, ...(EXERCISES[set.exercise]?.groups || [])])];
    if (set.pain) tr.painFlags = { ...(tr.painFlags || {}), [set.exercise]: t }; // FIT-10 blocks progression
    await save(u, 'train', tr);
    return { set: rec, e1rm: round(e1rm(rec.load, rec.reps, rec.rir), 1) };
  }

  async function logWorkout(u, w) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    const rec = { id: uid('w'), date: w.date || today(), startMin: w.start ? clockToMin(w.start) : nowMin(), type: w.type, minutes: Number(w.minutes), distanceKm: w.distanceKm ? Number(w.distanceKm) : null, rpe: Number(w.rpe || 5), strength: w.type === 'Strength', workingSets: w.type === 'Strength' ? 6 : 0, muscleGroups: w.type === 'Strength' ? ['full body', 'core'] : [], notes: w.notes || '', source: w.source || 'manual', steps: w.steps || null };
    tr.workouts.push(rec);
    if (w.steps) await mutateDay(u, rec.date, (d) => { d.extraSteps = (d.extraSteps || 0) + Number(w.steps); });
    await save(u, 'train', tr);
    return rec;
  }
  async function deleteWorkout(u, { id }) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    tr.workouts = tr.workouts.filter((w) => w.id !== id);
    await save(u, 'train', tr);
    return { ok: true };
  }
  async function overrideSession(u, { code }) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    const labels = { push: 'Push', planned: 'As planned', lighter: 'Lighter', rest: 'Rest' };
    tr.overrides = { ...(tr.overrides || {}), [today()]: { code, verdict: labels[code], reason: 'user override', at: now().toISOString() } }; // override is logged (FIT-04)
    await save(u, 'train', tr);
    return { ok: true };
  }
  async function logFitnessTest(u, { method, value, minutes, endHr }) {
    const tr = (await store.get(u, 'train')) || structuredClone(EMPTY.train);
    const p = await store.get(u, 'profile');
    const age = ageFrom(p.dob, today());
    let vo2;
    if (method === 'cooper') vo2 = (Number(value) - 504.9) / 44.73; // F12.4
    else vo2 = 132.853 - 0.0769 * (p.weightKg || 70) * 2.2046 - 0.3877 * age + 6.315 * (p.sex === 'male' ? 1 : 0) - 3.2649 * Number(minutes) - 0.1565 * Number(endHr);
    tr.tests = [...(tr.tests || []), { date: today(), method: method === 'cooper' ? 'Cooper 12-minute run' : 'Rockport 1-mile walk', vo2: round(vo2, 1) }];
    await save(u, 'train', tr);
    return { vo2: round(vo2, 1) };
  }

  // ---------------- Labs and Foundation ----------------
  async function labs(u) {
    const data = await load(u);
    const t = today();
    const fs = foundationScore(data.labs.results || [], t);
    const history = {};
    for (const r of (data.labs.results || []).filter((x) => x.confirmed)) (history[r.key] ||= []).push({ date: r.date, value: r.value });
    return { ...fs, reports: data.labs.reports || [], history, markers: MARKERS, entitlements: entitlements(data.profile) };
  }

  async function readLabReport(u, { text, fileName }) {
    const rules = parseLabText(text || '');
    let markers = rules.markers, source = 'rules', testDate = rules.testDate;
    if (ai.available() && text) {
      try {
        const r = await ai.labs({ text: text.slice(0, 20000), markers: MARKERS.map((m) => ({ key: m.key, name: m.name, unit: m.unit })) });
        if (r?.markers?.length) {
          const merged = [];
          for (const m of r.markers) {
            const def = markerByKey(m.key);
            if (!def || m.value == null || Number.isNaN(Number(m.value))) continue;
            const ruleHit = rules.markers.find((x) => x.key === m.key);
            const agree = ruleHit && Math.abs(ruleHit.value - Number(m.value)) < 1e-6;
            merged.push({ key: m.key, name: def.name, value: Number(m.value), unit: m.unit || def.unit, loinc: def.loinc, snippet: m.snippet || ruleHit?.snippet || '', confidence: agree ? 0.95 : 0.6 });
          }
          if (merged.length) { markers = merged; source = 'ai'; testDate = r.testDate || testDate; }
        }
      } catch (e) { /* fall back to rules */ }
    }
    return { fileName, testDate: testDate || today(), markers: markers.map((m) => ({ ...m, status: markerStatus(markerByKey(m.key), m.value).word })), source };
  }

  async function confirmLabs(u, { markers, testDate, fileName }) {
    const lb = (await store.get(u, 'labs')) || structuredClone(EMPTY.labs);
    for (const m of markers.filter((x) => x.confirmed)) {
      lb.results = lb.results.filter((r) => !(r.key === m.key && r.date === testDate));
      lb.results.push({ key: m.key, value: Number(m.value), unit: m.unit, date: testDate, confirmed: true, source: 'PDF upload' });
    }
    lb.reports.push({ id: uid('lab'), date: testDate, name: fileName || 'Lab report.pdf', markers: markers.filter((x) => x.confirmed).length });
    await save(u, 'labs', lb);
    return labs(u);
  }

  // ---------------- Cycle ----------------
  async function cycle(u) {
    const { data, wear } = await ctx(u);
    const t = today();
    const c = computeCore(data, wear, t);
    const cy = data.cycle;
    if (!cy.enabled) return { enabled: false };
    const pred = c.cyc.pred;
    const days = [];
    if (pred) for (let i = 0; i < Math.max(28, Math.round(pred.Lhat)); i++) { const d = addDays(pred.lastStart, i); days.push({ date: d, cd: i + 1, phase: phaseOn(pred, cy, c.asm.nights, d)?.phase }); }
    return {
      enabled: true, storage: cy.storage, lifeStage: cy.lifeStage, pred, phase: c.cyc.phase, shift: c.cyc.shift, SB: c.cyc.SB, notices: c.cyc.notices,
      today: t, todayFlow: cy.flow?.[t] ?? 0, todaySymptoms: cy.symptoms?.[t] || {}, days, periods: cy.periods, symptomsList: SYMPTOMS, flows: FLOWS,
      recoveryNote: c.cyc.phase?.phase === 'Luteal' ? (c.cyc.shift ? `Luteal phase: Recovery is adjusted for your usual +${c.cyc.shift.dRhr} bpm resting heart rate.` : 'Luteal phase: some rise in resting heart rate is expected. After 2 cycles Recovery adjusts for your own shift.') : null,
      entitlements: entitlements(data.profile),
    };
  }
  async function setCycle(u, cfg) {
    const cy = { ...EMPTY.cycle, ...((await store.get(u, 'cycle')) || {}) };
    Object.assign(cy, cfg);
    if (cfg.lastPeriodStart && !cy.periods.find((p) => p.start === cfg.lastPeriodStart)) cy.periods.push({ start: cfg.lastPeriodStart, end: addDays(cfg.lastPeriodStart, 4) });
    delete cy.lastPeriodStart;
    await save(u, 'cycle', cy);
    return cycle(u);
  }
  async function logCycleDay(u, { date, flow, symptoms }) {
    const cy = { ...EMPTY.cycle, ...((await store.get(u, 'cycle')) || {}) };
    const d = date || today();
    if (flow != null) {
      cy.flow = { ...cy.flow, [d]: flow };
      if (flow >= 2) {
        const last = cy.periods.slice().sort((a, b) => (a.start < b.start ? -1 : 1)).slice(-1)[0];
        if (!last || daysBetween(last.start, d) > 10) cy.periods.push({ start: d, end: d });
        else if (d > (last.end || last.start)) last.end = d;
      }
    }
    if (symptoms) cy.symptoms = { ...cy.symptoms, [d]: symptoms };
    await save(u, 'cycle', cy);
    return { ok: true };
  }
  async function deleteCycleData(u) { await save(u, 'cycle', { ...EMPTY.cycle }); const p = await store.get(u, 'profile'); delete p.simPeriods; await save(u, 'profile', p); return { ok: true }; }

  // ---------------- Profile, devices, privacy, plan ----------------
  async function profileHub(u) {
    const data = await load(u);
    const t = today();
    return {
      profile: data.profile, devices: data.devices, cycleEnabled: data.cycle.enabled, labsCount: (data.labs.results || []).length,
      entitlements: entitlements(data.profile), pricing: PRICING,
      trialDaysLeft: data.profile.subscription?.trialEnd ? Math.max(0, daysBetween(t, data.profile.subscription.trialEnd)) : null,
      reminders: data.reminders || [], memberSince: data.profile.createdAt,
    };
  }
  async function saveProfile(u, patch) {
    const p = await store.get(u, 'profile');
    const allowed = ['setupSkipped', 'name', 'dob', 'sex', 'heightCm', 'weightKg', 'units', 'theme', 'usualMeals', 'allergies', 'diet', 'sleepNeedH', 'shiftWork', 'pregnant', 'sourceOverrides', 'hideLockNumbers', 'consents', 'weightGoal'];
    for (const k of allowed) if (k in patch) p[k] = patch[k];
    if ('bedtime' in patch) p.usualBedMin = clockToMin(patch.bedtime);
    await save(u, 'profile', p);
    return p;
  }
  async function devices(u) {
    const data = await load(u);
    return { devices: data.devices, catalog: DEVICE_CATALOG, providers: wearables.providers(), overrides: data.profile.sourceOverrides || {} };
  }
  async function connectDevice(u, { id, provider = 'simulated' }) {
    const ds = (await store.get(u, 'devices')) || [];
    const res = await wearables.connect({ userId: u, device: id, provider });
    if (res.redirectUrl) return res; // real providers hand back a link for the user to authorize
    const ex = ds.find((d) => d.id === id);
    const hrvBefore = ds.some((d) => d.connected && deviceById(d.id)?.hrv);
    if (ex) Object.assign(ex, { connected: true, provider, connectedAt: today() });
    else ds.push({ id, name: deviceById(id)?.name || id, connected: true, provider, connectedAt: today() });
    await save(u, 'devices', ds);
    return { ok: true, devices: ds, baselineReset: hrvBefore && !!deviceById(id)?.hrv };
  }
  async function disconnectDevice(u, { id }) {
    const ds = ((await store.get(u, 'devices')) || []).map((d) => (d.id === id ? { ...d, connected: false } : d));
    await save(u, 'devices', ds);
    return { ok: true, devices: ds };
  }
  async function exportData(u) {
    const data = await load(u);
    return { exportedAt: now().toISOString(), engineVersion: ENGINE_VERSION, ...data };
  }
  async function deleteAccount(u) {
    for (const k of DOCS) await store.del(u, k);
    cache.delete(u);
    return { ok: true };
  }
  async function subscription(u, { op, billing, plan }) {
    const p = await store.get(u, 'profile');
    const t = today();
    const sub = p.subscription || {};
    // Demo only: in the real app entitlement state comes from RevenueCat, never the client (PRD 12).
    if (op === 'startTrial') Object.assign(sub, { plan: 'trial', billing: billing || 'yearly', trialStart: t, trialEnd: addDays(t, PRICING.trialDays) });
    else if (op === 'choose') Object.assign(sub, { plan: plan || 'plus', billing: billing || sub.billing || 'yearly', since: t });
    else if (op === 'startCancel') { sub.saveOfferShownAt = t; }
    else if (op === 'acceptSave') Object.assign(sub, { plan: 'essentials', billing: billing || 'monthly', since: t });
    else if (op === 'cancel') Object.assign(sub, { plan: 'canceled', canceledAt: t });
    else if (op === 'trialEndingDemo') Object.assign(sub, { plan: 'trial', trialEnd: addDays(t, 2) });
    p.subscription = sub;
    await save(u, 'profile', p);
    return { subscription: sub, entitlements: entitlements(p) };
  }
  async function phoneEstimate(u) {
    const { data, wear } = await ctx(u);
    const c = computeCore(data, wear, today());
    if (!c.night?.estimate) return null;
    return { start: minToClock(c.night.bedStartMin), end: minToClock(c.night.bedEndMin), tstH: c.night.tstH, confirmed: !!c.night.confirmed };
  }
  async function devicesCatalog() { return DEVICE_CATALOG; }
  async function searchFood(u, { q }) { return searchFoods(q, 10).map((f) => ({ id: f.id, name: f.name, kcal: f.kcal, portions: f.portions })); }
  async function baseline(u) {
    const { data, wear } = await ctx(u);
    const c = computeCore(data, wear, today());
    const n = c.base.validNights;
    const start = (data.devices.find((d) => d.connected && deviceById(d.id)?.hrv) || {}).connectedAt;
    return { nights: Math.min(14, n), of: 14, active: c.base.active, unlock: n >= 14 ? null : addDays(today(), 14 - n), hasWearable: c.hasWearable, sleepNights: c.asm.nights.filter((x) => daysBetween(x.date, today()) < 14).length, since: start };
  }

  return {
    bootstrap, completeOnboarding, seedDemoPersona, getToday, checkin, oneThingRespond, oneThingOutcome,
    logMeal, deleteMeal, logWater, logCaffeine, logAlcohol, logSupplement, undoLast, logMenu, analyzeFood, searchFood,
    insights, sleepDetail, recoveryDetail, nutritionDay, genieChat, genieStream, genieAction, flagAnswer, getMemory, updateMemory, geniePacket,
    progress, updateGoals, train, setTrainingGoal, logSet, logWorkout, deleteWorkout, overrideSession, logFitnessTest,
    labs, readLabReport, confirmLabs, cycle, setCycle, logCycleDay, deleteCycleData,
    profileHub, saveProfile, updateSetup, mealPlan, mealPlanAction, adjustMealPlan, deficit, setDeficitGoal, logWeight, devices, devicesCatalog, connectDevice, disconnectDevice, exportData, deleteAccount, subscription, phoneEstimate, baseline,
  };
}

function mealName(m) { return m < 10 * 60 + 30 ? 'Breakfast' : m < 15 * 60 ? 'Lunch' : m < 17 * 60 + 30 ? 'Snack' : 'Dinner'; }

function stubFood(note) {
  const n = (note || '').toLowerCase();
  const h = new Date().getHours();
  if (/salad|caesar/.test(n)) return [{ name: 'Caesar salad with chicken', grams_low: 260, grams_high: 340, confidence: 0.7 }, { name: 'Caesar dressing', grams_low: 20, grams_high: 40, confidence: 0.5 }];
  if (/pizza/.test(n)) return [{ name: 'Pizza, cheese', grams_low: 180, grams_high: 260, confidence: 0.75 }];
  if (/burger/.test(n)) return [{ name: 'Burger, beef, in bun', grams_low: 200, grams_high: 260, confidence: 0.75 }, { name: 'French fries', grams_low: 90, grams_high: 140, confidence: 0.6 }];
  if (h < 11) return [{ name: 'Oatmeal, cooked', grams_low: 200, grams_high: 280, confidence: 0.7 }, { name: 'Banana', grams_low: 90, grams_high: 130, confidence: 0.85 }, { name: 'Almonds', grams_low: 10, grams_high: 25, confidence: 0.6 }];
  return [{ name: 'Grilled chicken breast', grams_low: 110, grams_high: 160, confidence: 0.75 }, { name: 'Brown rice, cooked', grams_low: 130, grams_high: 190, confidence: 0.65 }, { name: 'Broccoli, steamed', grams_low: 70, grams_high: 110, confidence: 0.8 }];
}
