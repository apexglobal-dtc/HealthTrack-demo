import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service/service.js';
import { memoryStore } from '../src/platform/memoryStore.js';
import { simulatedWearables } from '../src/platform/wearables.js';
import { stubAI } from '../src/platform/ai-stub.js';

test('demo persona end to end', async () => {
  const svc = createService({ store: memoryStore(), wearables: simulatedWearables(), ai: stubAI() });
  await svc.seedDemoPersona('u1');
  const t = await svc.getToday('u1');
  assert.ok(t.status >= 0 && t.status <= 100, 'status');
  assert.ok(t.oneThing?.title, 'one thing');
  const ins = await svc.insights('u1');
  assert.equal(ins.tiles.length, 7);
  const pr = await svc.progress('u1');
  assert.ok(pr.cells.length > 70);
  const tr = await svc.train('u1');
  assert.ok(tr.fitness.FS >= 0);
  const cy = await svc.cycle('u1');
  assert.ok(cy.pred.next);
  const lb = await svc.labs('u1');
  assert.ok(lb.score > 0);
  const g = await svc.genieChat('u1', { text: 'Should I still lift today?' });
  assert.ok(g.reply.text.length > 10);
  const s = await svc.genieChat('u1', { text: 'I have chest pain' });
  assert.ok(s.reply.safety);
  const food = await svc.analyzeFood('u1', { note: 'pizza' });
  assert.ok(food.items.length && food.totals.kcalLow < food.totals.kcalHigh);
  console.log(JSON.stringify({ status: t.status, band: t.band?.name, conf: t.confidence, ready: t.readiness, pillars: t.pillars, one: t.oneThing.title, why: t.oneThing.why, reason: t.reason, keep: t.keepDoing, session: t.session.title, verdict: t.session.verdict?.verdict, fs: tr.fitness.FS, cyc: cy.phase, labs: lb.score, genie: g.reply.text }, null, 1));
});

test('new phone-only user gets a status from a check-in', async () => {
  const svc = createService({ store: memoryStore(), wearables: simulatedWearables(), ai: stubAI() });
  await svc.completeOnboarding('u2', { name: 'Sam', sex: 'male', devices: [], checkin: { energy: 4, soreness: 2, stress: 2, sleepHours: 7, sleepQuality: 4 } });
  const t = await svc.getToday('u2');
  assert.ok(t.status != null, 'status from check-in');
  assert.equal(t.confidence, 'Low');
});
