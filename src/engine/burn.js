// Calories burned (energy out), estimated from what the app knows.
//
//   Burned = Resting + Movement + Workouts
//   Resting   = resting energy (Mifflin-St Jeor, the same REE used for the nutrition goal),
//               counted for the part of the day that has passed (full day for past days)
//   Movement  = steps x 0.00037 kcal per kg body weight per step (net walking cost,
//               about 0.5 kcal/kg/km at roughly 0.75 m a step; 10,000 steps at 70 kg = about 260 kcal)
//   Workouts  = (MET - 1) x kg x hours for each workout (net, so resting is not counted twice).
//               Steps taken during runs and walks are removed from Movement to avoid double counting.
//
// When a wearable reports measured active calories, that value replaces Movement + Workouts.
// Food digestion (about 10% of intake) is left out on purpose: it is small and depends on logging.

const round = (x) => Math.round(x);

export const KCAL_PER_KG_STEP = 0.00037;
export const MET = { Running: 9.8, Cycling: 7.5, Swimming: 7, Strength: 5, HIIT: 8, Walking: 3.5, Hiking: 6, Yoga: 2.5, Pilates: 3, Rowing: 7, Other: 5 };
const STEPS_PER_MIN = { Running: 160, Walking: 110, Hiking: 100 };

export function workoutKcal(w, kg) {
  if (w.kcal != null) return round(w.kcal);
  const met = MET[w.type] ?? (w.strength ? MET.Strength : MET.Other);
  return round(Math.max(0, met - 1) * kg * ((w.minutes || 0) / 60));
}

// dayFraction: 1 for a finished day; for today, the share of the day that has passed (0 to 1).
export function caloriesBurned({ REE, weightKg, steps, workouts = [], activeKcal = null, dayFraction = 1 }) {
  const kg = weightKg || 70;
  const frac = Math.max(0, Math.min(1, dayFraction));
  const resting = round(REE * frac);
  const wk = workouts.map((w) => ({ type: w.type || (w.strength ? 'Strength' : 'Other'), minutes: w.minutes || 0, kcal: workoutKcal(w, kg) }));
  const workoutTotal = wk.reduce((a, w) => a + w.kcal, 0);
  const workoutSteps = workouts.reduce((a, w) => a + (STEPS_PER_MIN[w.type] || 0) * (w.minutes || 0), 0);
  const moveSteps = Math.max(0, (steps || 0) - workoutSteps);
  const movement = round(moveSteps * KCAL_PER_KG_STEP * kg);
  const measured = activeKcal != null;
  const active = measured ? round(activeKcal) : movement + workoutTotal;
  return {
    total: resting + active, resting, movement: measured ? null : movement, workouts: measured ? null : workoutTotal,
    active, steps: steps ?? null, workoutList: wk, measured, partial: frac < 1,
  };
}

// Net energy for the day: eaten minus burned. Negative means more burned than eaten.
export function energyBalance({ eatenKcal, burnedKcal }) {
  if (eatenKcal == null || burnedKcal == null) return null;
  return round(eatenKcal - burnedKcal);
}
