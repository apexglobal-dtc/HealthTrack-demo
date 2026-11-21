import test from 'node:test';
import assert from 'node:assert/strict';
import { deficitPlan, deficitSafety, weekSummary, projection, dayDeficit } from '../src/engine/deficit.js';
import { energyNeed } from '../src/engine/wellness.js';

test('deficit plan: Mifflin-St Jeor x activity, 10/15/20% pace', () => {
  // 80 kg, 180 cm, 35-year-old man: BMR = 800 + 1125 - 175 + 5 = 1755
  const p = deficitPlan({ REE: 1755, AF: 1.55, sex: 'male', weightKg: 80, pace: 'steady' });
  assert.equal(p.tdee, 2720);
  assert.equal(p.target, 2312);
  assert.equal(p.daily, 408);
  assert.ok(p.weeklyKg > 0.35 && p.weeklyKg < 0.4);
});

test('deficit never goes below the floor or past 20%', () => {
  const small = deficitPlan({ REE: 1150, AF: 1.2, sex: 'female', weightKg: 52, pace: 'faster' });
  assert.equal(small.target, 1200);
  assert.equal(small.limitedBy, 'floor');
  const fake = deficitPlan({ REE: 2000, AF: 1.5, sex: 'male', weightKg: 100, pace: 'nonsense' });
  assert.equal(fake.pct, 0.1);
});

test('weekly loss is capped at 1% of body weight', () => {
  const p = deficitPlan({ REE: 2600, AF: 1.9, sex: 'male', weightKg: 50, pace: 'faster' });
  assert.equal(p.limitedBy, 'pace');
  assert.ok(p.weeklyKg <= 0.5);
});

test('safety switches', () => {
  assert.ok(deficitSafety({ profile: { edFlag: true }, age: 30 }).hidden);
  assert.ok(deficitSafety({ profile: { pregnant: true, edScreenPassed: true }, age: 30 }).paused);
  assert.ok(deficitSafety({ profile: { edScreenPassed: true }, age: 16 }).paused);
  assert.ok(deficitSafety({ profile: { edScreenPassed: true }, age: 30, lifeStage: 'postpartum' }).paused);
  assert.equal(deficitSafety({ profile: { edScreenPassed: true }, age: 30 }), null);
});

test('only fully logged days count toward the week', () => {
  const w = weekSummary([{ tdee: 2500, kcal: 2000, complete: true }, { tdee: 2500, kcal: 600, complete: false }, { tdee: 2500, kcal: 2300, complete: true }]);
  assert.equal(w.loggedDays, 2);
  assert.equal(w.totalDeficit, 700);
  assert.deepEqual(dayDeficit({ tdee: 2500, kcalLow: 1800, kcalHigh: 2000 }), { low: 500, high: 700, mid: 600 });
  assert.equal(projection({ weightKg: 80, targetKg: 75, daily: 550, today: '2026-11-21' }).weeks, 10);
});

test('energy need uses the chosen pace and pauses for pregnancy', () => {
  const base = { dob: '1990-01-01', sex: 'female', weightKg: 70, heightCm: 165, weightGoal: 'lose', deficitPace: 'faster', edScreenPassed: true };
  const lose = energyNeed(base, '2026-11-21', 9000, 100);
  assert.ok(Math.abs(lose.need - lose.tdee * 0.8) <= 1);
  const preg = energyNeed({ ...base, pregnant: true }, '2026-11-21', 9000, 100);
  assert.equal(preg.need, preg.tdee);
});
