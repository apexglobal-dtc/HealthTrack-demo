import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caloriesBurned, workoutKcal, energyBalance } from '../src/engine/burn.js';

test('full day: resting plus steps plus workout', () => {
  const b = caloriesBurned({ REE: 1500, weightKg: 70, steps: 10000, workouts: [{ type: 'Strength', minutes: 60 }] });
  assert.equal(b.resting, 1500);
  assert.equal(b.movement, 259); // 10,000 x 0.00037 x 70
  assert.equal(b.workouts, 280); // (5 - 1) x 70 x 1 h
  assert.equal(b.total, 1500 + 259 + 280);
  assert.equal(b.partial, false);
});

test('today counts only the part of the day that has passed', () => {
  const b = caloriesBurned({ REE: 1440, weightKg: 70, steps: 0, dayFraction: 0.5 });
  assert.equal(b.resting, 720);
  assert.equal(b.partial, true);
});

test('run steps are not counted twice', () => {
  const run = caloriesBurned({ REE: 0, weightKg: 70, steps: 6000, workouts: [{ type: 'Running', minutes: 30 }] });
  assert.equal(run.movement, Math.round((6000 - 4800) * 0.00037 * 70));
  assert.equal(workoutKcal({ type: 'Running', minutes: 30 }, 70), Math.round(8.8 * 70 * 0.5));
});

test('measured active calories replace the estimate', () => {
  const b = caloriesBurned({ REE: 1500, weightKg: 70, steps: 12000, activeKcal: 600 });
  assert.equal(b.total, 2100);
  assert.equal(b.measured, true);
  assert.equal(b.movement, null);
});

test('net balance', () => {
  assert.equal(energyBalance({ eatenKcal: 1800, burnedKcal: 2100 }), -300);
  assert.equal(energyBalance({ eatenKcal: null, burnedKcal: 2100 }), null);
});
