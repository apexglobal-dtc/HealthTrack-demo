import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service/service.js';
import { memoryStore } from '../src/platform/memoryStore.js';
import { simulatedWearables } from '../src/platform/wearables.js';
import { stubAI } from '../src/platform/ai-stub.js';
import { rdAlerts, applyDietitian, cleanSettings } from '../src/engine/rd.js';

test('dietitian dashboard: roster, member detail, settings flow into the member plan', async () => {
  const svc = createService({ store: memoryStore(), wearables: simulatedWearables(), ai: stubAI() });
  await svc.seedDemoPersona('u1');
  const r = await svc.rdRoster('u1');
  assert.equal(r.members.length, 5);
  assert.ok(r.members.some((m) => m.live));
  assert.ok(r.stats.needAttention >= 1);
  const jordan = r.members.find((m) => m.id === 'm_jordan');
  assert.ok(jordan.alerts.some((a) => a.key === 'fastloss'));
  const priya = r.members.find((m) => m.id === 'm_priya');
  assert.ok(priya.alerts.some((a) => a.key === 'logging'));

  const me = await svc.rdMember('u1', { id: 'me' });
  assert.ok(me.plan.meals.length >= 3);
  const before = me.plan.goal.protein;
  const dinner = me.plan.meals.find((m) => m.slot === 'dinner');
  const saved = await svc.rdSave('u1', { id: 'me', settings: { proteinPerKg: 1.3, avoid: [dinner.recipeId] } });
  assert.equal(saved.settings.proteinPerKg, 1.3);
  assert.notEqual(saved.plan.goal.protein, before);
  assert.notEqual(saved.plan.meals.find((m) => m.slot === 'dinner').recipeId, dinner.recipeId);

  const mp = await svc.mealPlan('u1', {});
  assert.ok(mp.goal.focus[0].byRd, 'member plan shows the dietitian setting');

  await svc.rdMessage('u1', { id: 'me', text: 'Nice work this week.' });
  const mine = await svc.myDietitian('u1');
  assert.equal(mine.messages.at(-1).text, 'Nice work this week.');
  await svc.memberMessage('u1', { text: 'Thanks!' });
  const after = await svc.rdRoster('u1');
  assert.equal(after.members.find((m) => m.id === 'me').unread, 1);

  await svc.rdNote('u1', { id: 'm_priya', text: 'Discussed iron-rich vegetarian swaps.' });
  const p = await svc.rdMember('u1', { id: 'm_priya' });
  assert.equal(p.notes.at(-1).text, 'Discussed iron-rich vegetarian swaps.');
});

test('alert rules and settings', () => {
  const a = rdAlerts({ logDays7: 2, weightKg: 80, weeklyLossKg: 1.2, proteinAvg: 60, proteinTarget: 100, labs: [{ key: 'ferritin', name: 'Ferritin', value: 15, unit: 'ng/mL', status: 'Worth a look' }] });
  assert.deepEqual(a.map((x) => x.key).sort(), ['fastloss', 'lab_ferritin', 'logging', 'protein']);
  assert.deepEqual(cleanSettings({ proteinPerKg: 5, kcalFloor: 1450, pace: 'nope' }), { kcalFloor: 1450 });
  const g = applyDietitian({ kcal: 1300, protein: 80, fat: 40, carbs: 150, fiber: 18, focus: [] }, { settings: { kcalFloor: 1500, proteinPerKg: 1.5 } }, { weightKg: 70 });
  assert.equal(g.kcal, 1500);
  assert.equal(g.protein, 105);
});
