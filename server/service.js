// Builds the shared service with server adapters. Requires Supabase (see README).
import { createService } from '../src/service/service.js';
import { supabaseStore } from './store-supabase.js';
import { serverWearables } from './wearables.js';
import { anthropicAI } from './ai-anthropic.js';

// One service per viewer time zone. The server clock runs in UTC, so "now" is shifted to the
// viewer's local time (the browser sends its offset) and dates, greetings and check-in times match theirs.
const services = new Map();
export function getService(tzOffsetMin = 0) {
  const off = Number.isFinite(tzOffsetMin) ? Math.max(-840, Math.min(840, Math.round(tzOffsetMin))) : 0;
  if (!services.has(off)) {
    const now = () => { const d = new Date(Date.now() - off * 60000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()); };
    services.set(off, createService({ store: supabaseStore(), wearables: serverWearables(), ai: anthropicAI(), now }));
  }
  return services.get(off);
}
// Methods the browser may call. Everything else in the service is internal.
export const PUBLIC_METHODS = new Set([
  'bootstrap', 'completeOnboarding', 'getToday', 'checkin', 'oneThingRespond', 'oneThingOutcome',
  'logMeal', 'deleteMeal', 'logWater', 'logCaffeine', 'logAlcohol', 'logSupplement', 'undoLast', 'logMenu', 'analyzeFood', 'searchFood',
  'insights', 'sleepDetail', 'recoveryDetail', 'nutritionDay', 'genieChat', 'genieStream', 'genieAction', 'flagAnswer', 'getMemory', 'updateMemory',
  'progress', 'updateGoals', 'train', 'setTrainingGoal', 'logSet', 'logWorkout', 'deleteWorkout', 'overrideSession', 'logFitnessTest',
  'labs', 'readLabReport', 'confirmLabs', 'cycle', 'setCycle', 'logCycleDay', 'deleteCycleData',
  'profileHub', 'saveProfile', 'updateSetup', 'mealPlan', 'mealPlanAction', 'adjustMealPlan', 'deficit', 'setDeficitGoal', 'logWeight', 'devices', 'devicesCatalog', 'connectDevice', 'disconnectDevice', 'exportData', 'deleteAccount', 'subscription', 'phoneEstimate', 'baseline',
  'seedDemoPersona',
]);
