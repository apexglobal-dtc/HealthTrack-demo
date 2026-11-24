import test from 'node:test';
import assert from 'node:assert/strict';
import { trendWeights, rhoForWeek, observedTdee, learnedMaintenance, projectCurve, projectionRange, plateauCheck } from '../src/engine/weightloss.js';
import { stressBaseline, stressReading, stressDay, stressBand, stressAlert } from '../src/engine/stress.js';
import { sleepPressure, energyDay, energyBand } from '../src/engine/energy.js';
import { addDays } from '../src/engine/util.js';
import { createService } from '../src/service/service.js';
import { memoryStore } from '../src/platform/memoryStore.js';
import { simulatedWearables } from '../src/platform/wearables.js';
import { stubAI } from '../src/platform/ai-stub.js';

test('F5 v2: trend weight smooths water swings', () => {
  const tr = trendWeights([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-02', kg: 81 }, { date: '2026-11-03', kg: 79 }]);
  assert.equal(tr[1].trend, 80.1);
  assert.equal(tr[2].trend, 79.99);
  // a 3-day gap moves the trend as three daily steps would
  const gap = trendWeights([{ date: '2026-11-01', kg: 80 }, { date: '2026-11-04', kg: 70 }]);
  assert.equal(gap[1].trend, 77.29);
});

test('F5 v2: energy per kg rises from 4,860 to 6,570 kcal', () => {
  assert.equal(rhoForWeek(1), 4860);
  assert.equal(rhoForWeek(14), 5715);
  assert.equal(rhoForWeek(30), 6570);
});

test('F5 v2: learned maintenance = intake + energy from lost weight', () => {
  const end = '2026-11-28';
  const days = [], log = [];
  for (let i = 27; i >= 0; i--) {
    const d = addDays(end, -i);
    days.push({ date: d, kcal: 1800, complete: true });
    log.push({ date: d, kg: 80 - (27 - i) * 0.03 }); // steady 0.21 kg a week
  }
  const tr = trendWeights(log);
  const o = observedTdee({ days, trend: tr, end, weekOfDiet: 1 });
  assert.ok(o.ok);
  assert.ok(o.tdee > 1800 && o.tdee < 2000, `got ${o.tdee}`);
  // too few complete days: not learned
  const few = observedTdee({ days: days.map((d, i) => ({ ...d, complete: i < 5 })), trend: tr, end });
  assert.equal(few.ok, false);
  // weekly steps never move more than 150 kcal from the formula start
  const lm = learnedMaintenance({ formulaTdee: 2600, days, log, today: addDays(end, 1) });
  assert.ok(lm.learned);
  assert.ok(lm.tdee >= 2600 - 4 * 150);
  for (let i = 1; i < lm.steps.length; i++) assert.ok(Math.abs(lm.steps[i].value - lm.steps[i - 1].value) <= 150);
});

test('F5 v2: projection curves and flattens', () => {
  const c = projectCurve({ weightKg: 90, intake: 2000, tdee: 2600, tdeePerKg: 15 });
  const wk = (n) => c.points[n].kg;
  assert.ok(wk(0) - wk(4) > wk(20) - wk(24), 'loss slows over time');
  assert.ok(c.floorKg > 50, 'levels out where maintenance meets intake');
  const r = projectionRange({ weightKg: 90, targetKg: 85, intake: 2000, tdee: 2600, AF: 1.5, today: '2026-11-24' });
  assert.ok(r.reachable && r.weeksSlow > r.weeksFast);
  // never faster than 1% a week
  const fast = projectCurve({ weightKg: 60, intake: 800, tdee: 2600, tdeePerKg: 15 });
  assert.ok(60 - fast.points[1].kg <= 0.6 + 1e-9);
});

test('F5 v2: plateau needs good logging and a flat trend', () => {
  const today = '2026-11-24';
  const days = [], log = [];
  for (let i = 30; i >= 1; i--) { const d = addDays(today, -i); days.push({ date: d, kcal: 1700, complete: true }); log.push({ date: d, kg: 75 + (i % 2 ? 0.3 : -0.3) }); }
  const p = plateauCheck({ trend: trendWeights(log), days, today, losing: true });
  assert.ok(p.plateau);
  const notLogged = plateauCheck({ trend: trendWeights(log), days: days.map((d, i) => ({ ...d, complete: i % 2 === 0 })), today, losing: true });
  assert.equal(notLogged.plateau, false);
});

test('F9 stress: formula, bands, skipped readings, check-in fallback', () => {
  const base = { active: true, rhr: 60, lnMean: Math.log(40), lnSd: 0.2 };
  const calm = Array.from({ length: 8 }, () => ({ hr: 63, hrv: 44 }));
  const tense = Array.from({ length: 8 }, () => ({ hr: 90, hrv: 26 }));
  assert.ok(stressReading(calm, base, 190).value <= 25);
  const t = stressReading(tense, base, 190);
  assert.ok(t.value > 75, `got ${t.value}`);
  // heart rate only: 80 x HR part
  assert.equal(stressReading(Array.from({ length: 6 }, () => ({ hr: 60 + 0.3 * 130 })), base, 190).value, 80);
  assert.ok(stressReading(calm.slice(0, 5), base, 190).skipped, 'under 30 still minutes');
  assert.equal(stressBand(50).name, 'Low');
  const day = stressDay({ date: 'd', daytime: [], base, hrMax: 190, checkin: { stress: 4 }, isToday: true, nowMin: 10 * 60 });
  assert.equal(day.am.value, 75);
  assert.ok(day.pm.pending, '3 PM reading waits until 3 PM');
  assert.ok(stressAlert([{ day: 80 }, { day: 77 }, { day: 90 }]));
  assert.equal(stressAlert([{ day: 80 }, { day: 60 }, { day: 90 }]), null);
});

test('F10 energy: two-process model, worked example', () => {
  const nights = [];
  for (let i = 20; i >= 0; i--) nights.push({ date: addDays('2026-11-24', -i), tstH: 7.5, bedEndMin: 7 * 60 });
  const sp = sleepPressure({ nights, date: '2026-11-24', wakeMin: 7 * 60, bedMin: 23 * 60 });
  const e = energyDay({ S_wake: sp.S_wake, recovery: 70, wakeMin: 7 * 60, bedMin: 23 * 60, nowMin: 21 * 60, stress: { am: { value: 20 }, pm: { value: 20 } }, workouts: [] });
  assert.ok(e.atWake >= 74 && e.atWake <= 80, `wake ${e.atWake}`);
  assert.ok(e.curve[0].v > e.curve[e.curve.length - 1].v, 'falls through the day');
  const stressed = energyDay({ S_wake: sp.S_wake, recovery: 70, wakeMin: 7 * 60, bedMin: 23 * 60, nowMin: 21 * 60, stress: { am: { value: 65 }, pm: { value: 65 } }, workouts: [{ startMin: 18 * 60, minutes: 30, type: 'Running' }] });
  assert.ok(stressed.now < e.now - 10);
  assert.equal(energyBand(80).name, 'Charged');
  assert.equal(energyBand(20).name, 'Low');
});

test('service: demo persona has energy, two stress readings and learned maintenance', async () => {
  const now = () => { const d = new Date('2026-11-24T16:20:00'); return d; };
  const svc = createService({ store: memoryStore(), wearables: simulatedWearables(), ai: stubAI(), now });
  await svc.seedDemoPersona('u1');
  const es = await svc.energyStress('u1');
  assert.ok(es.energy.now >= 5 && es.energy.now <= 100);
  assert.ok(es.stress.am.value != null && es.stress.pm.value != null);
  assert.equal(es.series.length, 14);
  const t = await svc.getToday('u1');
  assert.equal(t.energy.now, es.energy.now);
  const d = await svc.deficit('u1');
  assert.ok(d.v2.learned);
  assert.ok(Math.abs(d.v2.maintenance - d.plan.tdee) < 400);
  assert.ok(d.v2.trend.length > 20);
  // starting a deficit uses the learned maintenance and protein 1.6 g/kg
  const on = await svc.setDeficitGoal('u1', { enabled: true, pace: 'gentle', targetKg: 60 });
  assert.equal(on.eff.tdee, on.v2.maintenance);
  assert.equal(on.v2.proteinGPerKg, 1.6);
  assert.ok(on.v2.mine.range.reachable);
  const g = await svc.geniePacket('u1');
  assert.ok(g.energyNow != null);
});
