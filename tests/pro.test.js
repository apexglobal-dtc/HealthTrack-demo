import test from 'node:test';
import assert from 'node:assert/strict';
import { createService } from '../src/service/service.js';
import { memoryStore } from '../src/platform/memoryStore.js';
import { simulatedWearables } from '../src/platform/wearables.js';
import { stubAI } from '../src/platform/ai-stub.js';
import { coachAlerts, suggestSession, cleanShare, employerProgram } from '../src/engine/pro.js';

test('care team: opt in with a code, choose what to share, stop sharing', async () => {
  const svc = createService({ store: memoryStore(), wearables: simulatedWearables(), ai: stubAI() });
  await svc.seedDemoPersona('u1');
  let team = await svc.careTeam('u1');
  assert.ok(team.roles.find((r) => r.id === 'dietitian').link.active);
  assert.equal(team.roles.find((r) => r.id === 'coach').link, null);

  await assert.rejects(svc.careLookup('u1', { code: 'nope' }));
  const look = await svc.careLookup('u1', { code: 'coach-2048' });
  assert.equal(look.id, 'coach');
  const before = await svc.coachRoster('u1');
  assert.ok(!before.athletes.some((a) => a.live));
  await svc.careConnect('u1', { role: 'coach', share: { activity: true, labs: true } });
  const after = await svc.coachRoster('u1');
  const me = after.athletes.find((a) => a.live);
  assert.ok(me && me.readiness != null);
  assert.deepEqual(me.notShared.includes('labs'), true, 'coach cannot receive labs even if asked');

  await svc.coachSet('u1', { id: 'me', session: 'lighter' });
  team = await svc.careTeam('u1');
  assert.equal(team.roles.find((r) => r.id === 'coach').session.label, 'Lighter');

  // dietitian: turn food off, then stop sharing
  await svc.careConnect('u1', { role: 'dietitian', share: { food: false, body: true, activity: true, labs: true } });
  const rdMe = await svc.rdMember('u1', { id: 'me' });
  assert.equal(rdMe.kcalAvg, null);
  await svc.careStop('u1', { role: 'dietitian' });
  const r = await svc.rdRoster('u1');
  assert.equal(r.members.length, 4);
  await assert.rejects(svc.rdMember('u1', { id: 'me' }), /stopped sharing/);

  // provider referral to the dietitian comes back to the member to accept
  await svc.careConnect('u1', { role: 'provider' });
  const pr = await svc.providerRoster('u1');
  assert.ok(pr.patients.some((p) => p.live));
  await svc.providerAct('u1', { id: 'me', op: 'refer', text: 'Help with LDL' });
  team = await svc.careTeam('u1');
  assert.equal(team.referrals.length, 1);
  await svc.careConnect('u1', { role: 'dietitian' });
  team = await svc.careTeam('u1');
  assert.equal(team.referrals.length, 0);
  assert.equal((await svc.rdRoster('u1')).members.length, 5);

  // employer sees group totals only
  const e = await svc.employerDash('u1');
  assert.ok(e.depts.find((d) => d.name === 'Leadership').hidden, 'groups under 10 are hidden');
  assert.ok(!JSON.stringify(e).includes('"name":"Maya"'));
});

test('coach rules and sharing limits', () => {
  assert.deepEqual(coachAlerts({ acwr: 1.6, readiness: 48, sleepH: 6, checkins7: 2 }).map((a) => a.key), ['load', 'ready', 'sleep', 'checkin']);
  assert.equal(suggestSession({ readiness: 45 }), 'rest');
  assert.equal(suggestSession({ readiness: 80, acwr: 1.6 }), 'lighter');
  assert.equal(suggestSession({ readiness: 80, acwr: 1.1 }), 'push');
  assert.deepEqual(cleanShare('employer', { food: true, activity: true, labs: true, cycle: true }), { food: false, body: false, activity: true, labs: false, cycle: false });
  assert.equal(employerProgram(false).depts.length, 5);
});
