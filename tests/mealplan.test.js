import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, nutritionGoal, buildDay, groceryList, parseRequest, fitsPerson } from '../src/engine/mealplan.js';
import { mealTotals } from '../src/engine/foods.js';

const profile = { weightKg: 70, goals: ['Build strength'], allergies: ['Peanuts', 'Tree nuts'], diet: 'vegetarian' };

test('every recipe uses foods from the database', () => {
  assert.ok(RECIPES.length >= 25);
  for (const r of RECIPES) assert.ok(r.base.kcal > 50, r.id);
});

test('goal follows the master goal, training and labs', () => {
  const g = nutritionGoal({ profile, en: { need: 2200 }, trainingToday: true, trainingCode: 'push', labs: [{ key: 'ferritin', low: true }] });
  assert.equal(g.protein, Math.round(1.8 * 70));
  assert.ok(g.focus.some((f) => f.tag === 'iron'));
  assert.ok(g.focus.some((f) => f.tag === 'carbs'));
  assert.equal(Math.round(g.protein * 4 + g.carbs * 4 + g.fat * 9 - g.kcal) <= 4, true);
});

test('plan respects diet and allergies, and numbers come from grams', () => {
  const g = nutritionGoal({ profile, en: { need: 2200 } });
  const day = buildDay({ date: '2026-11-21', goal: g, profile });
  for (const m of day.meals) {
    const r = RECIPES.find((x) => x.id === m.recipeId);
    assert.ok(fitsPerson(r, profile), m.name);
    assert.ok(!m.allergens.includes('peanuts') && !m.allergens.includes('tree nuts'));
    assert.deepEqual(m.totals, mealTotals(m.items));
  }
});

test('eating out shrinks the other meals; grocery adds up', () => {
  const g = nutritionGoal({ profile: { weightKg: 70 }, en: { need: 2000 } });
  const base = buildDay({ date: '2026-11-21', goal: g, profile: {} });
  const out = buildDay({ date: '2026-11-21', goal: g, profile: {}, override: parseRequest("I'm eating out tonight", base, {}).override });
  assert.ok(out.meals.find((m) => m.slot === 'dinner').out);
  assert.ok(out.meals.find((m) => m.slot === 'lunch').budget < base.meals.find((m) => m.slot === 'lunch').budget);
  const gl = groceryList([base]);
  const total = gl.flatMap((a) => a.items).length;
  assert.ok(total > 5);
});
