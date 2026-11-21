// Builds the shared service with server adapters. Requires Supabase (see README).
import { createService } from '../src/service/service.js';
import { supabaseStore } from './store-supabase.js';
import { serverWearables } from './wearables.js';
import { anthropicAI } from './ai-anthropic.js';

let svc = null;
export function getService() {
  if (!svc) svc = createService({ store: supabaseStore(), wearables: serverWearables(), ai: anthropicAI() });
  return svc;
}
// Methods the browser may call. Everything else in the service is internal.
export const PUBLIC_METHODS = new Set([
  'bootstrap', 'completeOnboarding', 'getToday', 'checkin', 'oneThingRespond', 'oneThingOutcome',
  'logMeal', 'deleteMeal', 'logWater', 'logCaffeine', 'logAlcohol', 'logSupplement', 'undoLast', 'logMenu', 'analyzeFood', 'searchFood',
  'insights', 'sleepDetail', 'recoveryDetail', 'nutritionDay', 'genieChat', 'genieStream', 'genieAction', 'flagAnswer', 'getMemory', 'updateMemory',
  'progress', 'updateGoals', 'train', 'setTrainingGoal', 'logSet', 'logWorkout', 'deleteWorkout', 'overrideSession', 'logFitnessTest',
  'labs', 'readLabReport', 'confirmLabs', 'cycle', 'setCycle', 'logCycleDay', 'deleteCycleData',
  'profileHub', 'saveProfile', 'updateSetup', 'devices', 'devicesCatalog', 'connectDevice', 'disconnectDevice', 'exportData', 'deleteAccount', 'subscription', 'phoneEstimate', 'baseline',
  'seedDemoPersona',
]);
