// Today's plan by category, and the four daily check-ins (6 AM, 12 PM, 5 PM, 9 PM).
// Pure functions: they read what the person logged today and adjust the next advice to it.
import { round, sum, fmtHours } from '../engine/util.js';

export const CHECKIN_TIMES = [
  { id: 'morning', at: 6 * 60, label: '6 AM', name: 'Morning check-in', meal: 'Breakfast' },
  { id: 'midday', at: 12 * 60, label: '12 PM', name: 'Midday check-in', meal: 'Lunch' },
  { id: 'evening', at: 17 * 60, label: '5 PM', name: 'Evening check-in', meal: 'Dinner' },
  { id: 'night', at: 21 * 60, label: '9 PM', name: 'Night check-in', meal: null },
];

const SHARE = { Breakfast: 0.25, Lunch: 0.35, Dinner: 0.3, Snack: 0.1 };
const ALLERGY_TAG = { peanuts: 'peanuts', 'tree nuts': 'tree nuts', dairy: 'milk', gluten: 'gluten', shellfish: 'shellfish', eggs: 'eggs', soy: 'soy', fish: 'fish' };

const BREAKFASTS = [
  { name: 'Greek yogurt with berries and oats', tags: ['vegetarian', 'milk'] },
  { name: 'Two eggs on wholegrain toast with tomatoes', tags: ['vegetarian', 'eggs', 'gluten'] },
  { name: 'Tofu scramble with spinach and toast', tags: ['vegan', 'soy', 'gluten'] },
  { name: 'Oatmeal with banana and peanut butter', tags: ['vegan', 'peanuts'] },
  { name: 'Overnight oats with chia seeds and berries', tags: ['vegan'] },
];
const LUNCHES = [
  { name: 'Chicken and quinoa salad', tags: ['meat'] },
  { name: 'Chickpea and roasted vegetable bowl', tags: ['vegan'] },
  { name: 'Tuna and white bean salad', tags: ['fish'] },
  { name: 'Lentil soup with a wholegrain roll', tags: ['vegan', 'gluten'] },
  { name: 'Turkey and avocado wrap', tags: ['meat', 'gluten'] },
];

function fits(profile, idea) {
  const diet = profile.diet || 'none';
  const t = idea.tags;
  if (diet === 'vegan' && !t.includes('vegan')) return false;
  if (diet === 'vegetarian' && !t.some((x) => x === 'vegan' || x === 'vegetarian')) return false;
  if (diet === 'pescatarian' && t.includes('meat')) return false;
  for (const a of profile.allergies || []) { const tag = ALLERGY_TAG[a.toLowerCase()]; if (tag && t.includes(tag)) return false; }
  return true;
}
function pick(list, profile, date) {
  const ok = list.filter((i) => fits(profile, i));
  const pool = ok.length ? ok : list.filter((i) => i.tags.includes('vegan'));
  return pool[Number(date.slice(8, 10)) % pool.length].name;
}

// '2:30 PM' style, rounded to the half hour
export function clockLabel(min) {
  const m = ((Math.round(min / 30) * 30) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}
const L = (ml) => `${round(ml / 1000, 1)} L`;
const kcalRange = (k) => `${Math.round((k * 0.9) / 10) * 10}-${Math.round((k * 1.1) / 10) * 10} kcal`;

function mealSlot(m) {
  const n = String(m.name || '').toLowerCase();
  for (const s of ['breakfast', 'lunch', 'dinner', 'snack']) if (n.includes(s)) return s[0].toUpperCase() + s.slice(1);
  const x = m.minute ?? 0;
  return x < 10.5 * 60 ? 'Breakfast' : x < 15 * 60 ? 'Lunch' : x < 17.5 * 60 ? 'Snack' : 'Dinner';
}

// Everything the plan and check-ins need, in one place.
export function dayFacts({ date, profile, day, c, session, oneThing, oneThingRecord, dinnerIdea, stepsToday, nextTrain, proteinPerKg }) {
  const meals = (day.meals || []).map((m) => ({ ...m, slot: mealSlot(m) }));
  const kg = profile.weightKg || 70;
  const need = c.en?.need || 2000;
  const proteinGoal = Math.round((proteinPerKg || 1.2) * kg);
  const cutoff = c.bed - 8.8 * 60;
  return {
    date, profile, meals, need, proteinGoal, cutoff, bed: c.bed, sleepNeed: c.N?.N || 7.5,
    water: day.water || [], caffeine: day.caffeine || [], fluid: c.fluid, wt: c.wt,
    night: c.night, readiness: c.ready, session, oneThing, oneThingRecord, dinnerIdea, stepsToday, stepTarget: c.activity?.target || 8000,
    cyclePhase: c.cyc?.phase?.label || null, checkinDone: !!c.checkin, nextTrain,
    breakfastIdea: pick(BREAKFASTS, profile, date), lunchIdea: pick(LUNCHES, profile, date),
    trainingDone: !!session && !session.rest && session.exercises?.length > 0 && session.exercises.every((e) => e.done >= e.sets),
  };
}

const has = (f, slot) => f.meals.some((m) => m.slot === slot);

// ---------------- Today's plan, grouped by category ----------------
export function planByCategory(f) {
  const bk = Math.round(f.need * SHARE.Breakfast), ln = Math.round(f.need * SHARE.Lunch), dn = Math.round(f.need * SHARE.Dinner);
  const pMeal = Math.round(f.proteinGoal * 0.3);
  const cats = [
    {
      id: 'nutrition', name: 'Nutrition', icon: 'leaf', color: 'var(--amber)', tint: 'var(--tint-amber)',
      goal: `About ${Math.round(f.need / 50) * 50} kcal and ${f.proteinGoal} g protein today`,
      items: [
        { when: 'AM', text: `Breakfast: ${f.breakfastIdea}`, sub: `${kcalRange(bk)}, ${pMeal} g protein`, done: has(f, 'Breakfast'), action: { kind: 'photo', meal: 'Breakfast' } },
        { when: 'PM', text: `Lunch: ${f.lunchIdea}`, sub: `${kcalRange(ln)}, ${pMeal} g protein`, done: has(f, 'Lunch'), action: { kind: 'photo', meal: 'Lunch' } },
        { when: 'PM', text: `Dinner: ${f.dinnerIdea}`, sub: `${kcalRange(dn)}, ${pMeal} g protein`, done: has(f, 'Dinner'), action: { kind: 'photo', meal: 'Dinner' } },
      ],
    },
    {
      id: 'hydration', name: 'Hydration', icon: 'drop', color: 'var(--blue)', tint: 'var(--tint-blue)',
      goal: `${L(f.wt)} today, ${L(f.fluid)} so far`,
      items: [
        { when: 'AM', text: 'A glass of water when you wake up', done: f.water.length > 0, action: { kind: 'water' } },
        { when: 'AM', text: `Reach ${L(f.wt * 0.4)} by lunch`, done: f.fluid >= f.wt * 0.4, action: { kind: 'water' } },
        { when: 'PM', text: `Finish your ${L(f.wt)} before the evening`, done: f.fluid >= f.wt, action: { kind: 'water' } },
        { when: 'PM', text: `Last coffee in the early afternoon (around ${clockLabel(f.cutoff)})`, done: false },
      ],
    },
    {
      id: 'fitness', name: 'Fitness', icon: 'pulse', color: 'var(--green)', tint: 'var(--tint-green)',
      goal: `${f.stepTarget.toLocaleString()} steps today${f.stepsToday != null ? `, ${f.stepsToday.toLocaleString()} so far` : ''}`,
      items: [
        { when: 'AM', text: 'Get 10 minutes of daylight and a short walk', done: false },
        { when: 'PM', text: 'A 15-minute walk after lunch', done: false },
        { when: 'PM', text: `Reach ${f.stepTarget.toLocaleString()} steps`, done: f.stepsToday != null && f.stepsToday >= f.stepTarget },
      ],
    },
    {
      id: 'training', name: 'Training', icon: 'dumbbell', color: 'var(--teal)', tint: 'var(--tint-teal)',
      goal: !f.session ? 'No training plan yet' : f.session.rest ? 'Rest day' : `${f.session.title}, ${f.session.minutes} min`,
      items: !f.session
        ? [{ when: 'AM', text: 'Set up a training plan that fits your week', done: false, action: { kind: 'go', to: 'train-setup' } }]
        : f.session.rest
          ? [{ when: 'AM', text: f.session.subtitle || 'Rest day. Recovery is part of training.', done: false }, { when: 'PM', text: '10 minutes of easy mobility', done: false }]
          : [
            { when: 'AM', text: `Check the verdict: ${f.session.verdict.verdict}`, sub: f.session.verdict.note, done: false, action: { kind: 'go', to: 'train' } },
            { when: 'PM', text: `${f.session.title} · ${f.session.minutes} min`, sub: f.session.subtitle, done: f.trainingDone, action: { kind: 'go', to: 'train' } },
            { when: 'PM', text: `Protein within 2 hours after (about ${pMeal} g)`, done: false },
          ],
    },
    {
      id: 'sleep', name: 'Sleep', icon: 'moon', color: 'var(--sleep)', tint: 'var(--tint-violet)',
      goal: `${fmtHours(f.sleepNeed)} of sleep tonight`,
      items: [
        { when: 'PM', text: 'Dim lights and put screens away 30 minutes before bed', done: false },
        { when: 'PM', text: `In bed around ${clockLabel(f.bed)}`, done: false },
      ],
    },
  ];
  if (f.oneThing) {
    const where = { sleep: 'sleep', recovery: 'fitness', activity: 'fitness', nutrition: 'nutrition', hydration: 'hydration' }[f.oneThing.pillar] || 'fitness';
    const cat = cats.find((x) => x.id === where);
    cat.items.unshift({ when: f.oneThing.moment === 'morning' ? 'AM' : 'PM', text: f.oneThing.title, sub: 'Your One Thing', oneThing: true, done: f.oneThingRecord?.outcome === 'done' });
  }
  for (const cat of cats) { cat.done = cat.items.filter((i) => i.done).length; cat.total = cat.items.length; }
  return cats;
}

// ---------------- Four check-ins ----------------
function windowLog(f, from, to) {
  const inW = (m) => m >= from && m < to;
  const meals = f.meals.filter((m) => inW(m.minute ?? 0));
  const water = sum(f.water.filter((w) => inW(w.minute)).map((w) => w.ml));
  const caf = f.caffeine.filter((x) => inW(x.minute));
  const out = [];
  for (const m of meals) out.push({ icon: 'leaf', text: `${m.slot}: ${m.name && !/^(breakfast|lunch|dinner|snack)$/i.test(m.name) ? m.name + ', ' : ''}about ${Math.round(m.kcal || 0)} kcal, ${Math.round(m.protein || 0)} g protein` });
  if (water) out.push({ icon: 'drop', text: `${water} ml of water logged` });
  if (caf.length) out.push({ icon: 'coffee', text: `${caf.length} coffee${caf.length > 1 ? 's' : ''}${caf.some((x) => x.minute > f.cutoff) ? ', one after your cut-off' : ''}` });
  return out;
}

export function buildCheckins(f, nowMin) {
  const eatenBefore = (min) => f.meals.filter((m) => (m.minute ?? 0) < min);
  const kcalBefore = (min) => sum(eatenBefore(min).map((m) => m.kcal || 0));
  const protBefore = (min) => sum(eatenBefore(min).map((m) => m.protein || 0));
  const lateCoffee = f.caffeine.some((x) => x.minute > f.cutoff);
  const sess = f.session;
  const trainLine = !sess ? null : sess.rest ? (sess.subtitle || 'Rest day. A 20-minute walk keeps you moving.') : `${sess.title}, ${sess.minutes} min. ${sess.verdict.verdict}: ${sess.verdict.note}`;
  const pMeal = Math.round(f.proteinGoal * 0.3);
  const cards = [];

  // 6 AM
  {
    const adv = [];
    const tst = f.night?.tstH;
    adv.push({ kind: 'Breakfast', icon: 'leaf', text: `${f.breakfastIdea}. About ${kcalRange(f.need * SHARE.Breakfast)} with ${pMeal} g protein.` });
    adv.push({ kind: 'Hydration', icon: 'drop', text: `Start with a glass of water (250 to 500 ml). Aim for ${L(f.wt * 0.4)} by noon and ${L(f.wt)} today.` });
    if (trainLine) adv.push({ kind: 'Training', icon: 'dumbbell', text: trainLine });
    const other = [];
    if (!f.checkinDone) other.push('Take 20 seconds for your morning check-in. It sharpens today\'s status.');
    other.push(`Keep coffee before about ${clockLabel(f.cutoff)} so it does not reach your sleep.`);
    if (f.cyclePhase) other.push(`Cycle: ${f.cyclePhase}.`);
    adv.push({ kind: 'Also today', icon: 'info', text: other.join(' ') });
    const since = [];
    if (tst != null) since.push({ icon: 'moon', text: `Slept ${fmtHours(tst)} against a need of ${fmtHours(f.sleepNeed)}` });
    if (f.readiness != null) since.push({ icon: 'heart', text: `Readiness to train ${f.readiness} of 100` });
    cards.push({ ...CHECKIN_TIMES[0], headline: tst != null && tst < f.sleepNeed - 0.75 ? 'Short night. Go easy and eat a proper breakfast.' : 'Good morning. Here is how to start the day.', since, sinceTitle: 'Overnight', advice: adv, ask: { meal: 'Breakfast', done: has(f, 'Breakfast'), text: 'Snap your breakfast so we can tune lunch' } });
  }

  // 12 PM
  {
    const adv = [];
    const ate = kcalBefore(12 * 60), prot = protBefore(12 * 60);
    const base = f.need * SHARE.Lunch;
    let lunch, why;
    if (!has(f, 'Breakfast')) { lunch = base + f.need * SHARE.Breakfast * 0.5; why = 'No breakfast logged, so make lunch a little bigger'; }
    else if (ate > f.need * 0.35) { lunch = base * 0.8; why = `Breakfast was on the bigger side (about ${Math.round(ate)} kcal), so keep lunch lighter`; }
    else { lunch = base; why = `Breakfast gave you about ${Math.round(ate)} kcal and ${Math.round(prot)} g protein`; }
    const pLunch = Math.max(20, Math.round(f.proteinGoal * 0.55 - prot));
    adv.push({ kind: 'Lunch', icon: 'leaf', text: `${why}. ${f.lunchIdea}: about ${kcalRange(lunch)} with ${pLunch} g protein.` });
    const exp = f.wt * 0.4;
    adv.push({ kind: 'Hydration', icon: 'drop', text: f.fluid >= exp ? `On track at ${L(f.fluid)}. Aim for ${L(f.wt * 0.75)} by 5 PM.` : `You are at ${L(f.fluid)}, about ${L(exp - f.fluid)} behind. Have two glasses with lunch.` });
    if (sess && !sess.rest && !f.trainingDone) adv.push({ kind: 'Training', icon: 'dumbbell', text: `${sess.title} is still ahead. Include some carbs at lunch (rice, bread or fruit) to fuel it.` });
    else if (sess?.rest || !sess) adv.push({ kind: 'Fitness', icon: 'pulse', text: 'Take a 15-minute walk after lunch. It helps energy and blood sugar.' });
    else adv.push({ kind: 'Training', icon: 'dumbbell', text: 'Training is done. Lunch is a good time for protein to help recovery.' });
    if (f.readiness != null && f.readiness < 50) adv.push({ kind: 'Also today', icon: 'info', text: 'Recovery is lower today. A 5-minute breathing break after lunch helps.' });
    else adv.push({ kind: 'Also today', icon: 'info', text: `Coffee is fine until about ${clockLabel(f.cutoff)}.` });
    cards.push({ ...CHECKIN_TIMES[1], headline: has(f, 'Breakfast') ? 'Lunch, adjusted to your breakfast.' : 'Halfway through the day.', since: windowLog(f, 6 * 60, 12 * 60), sinceTitle: 'Since 6 AM', advice: adv, ask: { meal: 'Lunch', done: has(f, 'Lunch'), text: 'Snap your lunch so we can tune dinner' } });
  }

  // 5 PM
  {
    const adv = [];
    const ate = kcalBefore(17 * 60), prot = protBefore(17 * 60);
    const logged = eatenBefore(17 * 60).length;
    const left = f.need - ate;
    let dinner, why;
    if (logged === 0) { dinner = f.need * SHARE.Dinner; why = 'No meals logged yet, so here is a normal dinner'; }
    else if (left > f.need * 0.5) { dinner = f.need * 0.4; why = `You have had about ${Math.round(ate)} kcal so far, less than usual. Have a full dinner`; }
    else if (left < f.need * 0.2) { dinner = Math.max(300, f.need * 0.18); why = `You are close to today's energy need (${Math.round(ate)} of ${Math.round(f.need)} kcal). Keep dinner light, mostly protein and vegetables`; }
    else { dinner = f.need * SHARE.Dinner; why = `About ${Math.round(ate)} kcal so far, right on track`; }
    const pDinner = Math.max(25, Math.round(f.proteinGoal - prot));
    adv.push({ kind: 'Dinner', icon: 'leaf', text: `${why}. ${f.dinnerIdea}: about ${kcalRange(dinner)} with ${Math.min(pDinner, 60)} g protein${pDinner > 60 ? ' (protein is behind today, so add a protein snack too)' : ''}.` });
    if (sess && !sess.rest) adv.push({ kind: 'Fitness and training', icon: 'dumbbell', text: f.trainingDone ? 'Training done. Nice work. Get protein in within two hours.' : `${sess.title} is still to do. ${sess.verdict.verdict}: ${sess.verdict.note} Warm up for 5 minutes first.` });
    else adv.push({ kind: 'Fitness', icon: 'pulse', text: f.stepsToday != null ? `${f.stepsToday.toLocaleString()} of ${f.stepTarget.toLocaleString()} steps. ${f.stepsToday < f.stepTarget ? 'A 20-minute walk after dinner closes most of the gap.' : 'Step goal reached.'}` : 'A 20-minute walk after dinner helps digestion and sleep.' });
    adv.push({ kind: 'Hydration', icon: 'drop', text: f.fluid >= f.wt ? 'Water goal reached. Sip from here so sleep is not broken.' : `${L(f.wt - f.fluid)} to go. Drink most of it before 8 PM so you are not up at night.` });
    if (f.caffeine.some((x) => x.minute > f.cutoff)) adv.push({ kind: 'Also today', icon: 'info', text: 'You had coffee after your cut-off. Switch to decaf or herbal tea from here.' });
    cards.push({ ...CHECKIN_TIMES[2], headline: logged ? 'Dinner, adjusted to what you ate today.' : 'Evening plan.', since: windowLog(f, 12 * 60, 17 * 60), sinceTitle: 'Since 12 PM', advice: adv, ask: { meal: 'Dinner', done: has(f, 'Dinner'), text: 'Snap your dinner to close the day' } });
  }

  // 9 PM
  {
    const adv = [];
    adv.push({ kind: 'Sleep', icon: 'moon', text: `Start winding down around ${clockLabel(f.bed - 30)}: dim the lights and put screens away. In bed around ${clockLabel(f.bed)} gives you ${fmtHours(f.sleepNeed)}.` });
    const notes = [];
    if (lateCoffee) notes.push('Coffee after your cut-off can make it harder to fall asleep, so give yourself extra wind-down time.');
    const lateMeal = f.meals.find((m) => (m.minute ?? 0) > f.bed - 180 && (m.kcal || 0) > 600);
    if (lateMeal) notes.push('A big meal late in the evening can disturb sleep. Keep it lighter tomorrow night.');
    if (f.trainingDone && sess && !sess.rest) notes.push('You trained today. A cool, dark room helps recovery overnight.');
    if (notes.length) adv.push({ kind: 'Tonight', icon: 'info', text: notes.join(' ') });
    const mealsN = f.meals.filter((m) => m.slot !== 'Snack').length;
    adv.push({ kind: 'Your day', icon: 'check', text: `${mealsN} of ${f.profile.usualMeals || 3} meals logged, ${L(f.fluid)} of ${L(f.wt)} water${f.oneThing ? `, One Thing ${f.oneThingRecord?.outcome === 'done' ? 'done' : f.oneThingRecord?.outcome === 'partly' ? 'partly done' : 'not marked yet'}` : ''}.` });
    if (f.nextTrain) adv.push({ kind: 'Tomorrow', icon: 'calendar', text: f.nextTrain === 1 ? 'Training tomorrow. A good night tonight sets it up.' : 'Rest or easy movement tomorrow.' });
    cards.push({ ...CHECKIN_TIMES[3], headline: 'Time to wind down.', since: windowLog(f, 17 * 60, 21 * 60), sinceTitle: 'Since 5 PM', advice: adv, ask: null });
  }

  // state: the latest check-in whose time has passed is "now"
  let cur = -1;
  CHECKIN_TIMES.forEach((x, i) => { if (nowMin >= x.at) cur = i; });
  return cards.map((x, i) => ({ ...x, state: i === cur ? 'now' : i < cur ? 'past' : 'upcoming' }));
}

