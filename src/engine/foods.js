// Demo food reference table: nutrients per 100 g, rounded from USDA FoodData Central
// "Foundation" and "SR Legacy" values. A production build matches each item to an FDC
// record (F0.9) or a branded database row. The model never invents nutrient values.
// Columns: [name, kcal, protein g, carbs g, fat g, fiber g, small g, medium g, large g]
const ROWS = [
  ['Scrambled eggs', 149, 10, 1.6, 11, 0, 60, 100, 150],
  ['Boiled egg', 155, 12.6, 1.1, 10.6, 0, 50, 100, 150],
  ['Greek yogurt, plain', 73, 10, 3.9, 1.9, 0, 120, 170, 250],
  ['Oatmeal, cooked', 71, 2.5, 12, 1.5, 1.7, 150, 240, 350],
  ['Granola', 471, 10, 64, 20, 7, 30, 55, 85],
  ['Banana', 89, 1.1, 23, 0.3, 2.6, 90, 120, 150],
  ['Apple', 52, 0.3, 14, 0.2, 2.4, 120, 180, 220],
  ['Blueberries', 57, 0.7, 14, 0.3, 2.4, 50, 100, 150],
  ['Orange', 47, 0.9, 12, 0.1, 2.4, 100, 140, 180],
  ['Whole wheat toast', 247, 13, 41, 3.4, 7, 30, 60, 90],
  ['White bread', 266, 8.9, 49, 3.3, 2.7, 30, 60, 90],
  ['Bagel', 257, 10, 50, 1.7, 2.1, 70, 100, 130],
  ['Avocado', 160, 2, 8.5, 14.7, 6.7, 50, 100, 150],
  ['Peanut butter', 588, 25, 20, 50, 6, 16, 32, 48],
  ['Almonds', 579, 21, 22, 50, 12.5, 15, 28, 45],
  ['Grilled chicken breast', 165, 31, 0, 3.6, 0, 90, 140, 200],
  ['Salmon, baked', 206, 22, 0, 12, 0, 90, 140, 200],
  ['Tuna, canned in water', 116, 26, 0, 0.8, 0, 60, 100, 140],
  ['Lean beef, cooked', 250, 26, 0, 15, 0, 90, 140, 200],
  ['Tofu, firm', 144, 17, 2.8, 8.7, 2.3, 80, 120, 180],
  ['Lentils, cooked', 116, 9, 20, 0.4, 7.9, 100, 180, 250],
  ['Black beans, cooked', 132, 8.9, 24, 0.5, 8.7, 90, 170, 250],
  ['Chickpeas, cooked', 164, 8.9, 27, 2.6, 7.6, 90, 160, 240],
  ['White rice, cooked', 130, 2.7, 28, 0.3, 0.4, 100, 160, 250],
  ['Brown rice, cooked', 123, 2.7, 26, 1, 1.6, 100, 160, 250],
  ['Quinoa, cooked', 120, 4.4, 21, 1.9, 2.8, 90, 150, 220],
  ['Pasta, cooked', 158, 5.8, 31, 0.9, 1.8, 120, 200, 300],
  ['Potato, baked', 93, 2.5, 21, 0.1, 2.2, 120, 170, 250],
  ['Sweet potato, baked', 90, 2, 21, 0.2, 3.3, 100, 150, 220],
  ['French fries', 312, 3.4, 41, 15, 3.8, 70, 115, 155],
  ['Mixed green salad', 17, 1.3, 3.3, 0.2, 1.8, 50, 100, 150],
  ['Broccoli, steamed', 35, 2.4, 7.2, 0.4, 3.3, 60, 100, 150],
  ['Spinach, raw', 23, 2.9, 3.6, 0.4, 2.2, 30, 60, 90],
  ['Roasted vegetables', 70, 1.8, 9, 3.5, 3, 80, 130, 200],
  ['Tomato', 18, 0.9, 3.9, 0.2, 1.2, 60, 120, 180],
  ['Carrots, raw', 41, 0.9, 10, 0.2, 2.8, 50, 80, 120],
  ['Cucumber', 15, 0.7, 3.6, 0.1, 0.5, 50, 100, 150],
  ['Hummus', 166, 7.9, 14, 9.6, 6, 30, 60, 90],
  ['Cheddar cheese', 403, 23, 3.1, 33, 0, 20, 30, 50],
  ['Feta cheese', 264, 14, 4.1, 21, 0, 20, 30, 50],
  ['Milk, 2%', 50, 3.3, 4.8, 2, 0, 120, 240, 350],
  ['Olive oil', 884, 0, 0, 100, 0, 5, 10, 15],
  ['Caesar dressing', 542, 2, 3, 58, 0, 15, 30, 45],
  ['Pizza, cheese', 266, 11, 33, 10, 2.3, 107, 214, 321],
  ['Burger, beef, in bun', 254, 13, 24, 12, 1.3, 150, 220, 300],
  ['Burrito, chicken', 185, 10, 21, 6.6, 2.4, 200, 300, 400],
  ['Sushi roll', 140, 5, 25, 2, 0.8, 120, 200, 300],
  ['Chicken curry', 150, 12, 6, 9, 1.5, 150, 250, 350],
  ['Dal (lentil curry)', 104, 5.5, 14, 3, 3.5, 150, 250, 350],
  ['Naan', 291, 9.6, 50, 5.7, 2.2, 45, 90, 130],
  ['Pho with beef', 60, 4.5, 7, 1.3, 0.4, 350, 550, 750],
  ['Ramen with pork', 90, 4.6, 11, 3, 0.7, 350, 550, 750],
  ['Poke bowl', 150, 9, 18, 4.5, 1.5, 250, 380, 500],
  ['Caesar salad with chicken', 127, 10, 5, 7.5, 1.5, 200, 300, 400],
  ['Grain bowl with chicken', 145, 10, 16, 4.5, 3, 250, 380, 500],
  ['Turkey sandwich', 214, 13, 24, 7, 2.2, 150, 220, 300],
  ['Protein bar', 360, 30, 40, 10, 8, 40, 60, 80],
  ['Protein shake', 54, 8.7, 2.6, 1, 0.3, 250, 330, 500],
  ['Dark chocolate', 598, 7.8, 46, 43, 11, 15, 30, 50],
  ['Croissant', 406, 8.2, 46, 21, 2.6, 45, 60, 85],
  ['Muffin, blueberry', 377, 4.4, 54, 16, 1.6, 60, 110, 140],
  ['Cookie', 488, 5, 64, 24, 2, 15, 30, 50],
  ['Ice cream', 207, 3.5, 24, 11, 0.7, 65, 130, 200],
  ['Orange juice', 45, 0.7, 10, 0.2, 0.2, 180, 240, 350],
  ['Latte', 54, 3.4, 5, 2, 0, 240, 350, 470],
  ['Beer', 43, 0.5, 3.6, 0, 0, 330, 355, 500],
  ['Red wine', 85, 0.1, 2.6, 0, 0, 120, 150, 250],
  // added for the meal planner's recipes (USDA FoodData Central, rounded)
  ['Whole wheat tortilla', 310, 9.7, 50, 8, 7, 45, 60, 75],
  ['Bell pepper', 26, 1, 6, 0.3, 2.1, 60, 120, 160],
  ['Onion', 40, 1.1, 9.3, 0.1, 1.7, 40, 80, 110],
  ['Mushrooms', 22, 3.1, 3.3, 0.3, 1, 50, 100, 150],
  ['Shrimp, cooked', 99, 24, 0.2, 0.3, 0, 80, 120, 170],
  ['Cottage cheese', 98, 11, 3.4, 4.3, 0, 110, 170, 225],
  ['Chia seeds', 486, 17, 42, 31, 34, 10, 15, 25],
  ['Turkey breast, roasted', 147, 30, 0, 2, 0, 60, 100, 140],
  ['Edamame', 121, 12, 9, 5, 5, 60, 100, 155],
  ['Zucchini', 17, 1.2, 3.1, 0.3, 1, 80, 120, 200],
  ['Strawberries', 32, 0.7, 7.7, 0.3, 2, 80, 150, 200],
  ['Walnuts', 654, 15, 14, 65, 6.7, 15, 28, 45],
  ['Soy sauce', 53, 8, 4.9, 0.6, 0.8, 10, 15, 30],
  ['Rolled oats, dry', 379, 13, 68, 6.5, 10, 30, 40, 60],
  ['Kidney beans, cooked', 127, 8.7, 23, 0.5, 6.4, 90, 170, 250],
];

export const FOODS = ROWS.map((r) => ({
  id: r[0].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name: r[0], kcal: r[1], protein: r[2], carbs: r[3], fat: r[4], fiber: r[5],
  portions: { S: r[6], M: r[7], L: r[8] },
  source: 'FoodData Central (rounded)',
}));

export const findFood = (id) => FOODS.find((f) => f.id === id);

export function searchFoods(q, n = 8) {
  const s = (q || '').toLowerCase().trim();
  if (!s) return FOODS.slice(0, n);
  const words = s.split(/\s+/);
  return FOODS.map((f) => {
    const name = f.name.toLowerCase();
    let score = 0;
    if (name.startsWith(s)) score += 5;
    for (const w of words) if (name.includes(w)) score += 2;
    return { f, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.f);
}

// Best database match for a free-text item name from the vision model.
export function matchFood(name) {
  const hits = searchFoods(name, 1);
  if (hits.length) return hits[0];
  const words = (name || '').toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  for (const w of words) { const h = searchFoods(w, 1); if (h.length) return h[0]; }
  return null;
}

// Nutrients for grams of a food (F0.9) and a meal range from portion confidence (F5.11).
export function nutrientsFor(food, grams) {
  const k = grams / 100;
  return {
    kcal: food.kcal * k, protein: food.protein * k, carbs: food.carbs * k, fat: food.fat * k, fiber: food.fiber * k,
  };
}

export function mealTotals(items) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, kcalLow: 0, kcalHigh: 0 };
  for (const it of items) {
    const f = findFood(it.foodId);
    if (!f) continue;
    const n = nutrientsFor(f, it.grams);
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber']) t[k] += n[k];
    const lo = it.gramsLow ?? it.grams * (it.confirmed ? 1 : 0.85);
    const hi = it.gramsHigh ?? it.grams * (it.confirmed ? 1 : 1.15);
    t.kcalLow += (f.kcal * lo) / 100;
    t.kcalHigh += (f.kcal * hi) / 100;
  }
  for (const k of Object.keys(t)) t[k] = Math.round(t[k] * 10) / 10;
  t.kcalLow = Math.round(t.kcalLow / 10) * 10;
  t.kcalHigh = Math.round(t.kcalHigh / 10) * 10;
  return t;
}
