import test from 'node:test';
import assert from 'node:assert/strict';
import { durationScore, checkinScore, fuse, readiness, bandFor, nutritionScore } from '../src/engine/wellness.js';
import { predict } from '../src/engine/cycle.js';
import { e1rm, nextLoad } from '../src/engine/fitness.js';
import { parseLabText, SAMPLE_LAB_TEXT } from '../src/engine/foundation.js';
import { redFlag, postCheck } from '../src/engine/genie.js';

test('workbook worked example: Wellness Status 71 Steady, Readiness 70', () => {
  const D = durationScore(6.6, 7.75);
  assert.equal(D, 83.75);
  const sleep = 0.5 * D + 0.25 * 50 + 0.25 * 85; // Q = 50 (rating 3), R = 85 (dev 45)
  assert.equal(Math.round(sleep * 10) / 10, 75.6);
  const chk = checkinScore({ energy: 3, soreness: 3, stress: 4 });
  assert.equal(Math.round(chk * 10) / 10, 41.7);
  const recovery = 0.4 * 54 + 0.3 * 62 + 0.3 * chk;
  assert.equal(Math.round(recovery * 10) / 10, 52.7);
  const f = fuse({
    sleep: { score: sleep }, recovery: { score: recovery }, activity: { score: 82 },
    nutrition: { score: 90.2, cov: 2 / 3 }, hydration: { score: 58.2 }, illness: false, wearable: true, tstH: 6.6, z: -0.8, delta: 3,
  });
  assert.equal(f.TW, 0.95);
  assert.equal(f.RAW, 70.6);
  assert.equal(f.WS, 71);
  assert.equal(bandFor(f.WS).name, 'Steady');
  assert.equal(readiness({ score: sleep }, { score: recovery }, 100), 70);
});

test('safety caps', () => {
  const f = fuse({ sleep: { score: 90 }, recovery: { score: 90 }, activity: null, nutrition: null, hydration: null, illness: true, wearable: true });
  assert.equal(f.WS, 49);
  const g = fuse({ sleep: { score: 90 }, recovery: { score: 90 }, activity: null, nutrition: null, hydration: null, illness: false, wearable: true, tstH: 3.5 });
  assert.equal(g.WS, 59);
});

test('eligibility needs sleep or recovery and weight >= 0.5', () => {
  const f = fuse({ sleep: null, recovery: null, activity: { score: 80 }, nutrition: { score: 80, cov: 1 }, hydration: { score: 80 } });
  assert.equal(f.WS, null);
});

test('nutrition never rewards undereating', () => {
  const n = nutritionScore({ profile: { weightKg: 60, usualMeals: 3 }, meals: [1, 2, 3].map(() => ({ confirmed: true, kcal: 300, protein: 25, fiber: 8 })), caffeine: [], alcohol: 0, need: 2000, bedtimeMin: 1380 });
  assert.ok(n.E <= 40);
});

test('cycle prediction median and window', () => {
  const p = predict({ periods: [{ start: '2026-07-01' }, { start: '2026-07-29' }, { start: '2026-08-27' }, { start: '2026-09-25' }] }, '2026-10-05');
  assert.equal(p.Lhat, 29);
  assert.equal(p.next, '2026-10-24');
  assert.equal(p.CD, 11);
});

test('e1RM and 2-for-2 progression', () => {
  assert.equal(Math.round(e1rm(100, 5, 2) * 10) / 10, 123.3);
  const sets = [
    { date: '2026-11-01', exercise: 'bench', load: 60, reps: 12, rir: 1 },
    { date: '2026-11-04', exercise: 'bench', load: 60, reps: 12, rir: 1 },
  ];
  assert.equal(nextLoad('bench', sets).change, 'up');
});

test('lab text parser', () => {
  const r = parseLabText(SAMPLE_LAB_TEXT);
  const by = Object.fromEntries(r.markers.map((m) => [m.key, m.value]));
  assert.equal(r.testDate, '2026-10-02');
  assert.deepEqual(by, { hba1c: 5.4, glucose: 92, apob: 88, ldl: 112, hdl: 58, tg: 96, crp: 1.4, ferritin: 31, vitd: 27 });
});

test('genie red flags and post-check', () => {
  assert.equal(redFlag('I have chest pain when I run'), 'chest');
  assert.equal(redFlag('should I lift today?'), null);
  assert.equal(postCheck('Readiness is 70 today', { readiness: 70 }).ok, true);
  assert.equal(postCheck('Your HRV is 87 ms', { readiness: 70 }).ok, false);
});
