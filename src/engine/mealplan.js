// Meal planner. Two layers:
//  1. Deterministic: recipes are lists of foods from the USDA-based table (foods.js). Portions are scaled
//     to the day's goal and every calorie and macro is computed from grams. No model does arithmetic.
//  2. Generative (optional): Claude may pick among library recipes, scale a portion or mark a meal as
//     eaten out, from a plain-language request. Its picks are validated against allergies and diet,
//     and the numbers are recomputed here.
import { FOODS, findFood, mealTotals } from './foods.js';
import { round } from './util.js';

// ---------------- ingredient facts ----------------
const ALLERGENS = {
  eggs: ['scrambled-eggs', 'boiled-egg'],
  dairy: ['greek-yogurt-plain', 'cheddar-cheese', 'feta-cheese', 'milk-2-', 'cottage-cheese', 'protein-shake'],
  gluten: ['whole-wheat-toast', 'white-bread', 'bagel', 'pasta-cooked', 'naan', 'whole-wheat-tortilla', 'granola', 'soy-sauce'],
  peanuts: ['peanut-butter'],
  'tree nuts': ['almonds', 'walnuts'],
  soy: ['tofu-firm', 'edamame', 'soy-sauce'],
  shellfish: ['shrimp-cooked'],
  fish: ['salmon-baked', 'tuna-canned-in-water'],
};
const MEAT = ['grilled-chicken-breast', 'lean-beef-cooked', 'turkey-breast-roasted'];
const SEAFOOD = ['salmon-baked', 'tuna-canned-in-water', 'shrimp-cooked'];
const IRON = ['spinach-raw', 'lentils-cooked', 'lean-beef-cooked', 'tofu-firm', 'kidney-beans-cooked', 'black-beans-cooked', 'chickpeas-cooked', 'dal-lentil-curry-', 'edamame'];
const VITD = ['salmon-baked', 'scrambled-eggs', 'boiled-egg', 'milk-2-', 'tuna-canned-in-water', 'mushrooms'];
const OMEGA3 = ['salmon-baked', 'walnuts', 'chia-seeds', 'tuna-canned-in-water'];
const AISLE = {
  Produce: ['banana', 'apple', 'blueberries', 'orange', 'avocado', 'mixed-green-salad', 'broccoli-steamed', 'spinach-raw', 'roasted-vegetables', 'tomato', 'carrots-raw', 'cucumber', 'potato-baked', 'sweet-potato-baked', 'bell-pepper', 'onion', 'mushrooms', 'zucchini', 'strawberries'],
  'Meat and seafood': ['grilled-chicken-breast', 'salmon-baked', 'lean-beef-cooked', 'turkey-breast-roasted', 'shrimp-cooked'],
  'Dairy, eggs and chilled': ['scrambled-eggs', 'boiled-egg', 'greek-yogurt-plain', 'cheddar-cheese', 'feta-cheese', 'milk-2-', 'cottage-cheese', 'tofu-firm', 'hummus'],
  'Bread and grains': ['whole-wheat-toast', 'white-bread', 'bagel', 'whole-wheat-tortilla', 'white-rice-cooked', 'brown-rice-cooked', 'quinoa-cooked', 'pasta-cooked', 'rolled-oats-dry', 'oatmeal-cooked', 'granola', 'naan'],
  Pantry: ['lentils-cooked', 'black-beans-cooked', 'chickpeas-cooked', 'kidney-beans-cooked', 'tuna-canned-in-water', 'peanut-butter', 'almonds', 'walnuts', 'chia-seeds', 'olive-oil', 'soy-sauce', 'protein-shake', 'dal-lentil-curry-'],
  Frozen: ['edamame'],
};
const STAPLES = ['olive-oil', 'soy-sauce'];
export const aisleOf = (id) => Object.keys(AISLE).find((a) => AISLE[a].includes(id)) || 'Other';
export const allergensOf = (ids) => Object.keys(ALLERGENS).filter((a) => ids.some((id) => ALLERGENS[a].includes(id)));

// ---------------- recipe library (Health Track kitchen, not AI-generated) ----------------
const R = (id, slot, name, prep, skill, items, steps) => ({ id, slot, name, prep, skill, items: items.map(([foodId, g]) => ({ foodId, grams: g })), steps });
export const RECIPES = [
  R('b-yogurt-bowl', 'breakfast', 'Greek yogurt bowl with berries and walnuts', 5, 'easy', [['greek-yogurt-plain', 200], ['blueberries', 100], ['rolled-oats-dry', 20], ['walnuts', 15]], ['Spoon the yogurt into a bowl.', 'Top with oats, berries and chopped walnuts.']),
  R('b-veggie-scramble', 'breakfast', 'Veggie scramble on wholegrain toast', 10, 'easy', [['scrambled-eggs', 150], ['spinach-raw', 40], ['tomato', 60], ['whole-wheat-toast', 60]], ['Wilt the spinach in a pan for a minute.', 'Add beaten eggs and stir gently until just set.', 'Serve on toast with sliced tomato.']),
  R('b-overnight-oats', 'breakfast', 'Overnight oats with chia and strawberries', 5, 'easy', [['rolled-oats-dry', 50], ['milk-2-', 200], ['chia-seeds', 15], ['strawberries', 100]], ['Stir oats, chia and milk in a jar the night before.', 'Chill overnight.', 'Top with sliced strawberries in the morning.']),
  R('b-tofu-scramble', 'breakfast', 'Tofu scramble with peppers and toast', 15, 'medium', [['tofu-firm', 150], ['bell-pepper', 60], ['spinach-raw', 40], ['whole-wheat-toast', 60], ['olive-oil', 5]], ['Crumble the tofu into a hot oiled pan.', 'Add diced pepper and spinach, cook 5 minutes.', 'Season and serve with toast.']),
  R('b-cottage-banana', 'breakfast', 'Cottage cheese with banana and almonds', 3, 'easy', [['cottage-cheese', 200], ['banana', 120], ['almonds', 15]], ['Slice the banana over the cottage cheese.', 'Sprinkle with chopped almonds.']),
  R('b-pb-oatmeal', 'breakfast', 'Peanut butter banana oatmeal', 8, 'easy', [['oatmeal-cooked', 240], ['banana', 100], ['peanut-butter', 16]], ['Cook the oats with water.', 'Stir in peanut butter and top with banana.']),
  R('b-avocado-eggs', 'breakfast', 'Avocado toast with boiled eggs', 12, 'easy', [['whole-wheat-toast', 60], ['avocado', 50], ['boiled-egg', 100], ['tomato', 50]], ['Boil the eggs for 8 minutes.', 'Mash avocado onto the toast.', 'Top with sliced egg and tomato.']),
  R('b-walnut-oatmeal', 'breakfast', 'Oatmeal with walnuts, chia and berries', 8, 'easy', [['oatmeal-cooked', 240], ['walnuts', 15], ['chia-seeds', 10], ['blueberries', 80]], ['Cook the oats with water.', 'Stir in chia, top with berries and walnuts.']),

  R('l-chicken-quinoa', 'lunch', 'Chicken and quinoa salad', 15, 'easy', [['grilled-chicken-breast', 120], ['quinoa-cooked', 150], ['mixed-green-salad', 80], ['cucumber', 60], ['tomato', 60], ['olive-oil', 10]], ['Slice the cooked chicken.', 'Toss quinoa, greens, cucumber and tomato with oil.', 'Top with chicken.']),
  R('l-chickpea-bowl', 'lunch', 'Chickpea and roasted vegetable bowl', 15, 'easy', [['chickpeas-cooked', 160], ['roasted-vegetables', 150], ['brown-rice-cooked', 120], ['hummus', 30]], ['Warm the chickpeas and vegetables.', 'Serve over rice with a spoon of hummus.']),
  R('l-tuna-beans', 'lunch', 'Tuna and bean salad', 10, 'easy', [['tuna-canned-in-water', 100], ['kidney-beans-cooked', 120], ['mixed-green-salad', 80], ['tomato', 60], ['olive-oil', 10]], ['Drain the tuna and beans.', 'Toss with greens, tomato and oil.']),
  R('l-lentil-soup', 'lunch', 'Lentil and spinach soup', 25, 'medium', [['lentils-cooked', 200], ['carrots-raw', 60], ['onion', 50], ['tomato', 80], ['spinach-raw', 40], ['olive-oil', 5], ['whole-wheat-toast', 30]], ['Soften onion and carrot in oil.', 'Add tomato, lentils and water, simmer 15 minutes.', 'Stir in spinach. Serve with toast.']),
  R('l-turkey-wrap', 'lunch', 'Turkey and avocado wrap', 8, 'easy', [['whole-wheat-tortilla', 60], ['turkey-breast-roasted', 90], ['avocado', 50], ['mixed-green-salad', 40], ['tomato', 40]], ['Spread avocado on the tortilla.', 'Add turkey, greens and tomato, then roll up.']),
  R('l-bean-burrito-bowl', 'lunch', 'Black bean burrito bowl', 15, 'easy', [['black-beans-cooked', 150], ['brown-rice-cooked', 150], ['bell-pepper', 60], ['tomato', 60], ['avocado', 40]], ['Warm the beans and rice.', 'Top with diced pepper, tomato and avocado.']),
  R('l-salmon-bowl', 'lunch', 'Salmon rice bowl with edamame', 15, 'medium', [['salmon-baked', 120], ['white-rice-cooked', 150], ['edamame', 60], ['cucumber', 60], ['soy-sauce', 10]], ['Flake the cooked salmon.', 'Serve over rice with edamame and cucumber.', 'Finish with a little soy sauce.']),
  R('l-tofu-quinoa', 'lunch', 'Tofu and edamame quinoa bowl', 20, 'medium', [['tofu-firm', 120], ['edamame', 60], ['quinoa-cooked', 150], ['broccoli-steamed', 80], ['soy-sauce', 10]], ['Pan-fry cubed tofu until golden.', 'Steam broccoli and edamame.', 'Serve over quinoa with soy sauce.']),

  R('d-salmon-sweetpotato', 'dinner', 'Salmon with sweet potato and broccoli', 30, 'medium', [['salmon-baked', 140], ['sweet-potato-baked', 180], ['broccoli-steamed', 120], ['olive-oil', 5]], ['Bake the sweet potato at 200 °C for 25 minutes.', 'Bake the salmon for the last 12 minutes.', 'Steam the broccoli and drizzle with oil.']),
  R('d-chicken-stirfry', 'dinner', 'Chicken stir-fry with brown rice', 25, 'medium', [['grilled-chicken-breast', 140], ['bell-pepper', 80], ['broccoli-steamed', 80], ['onion', 40], ['brown-rice-cooked', 160], ['soy-sauce', 10], ['olive-oil', 10]], ['Stir-fry sliced chicken in hot oil.', 'Add vegetables and cook 5 minutes.', 'Add soy sauce, serve over rice.']),
  R('d-beef-spinach-pasta', 'dinner', 'Lean beef and spinach pasta', 25, 'medium', [['lean-beef-cooked', 110], ['pasta-cooked', 180], ['spinach-raw', 60], ['tomato', 100], ['olive-oil', 5]], ['Brown the beef in a pan.', 'Add chopped tomato and simmer 10 minutes.', 'Stir in spinach and the cooked pasta.']),
  R('d-dal-rice', 'dinner', 'Lentil dal with rice and spinach', 30, 'medium', [['dal-lentil-curry-', 250], ['brown-rice-cooked', 150], ['spinach-raw', 60]], ['Heat the dal and stir in the spinach.', 'Serve over rice.']),
  R('d-shrimp-zucchini', 'dinner', 'Shrimp and zucchini quinoa', 20, 'medium', [['shrimp-cooked', 140], ['zucchini', 150], ['quinoa-cooked', 150], ['tomato', 60], ['olive-oil', 10]], ['Sauté sliced zucchini in oil.', 'Add shrimp and tomato for 3 minutes.', 'Serve over quinoa.']),
  R('d-turkey-chili', 'dinner', 'Turkey chili with beans', 35, 'medium', [['turkey-breast-roasted', 110], ['kidney-beans-cooked', 150], ['tomato', 150], ['onion', 50], ['bell-pepper', 60]], ['Soften onion and pepper.', 'Add turkey, beans and tomato, simmer 20 minutes.']),
  R('d-tofu-mushroom', 'dinner', 'Tofu, mushroom and broccoli stir-fry', 20, 'medium', [['tofu-firm', 150], ['mushrooms', 100], ['broccoli-steamed', 100], ['brown-rice-cooked', 150], ['soy-sauce', 10], ['olive-oil', 10]], ['Fry cubed tofu until golden.', 'Add mushrooms and broccoli for 5 minutes.', 'Add soy sauce, serve over rice.']),
  R('d-chicken-potato', 'dinner', 'Baked chicken with potato and green salad', 35, 'easy', [['grilled-chicken-breast', 140], ['potato-baked', 200], ['mixed-green-salad', 100], ['olive-oil', 10]], ['Bake the potato at 200 °C for 30 minutes.', 'Bake the chicken for 20 minutes.', 'Serve with dressed salad.']),
  R('d-omelette-salad', 'dinner', 'Mushroom and spinach omelette with salad', 12, 'easy', [['scrambled-eggs', 150], ['mushrooms', 60], ['spinach-raw', 40], ['mixed-green-salad', 80]], ['Cook mushrooms and spinach.', 'Pour in beaten eggs, fold when set.', 'Serve with salad.']),

  R('s-apple-almonds', 'snack', 'Apple with almonds', 1, 'easy', [['apple', 180], ['almonds', 20]], ['Slice the apple, eat with almonds.']),
  R('s-hummus-carrots', 'snack', 'Carrots and hummus', 3, 'easy', [['carrots-raw', 100], ['hummus', 50]], ['Cut carrots into sticks and dip.']),
  R('s-edamame', 'snack', 'Steamed edamame', 5, 'easy', [['edamame', 120]], ['Steam from frozen for 4 minutes, add a pinch of salt.']),
  R('s-yogurt-berries', 'snack', 'Greek yogurt with strawberries', 2, 'easy', [['greek-yogurt-plain', 150], ['strawberries', 100]], ['Top yogurt with sliced strawberries.']),
];
// derived facts per recipe
for (const r of RECIPES) {
  const ids = r.items.map((i) => i.foodId);
  for (const id of ids) if (!findFood(id)) throw new Error(`Recipe ${r.id}: unknown food ${id}`);
  r.allergens = allergensOf(ids);
  r.diet = ids.some((id) => MEAT.includes(id)) ? 'meat' : ids.some((id) => SEAFOOD.includes(id)) ? 'pescatarian' : ids.some((id) => ALLERGENS.eggs.includes(id) || ALLERGENS.dairy.includes(id)) ? 'vegetarian' : 'vegan';
  const t = mealTotals(r.items);
  r.base = t;
  r.tags = [
    t.protein >= 30 && 'protein', t.carbs >= 60 && 'carbs', t.fiber >= 10 && 'fiber', t.kcal <= 450 && r.slot === 'dinner' && 'light',
    ids.some((id) => IRON.includes(id)) && 'iron', ids.some((id) => VITD.includes(id)) && 'vitd', ids.some((id) => OMEGA3.includes(id)) && 'omega3',
  ].filter(Boolean);
}
export const recipeById = (id) => RECIPES.find((r) => r.id === id);

export const TAG_LABEL = { protein: 'High protein', carbs: 'Carbs to fuel training', fiber: 'High fiber', light: 'Lighter', iron: 'Iron-rich', vitd: 'Vitamin D', omega3: 'Omega-3' };

export function fitsPerson(r, profile) {
  const diet = profile.diet || 'none';
  if (diet === 'vegan' && r.diet !== 'vegan') return false;
  if (diet === 'vegetarian' && !['vegan', 'vegetarian'].includes(r.diet)) return false;
  if (diet === 'pescatarian' && r.diet === 'meat') return false;
  const al = (profile.allergies || []).map((a) => a.toLowerCase());
  return !r.allergens.some((a) => al.includes(a));
}

// ---------------- the day's nutrition goal ----------------
// en: energy need (already includes any calorie-deficit pace and the 1,200/1,500 floor).
export function nutritionGoal({ profile, en, trainingToday, trainingCode, shortSleep, cyclePhase, labs, waterMl }) {
  const kg = profile.weightKg || 70;
  const goals = profile.goals || [];
  const focus = [];
  const add = (tag, why) => { if (!focus.some((f) => f.tag === tag)) focus.push({ tag, why }); };
  let ppk = 1.2;
  if (goals.includes('Build strength')) { ppk = 1.6; add('protein', 'Your goal is to build strength, so protein is set to 1.6 g per kg.'); }
  if (profile.weightGoal === 'lose') { ppk = Math.max(ppk, 1.4); add('protein', 'You are in a calorie deficit, so protein is raised to protect muscle.'); }
  if (trainingToday) { ppk = Math.min(2, ppk + 0.2); add(trainingCode === 'push' || trainingCode === 'planned' ? 'carbs' : 'protein', `Training today, so meals carry more ${trainingCode === 'push' || trainingCode === 'planned' ? 'carbs to fuel it' : 'protein for recovery'}.`); }
  if (shortSleep) add('light', 'You slept short last night, so dinner is lighter and earlier to protect tonight\'s sleep.');
  if (goals.includes('Sleep better') && !shortSleep) add('light', 'Your goal is better sleep, so dinner stays on the lighter side.');
  if (goals.includes('More energy') || goals.includes('Eat better')) add('fiber', 'Steady energy comes from fiber and whole grains at each meal.');
  if (cyclePhase && /menstrual|period/i.test(cyclePhase)) add('iron', 'During your period, iron-rich foods help replace what is lost.');
  for (const l of labs || []) {
    if (l.key === 'ferritin' && l.low) add('iron', 'Your last lab report showed ferritin below the optimal range, so meals lean iron-rich.');
    if (l.key === 'vitd' && l.low) add('vitd', 'Your last lab report showed vitamin D below the optimal range, so meals include vitamin D foods.');
    if ((l.key === 'ldl' || l.key === 'apob' || l.key === 'tg') && l.high) { add('fiber', 'Your lipid results were above optimal, so meals are higher in fiber.'); add('omega3', 'Omega-3 foods like salmon and walnuts are favoured for your lipids.'); }
    if ((l.key === 'hba1c' || l.key === 'glucose') && l.high) add('fiber', 'Your glucose markers were above optimal, so carbs come mostly from high-fiber foods.');
  }
  if (profile.weightGoal === 'lose') add('fiber', 'Fiber keeps you full on fewer calories.');
  const kcal = Math.round(en.need);
  const protein = Math.round(ppk * kg);
  const fat = Math.round((0.28 * kcal) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((14 * kcal) / 1000);
  const shares = focus.some((f) => f.tag === 'light') ? { breakfast: 0.27, lunch: 0.38, dinner: 0.25, snack: 0.1 } : { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 };
  return { kcal, protein, carbs, fat, fiber, water: waterMl || null, proteinPerKg: ppk, focus, shares };
}

// ---------------- building a day ----------------
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

export function scaleRecipe(r, kcalTarget, fixedPortion) {
  const f = fixedPortion || Math.min(1.6, Math.max(0.6, Math.round((kcalTarget / r.base.kcal) * 20) / 20));
  const items = r.items.map((i) => ({ foodId: i.foodId, grams: Math.max(5, Math.round((i.grams * f) / 5) * 5) }));
  return { portion: f, items, totals: mealTotals(items) };
}

export function candidates(slot, profile, prefs = {}) {
  const avoid = prefs.avoid || [];
  let list = RECIPES.filter((r) => r.slot === slot && fitsPerson(r, profile));
  if (avoid.length) { const kept = list.filter((r) => !avoid.includes(r.id)); if (kept.length) list = kept; }
  const maxPrep = prefs.prepMax || 45;
  const timed = list.filter((r) => r.prep <= maxPrep && (prefs.skill !== 'beginner' || r.skill === 'easy'));
  return timed.length ? timed : list;
}

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

// day: { date, goal, profile, prefs, override: { breakfast: { recipeId, portion, out, by } ... , prefer: foodId }, recent: [recipeIds], logged: { breakfast: true } }
export function buildDay({ date, goal, profile, prefs = {}, override = {}, recent = [], logged = {} }) {
  const focusTags = goal.focus.map((f) => f.tag);
  const budgets = Object.fromEntries(SLOTS.map((s) => [s, goal.kcal * goal.shares[s]]));
  // eating out: that meal gets a bigger budget, the rest of the day shrinks to match
  const outSlots = SLOTS.filter((s) => override[s]?.out);
  if (outSlots.length) {
    let extra = 0;
    for (const s of outSlots) { const b = Math.round(budgets[s] * 1.35); extra += b - budgets[s]; budgets[s] = b; }
    const rest = SLOTS.filter((s) => !outSlots.includes(s));
    const restSum = rest.reduce((a, s) => a + budgets[s], 0);
    for (const s of rest) budgets[s] = Math.max(budgets[s] * 0.6, budgets[s] - (extra * budgets[s]) / restSum);
  }
  const used = new Set();
  const meals = SLOTS.map((slot) => {
    const ov = override[slot] || {};
    if (ov.out) {
      return { slot, label: SLOT_LABEL[slot], out: true, budget: Math.round(budgets[slot]), by: ov.by || 'you', logged: !!logged[slot],
        tips: ['Pick a grilled or baked protein with vegetables.', 'Ask for sauces and dressings on the side.', 'Share or skip the bread basket and dessert.', 'Water or sparkling water instead of a second drink.'] };
    }
    const list = candidates(slot, profile, prefs);
    let r = ov.recipeId ? recipeById(ov.recipeId) : null;
    if (r && !fitsPerson(r, profile)) r = null;
    if (!r) {
      const scored = list.map((c) => {
        let s = c.tags.filter((t) => focusTags.includes(t)).length * 2;
        if (override.prefer && c.items.some((i) => i.foodId === override.prefer)) s += 6;
        if (recent.includes(c.id)) s -= 3;
        if (used.has(c.id)) s -= 10;
        if (slot === 'dinner' && focusTags.includes('light') && !c.tags.includes('light') && c.prep > 30) s -= 1;
        return { c, s: s + hash(date + slot + c.id) };
      }).sort((a, b) => b.s - a.s);
      const skip = ov.swaps || 0;
      r = scored[skip % scored.length]?.c;
    }
    if (!r) return { slot, label: SLOT_LABEL[slot], empty: true };
    used.add(r.id);
    const sc = scaleRecipe(r, budgets[slot], ov.portion);
    const why = r.tags.filter((t) => focusTags.includes(t)).map((t) => TAG_LABEL[t]);
    return {
      slot, label: SLOT_LABEL[slot], recipeId: r.id, name: r.name, prep: r.prep, skill: r.skill, steps: r.steps, diet: r.diet,
      allergens: r.allergens, tags: r.tags.map((t) => TAG_LABEL[t]), why, portion: sc.portion, budget: Math.round(budgets[slot]),
      items: sc.items.map((i) => ({ ...i, name: findFood(i.foodId)?.name })), totals: sc.totals,
      source: ov.by === 'claude' ? 'Adjusted by Claude from the Health Track recipe library' : 'Health Track recipe library',
      byClaude: ov.by === 'claude', logged: !!logged[slot], swaps: ov.swaps || 0,
    };
  });
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const m of meals) {
    if (m.out) { tot.kcal += m.budget; continue; }
    if (m.totals) for (const k of Object.keys(tot)) tot[k] += m.totals[k] || 0;
  }
  for (const k of Object.keys(tot)) tot[k] = round(tot[k]);
  return { date, meals, totals: tot };
}

export function groceryList(days, checked = []) {
  const agg = {};
  for (const d of days) for (const m of d.meals) {
    if (!m.items || m.logged) continue;
    for (const i of m.items) {
      agg[i.foodId] = agg[i.foodId] || { foodId: i.foodId, name: findFood(i.foodId)?.name || i.foodId, grams: 0, meals: 0 };
      agg[i.foodId].grams += i.grams; agg[i.foodId].meals += 1;
    }
  }
  const groups = {};
  for (const it of Object.values(agg)) {
    const a = aisleOf(it.foodId);
    (groups[a] ||= []).push({ ...it, grams: Math.round(it.grams / 10) * 10, ...(['scrambled-eggs', 'boiled-egg'].includes(it.foodId) ? { name: 'Eggs', count: Math.ceil(it.grams / 50) } : {}), staple: STAPLES.includes(it.foodId), checked: checked.includes(it.foodId), cooked: /cooked/.test(it.foodId) });
  }
  const order = ['Produce', 'Meat and seafood', 'Dairy, eggs and chilled', 'Bread and grains', 'Pantry', 'Frozen', 'Other'];
  return order.filter((a) => groups[a]).map((a) => ({ aisle: a, items: groups[a].sort((x, y) => x.name.localeCompare(y.name)) }));
}

// Rule-based reading of a plain-language request (used when Claude is not available, and as a safety net).
export function parseRequest(text, plan, profile) {
  const t = String(text || '').toLowerCase();
  const ov = {};
  const notes = [];
  const slotIn = (s) => (/breakfast|morning/.test(s) ? 'breakfast' : /lunch|noon|midday/.test(s) ? 'lunch' : /dinner|tonight|evening|supper/.test(s) ? 'dinner' : null);
  if (/(din(e|ing) out|eat(ing)? out|restaurant|takeout|take-out|party|date night)/.test(t)) {
    const slot = slotIn(t) || 'dinner';
    ov[slot] = { out: true, by: 'rules' };
    notes.push(`${SLOT_LABEL[slot]} is set as eating out, and the rest of the day is a little lighter to make room.`);
  }
  const use = t.match(/(?:use|using|have|got|leftover)\s+(?:the\s+|some\s+|my\s+)?([a-z ]{3,30}?)(?:\s+in my|\s+from|\s+left|\s+that|[.,!]|$)/);
  if (use) {
    const word = use[1].trim().split(' ').filter((w) => !['fridge', 'pantry', 'up'].includes(w)).join(' ');
    const food = FOODS.find((f) => f.name.toLowerCase().includes(word) || word.includes(f.name.toLowerCase().split(',')[0]));
    if (food) { ov.prefer = food.id; notes.push(`Meals now use the ${food.name.toLowerCase().split(',')[0]} you have.`); }
  }
  const sw = t.match(/(swap|change|different|don't like|do not like|something else).*?(breakfast|lunch|dinner|snack)/);
  if (sw) { const s = sw[2]; ov[s] = { ...(ov[s] || {}), swaps: ((plan?.meals?.find((m) => m.slot === s)?.swaps) || 0) + 1, by: 'rules' }; notes.push(`Swapped ${s}.`); }
  if (/(lighter|not (very )?hungry|smaller)/.test(t)) { const s = slotIn(t) || 'dinner'; ov[s] = { ...(ov[s] || {}), portion: 0.8, by: 'rules' }; notes.push(`${SLOT_LABEL[s]} portion made smaller.`); }
  if (/(bigger|more food|very hungry|starving)/.test(t)) { const s = slotIn(t) || 'lunch'; ov[s] = { ...(ov[s] || {}), portion: 1.2, by: 'rules' }; notes.push(`${SLOT_LABEL[s]} portion made bigger.`); }
  return { override: ov, explanation: notes.join(' ') || 'I could not match that to a change. Try "I\'m eating out tonight", "use the spinach in my fridge" or "swap lunch".' , matched: notes.length > 0 };
}
