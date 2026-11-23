// Registered dietitian (RD) dashboard: alert rules, dietitian settings on a member's plan,
// and the sample members used in the demo. Health Track 1.0 "Plus + Dietitian".

const round = (x, d = 0) => { const f = 10 ** d; return Math.round(x * f) / f; };

export const DIETITIAN = { id: 'rd_demo', name: 'Dana Lee', credentials: 'RDN, LD', initials: 'DL' };

// Settings a dietitian can set on a member's plan. All optional.
//   proteinPerKg  0.8 to 2.2 g/kg, replaces the app's protein rule
//   kcalFloor     1,000 to 3,000 kcal, the plan never goes below it
//   pace          'gentle' | 'steady' | 'faster' (calorie deficit pace)
//   avoid         recipe ids the plan should not offer
export function cleanSettings(s = {}) {
  const out = {};
  const ppk = Number(s.proteinPerKg);
  if (s.proteinPerKg != null && s.proteinPerKg !== '' && ppk >= 0.8 && ppk <= 2.2) out.proteinPerKg = round(ppk, 1);
  const fl = Number(s.kcalFloor);
  if (s.kcalFloor != null && s.kcalFloor !== '' && fl >= 1000 && fl <= 3000) out.kcalFloor = Math.round(fl / 10) * 10;
  if (['gentle', 'steady', 'faster'].includes(s.pace)) out.pace = s.pace;
  if (Array.isArray(s.avoid)) out.avoid = [...new Set(s.avoid.filter((x) => typeof x === 'string'))].slice(0, 30);
  return out;
}

// Apply the dietitian's settings to the app's daily nutrition goal. The dietitian wins over the app's rules.
export function applyDietitian(goal, rd, profile) {
  if (!rd || !rd.settings) return goal;
  const s = rd.settings;
  const kg = profile?.weightKg || 70;
  const g = { ...goal, focus: [...goal.focus], setBy: [] };
  const who = rd.dietitian?.name || 'your dietitian';
  if (s.kcalFloor && g.kcal < s.kcalFloor) {
    g.kcal = s.kcalFloor;
    g.fat = Math.round((0.28 * g.kcal) / 9);
    g.fiber = Math.round((14 * g.kcal) / 1000);
    g.setBy.push('kcal');
  }
  if (s.proteinPerKg) {
    g.proteinPerKg = s.proteinPerKg;
    g.protein = Math.round(s.proteinPerKg * kg);
    g.setBy.push('protein');
    g.focus = g.focus.filter((f) => f.tag !== 'protein');
    g.focus.unshift({ tag: 'protein', why: `${who} set your protein to ${s.proteinPerKg} g per kg.`, byRd: true });
  }
  g.carbs = Math.max(0, Math.round((g.kcal - g.protein * 4 - g.fat * 9) / 4));
  if (s.kcalFloor && g.setBy.includes('kcal')) g.focus.unshift({ tag: 'floor', why: `${who} set a minimum of ${s.kcalFloor.toLocaleString()} kcal a day.`, byRd: true });
  return g;
}

// Alerts on the dietitian's member list. Each rule is simple and explainable.
export function rdAlerts(m) {
  const a = [];
  if (m.logDays7 != null && m.logDays7 < 4) a.push({ level: 'warn', key: 'logging', text: `Logged food on ${m.logDays7} of the last 7 days` });
  if (m.weeklyLossKg != null && m.weightKg && m.weeklyLossKg > 0.01 * m.weightKg) a.push({ level: 'warn', key: 'fastloss', text: `Lost ${m.weeklyLossKg} kg last week, more than 1% of body weight` });
  if (m.proteinAvg != null && m.proteinTarget && m.proteinAvg < 0.8 * m.proteinTarget) a.push({ level: 'info', key: 'protein', text: `Protein averaging ${m.proteinAvg} g of ${m.proteinTarget} g` });
  if (m.kcalAvg != null && m.kcalFloor && m.kcalAvg < m.kcalFloor) a.push({ level: 'warn', key: 'floor', text: `Eating below the ${m.kcalFloor.toLocaleString()} kcal floor on average` });
  if (m.fiberAvg != null && m.fiberTarget && m.fiberAvg < 0.6 * m.fiberTarget) a.push({ level: 'info', key: 'fiber', text: `Fiber averaging ${m.fiberAvg} g of ${m.fiberTarget} g` });
  for (const l of m.labs || []) if (l.status !== 'Optimal' && l.status !== 'In range') a.push({ level: 'info', key: `lab_${l.key}`, text: `${l.name} ${l.value} ${l.unit} is outside the optimal range` });
  if (m.sleepAvg != null && m.sleepAvg < 6.5) a.push({ level: 'info', key: 'sleep', text: `Sleeping ${m.sleepAvg} h a night on average` });
  if (m.unread) a.push({ level: 'msg', key: 'msg', text: `${m.unread} new message${m.unread > 1 ? 's' : ''}` });
  return a;
}

// ---------------- sample members (demo only) ----------------
function series(n, f) { return Array.from({ length: n }, (_, i) => f(i)); }
function wave(i, seed, amp) { return Math.sin(i * 1.7 + seed) * amp; }

export function sampleMembers(today, addDays) {
  const days7 = series(7, (i) => addDays(today, i - 7));
  const weeks8 = series(8, (i) => addDays(today, (i - 7) * 7));
  const mk = (m) => ({
    ...m,
    weightTrend: weeks8.map((d, i) => ({ date: d, kg: round(m.w0 + (m.w1 - m.w0) * (i / 7) + (i === 7 ? -(m.lastDrop || 0) : 0), 1) })),
    days: days7.map((d, i) => ({ date: d, kcal: m.logged.includes(i) ? Math.round(m.kcalAvg + wave(i, m.seed, 160)) : null, burned: Math.round(m.burnAvg + wave(i, m.seed + 1, 180)), protein: m.logged.includes(i) ? Math.round(m.proteinAvg + wave(i, m.seed + 2, 12)) : null })),
  });
  return [
    mk({ id: 'm_jordan', name: 'Jordan Ellis', age: 34, sex: 'male', heightCm: 182, w0: 96.2, w1: 92.6, lastDrop: 1.4, targetKg: 85, goals: ['Lose weight'], weightGoal: 'lose', diet: 'none', allergies: [], since: addDays(today, -56), lastVisit: addDays(today, -13), nextVisit: addDays(today, 2), seed: 1,
      logged: [0, 1, 2, 3, 4, 6], kcalAvg: 1820, kcalTarget: 2050, burnAvg: 2620, proteinAvg: 118, proteinTarget: 134, fiberAvg: 27, fiberTarget: 29, sleepAvg: 6.9, stepsAvg: 7800,
      labs: [{ key: 'ldl', name: 'LDL cholesterol', value: 142, unit: 'mg/dL', status: 'Worth a look' }, { key: 'hba1c', name: 'HbA1c', value: 5.3, unit: '%', status: 'Optimal' }],
      messages: [{ from: 'member', text: 'Down another kilo this week! Is it OK that I skip the snack on rest days?', at: addDays(today, -1) + 'T19:40' }] }),
    mk({ id: 'm_priya', name: 'Priya Shah', age: 27, sex: 'female', heightCm: 163, w0: 58.4, w1: 58.1, targetKg: null, goals: ['Build strength'], weightGoal: 'maintain', diet: 'vegetarian', allergies: ['peanuts'], since: addDays(today, -20), lastVisit: addDays(today, -20), nextVisit: addDays(today, 8), seed: 2,
      logged: [1, 4, 5], kcalAvg: 1650, kcalTarget: 2150, burnAvg: 2280, proteinAvg: 62, proteinTarget: 93, fiberAvg: 24, fiberTarget: 30, sleepAvg: 7.4, stepsAvg: 9400,
      labs: [{ key: 'ferritin', name: 'Ferritin', value: 18, unit: 'ng/mL', status: 'Worth a look' }, { key: 'vitd', name: 'Vitamin D', value: 41, unit: 'ng/mL', status: 'Optimal' }],
      messages: [] }),
    mk({ id: 'm_marcus', name: 'Marcus Bell', age: 45, sex: 'male', heightCm: 177, w0: 88.0, w1: 87.4, targetKg: null, goals: ['Eat better'], weightGoal: 'maintain', diet: 'pescatarian', allergies: [], since: addDays(today, -90), lastVisit: addDays(today, -27), nextVisit: addDays(today, 3), seed: 3,
      logged: [0, 1, 2, 3, 4, 5, 6], kcalAvg: 2380, kcalTarget: 2450, burnAvg: 2500, proteinAvg: 104, proteinTarget: 105, fiberAvg: 18, fiberTarget: 34, sleepAvg: 6.2, stepsAvg: 6100,
      labs: [{ key: 'hba1c', name: 'HbA1c', value: 5.9, unit: '%', status: 'Worth a look' }, { key: 'tg', name: 'Triglycerides', value: 168, unit: 'mg/dL', status: 'Worth a look' }],
      messages: [] }),
    mk({ id: 'm_sofia', name: 'Sofia Romero', age: 31, sex: 'female', heightCm: 168, w0: 74.0, w1: 71.2, lastDrop: 0.5, targetKg: 66, goals: ['Lose weight', 'More energy'], weightGoal: 'lose', diet: 'none', allergies: ['shellfish'], since: addDays(today, -49), lastVisit: addDays(today, -6), nextVisit: addDays(today, 22), seed: 4,
      logged: [0, 1, 3, 4, 5], kcalAvg: 1560, kcalTarget: 1620, burnAvg: 2140, proteinAvg: 104, proteinTarget: 104, fiberAvg: 26, fiberTarget: 23, sleepAvg: 7.6, stepsAvg: 10200,
      labs: [], messages: [] }),
  ].map((m) => {
    const logged = m.days.filter((d) => d.kcal != null);
    const tr = m.weightTrend;
    return { ...m, weightKg: tr[tr.length - 1].kg, weeklyLossKg: round(tr[tr.length - 2].kg - tr[tr.length - 1].kg, 1), logDays7: logged.length, sample: true };
  });
}
