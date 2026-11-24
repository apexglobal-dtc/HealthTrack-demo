// Health Genie guardrails and wording (PRD v4 section 8, formulas F10).
// The engines decide; Genie only words things, grounded in a context packet.

import { fmtHours } from './util.js';

// ---------- F10.3 red-flag router (runs on every message, before any model) ----------
const RED_FLAGS = [
  { key: 'chest', re: /(chest (pain|tight|pressure)|pain in my chest|heart attack)/i },
  { key: 'breath', re: /(can'?t breathe|short(ness)? of breath|struggling to breathe)/i },
  { key: 'faint', re: /(faint(ed|ing)?|passed out|blacked out|collapsed)/i },
  { key: 'suicide', re: /(suicid|kill myself|end my life|want to die|self[- ]?harm|hurt myself)/i },
  { key: 'ed', re: /(purg(e|ing)|make myself (throw up|sick)|starv(e|ing) myself|binge and|not eating for days|laxatives? to lose)/i },
  { key: 'pregnancy', re: /(pregnan\w*.*(bleed|cramp|pain)|(bleed|cramp|pain).*pregnan)/i },
  { key: 'severe', re: /(worst headache|sudden (weakness|numbness)|face drooping|slurred speech|severe (pain|bleeding))/i },
];

export function redFlag(text) {
  const hit = RED_FLAGS.find((f) => f.re.test(text || ''));
  return hit ? hit.key : null;
}

export const SAFETY_RESPONSES = {
  chest: { title: 'Let\'s pause coaching', body: 'Chest pain or pressure needs medical attention right away. Stop any activity. If it is severe, spreading to your arm, jaw or back, or comes with sweating or shortness of breath, call emergency services now.', actions: ['Call 911', 'Find urgent care'] },
  breath: { title: 'Let\'s pause coaching', body: 'Trouble breathing needs medical attention. If it is sudden or severe, call emergency services now. Training is paused until you feel well.', actions: ['Call 911', 'Find urgent care'] },
  faint: { title: 'Let\'s pause coaching', body: 'Fainting should be checked by a clinician, especially during or after exercise. Sit or lie down, have some water, and do not train today. If you were injured or it happens again, seek care now.', actions: ['Call 911', 'Find urgent care'] },
  suicide: { title: 'You don\'t have to go through this alone', body: 'If you are thinking about suicide or hurting yourself, please reach out now. In the US you can call or text 988 (Suicide and Crisis Lifeline), any time. If you are in immediate danger, call 911.', actions: ['Call or text 988', 'Call 911'] },
  ed: { title: 'Let\'s talk to someone who can help', body: 'What you describe can be really hard, and you deserve support. I have turned off calorie targets. The ANAD helpline (1-888-375-7767) offers free support, and your doctor or a registered dietitian can help.', actions: ['Call ANAD helpline', 'Find a dietitian'] },
  pregnancy: { title: 'Please check in with your care team', body: 'Bleeding, cramping or pain during pregnancy should be checked by your midwife, obstetrician or urgent care today. If it is heavy or severe, call emergency services.', actions: ['Call 911', 'Find urgent care'] },
  severe: { title: 'Let\'s pause coaching', body: 'These symptoms can be a medical emergency. Call emergency services now or have someone take you to the nearest emergency department.', actions: ['Call 911', 'Find urgent care'] },
};

// Words Genie must never use as conclusions (F10.3); replies containing them are reworded.
const BLOCKLIST = /\b(diagnos\w*|you have (diabetes|anemia|depression|pcos|endometriosis)|abnormal|take \d+ ?mg|dose of|fertile|safe days|contracepti\w*)\b/i;

// ---------- F10.2 post-check: every number in the reply must be in the packet ----------
function numbersIn(s) {
  return (String(s).match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(',', '')));
}
export function postCheck(reply, packet, userText = '') {
  const allowed = new Set([...numbersIn(JSON.stringify(packet)), ...numbersIn(userText)]);
  const bad = numbersIn(reply).filter((n) => !(Math.abs(n) <= 12 && Number.isInteger(n)) && ![150, 250, 500, 1000, 30, 20, 15, 25, 45, 60, 90, 100].includes(n) && !allowed.has(n));
  if (BLOCKLIST.test(reply)) return { ok: false, reason: 'blocked wording' };
  return bad.length ? { ok: false, reason: `numbers not in packet: ${bad.slice(0, 4).join(', ')}` } : { ok: true };
}

// ---------- system rules for the model (stable, cacheable) ----------
export const GENIE_RULES = `You are Health Genie, the AI health coach inside the Health Track app. Coach one realistic habit at a time, warmly and briefly.
Rules you must follow:
- Use ONLY the numbers in the CONTEXT PACKET. Never invent or recompute a score, metric or value. Cite the user's own data in plain words ("your last 3 nights averaged 6 h 20 m").
- The engines choose the One Thing and the scores. You explain and word them; never change them.
- No diagnosis, no medication dosing, no contraception or fertility advice, no supplement megadoses. For supplements give safety-first education and say "check with your clinician".
- Never advise training through chest pain, dizziness or joint pain: tell them to stop and seek care.
- Cycle data appears only if it is in the packet; never use the words fertile or safe days.
- Describe lab links as association, never cause.
- Keep replies under 90 words, in short sentences, no markdown headings.
- You may propose ONE action when it clearly helps. Allowed actions: move_workout (to a weekday, today becomes a 20 min zone 2 walk), set_reminder (a time and a short text), log_water (ml). Actions are proposals the user must confirm.
Reply with ONLY a JSON object: {"reply": string, "chips": [{"label": string}] (0-3 short data chips quoting packet values, e.g. "6 h 20 m"), "action": null or {"type": "move_workout"|"set_reminder"|"log_water", "title": string, "detail": string, "params": object}, "quickReplies": [string, string] }`;

export function buildPrompt(packet, history, userText) {
  const turns = history.slice(-10).map((m) => ({ role: m.role, content: m.role === 'assistant' ? m.text : m.text }));
  return {
    system: GENIE_RULES,
    messages: [
      ...turns,
      { role: 'user', content: `CONTEXT PACKET (today's data, the only numbers you may use):\n${JSON.stringify(packet)}\n\nUSER MESSAGE: ${userText}` },
    ],
  };
}

// ---------- deterministic stub used when no AI is connected ----------
export function stubReply(packet, userText) {
  const t = (userText || '').toLowerCase();
  const p = packet;
  const chips = [];
  const say = (reply, extra = {}) => ({ reply, chips, action: null, quickReplies: ['Should I train today?', 'What should I eat tonight?'], ...extra });
  if (/(lift|train|workout|gym|run|exercise|session)/.test(t)) {
    if (p.readiness != null) chips.push({ label: `Readiness ${p.readiness}` });
    const v = p.trainingVerdict || 'As planned';
    if (/rest|lighter/i.test(v) || /(move|skip|reschedul|postpone|tomorrow)/.test(t)) {
      return say(`Readiness is ${p.readiness}, so today is a${v === 'As planned' ? 'n as-planned' : ' ' + v.toLowerCase()} day. ${p.sessionNote} Want me to move ${p.plannedSession || 'your session'} to ${p.nextTrainingDay}?`, {
        action: { type: 'move_workout', title: `Move ${p.plannedSession || 'session'} to ${p.nextTrainingDay}`, detail: 'Today becomes a 20 min zone 2 walk', params: { to: p.nextTrainingDay } },
      });
    }
    if (p.energyNow != null) chips.push({ label: `Energy ${p.energyNow}` });
    const when = p.energyNow == null ? '' : p.energyGoodUntil ? ` Your energy stays above 50 until about ${p.energyGoodUntil}, so the best time for it is before then.` : ` Your energy is ${p.energyNow} now, so keep it easy and earlier rather than later.`;
    return say(`Readiness is ${p.readiness}, so today is a${v === 'As planned' ? 'n as-planned' : ' ' + v.toLowerCase()} day. ${p.sessionNote}${when}`);
  }
  if (/(stress|draining|drained|tired|energy|exhausted)/.test(t) && (p.stressDay != null || p.energyNow != null)) {
    if (p.energyNow != null) chips.push({ label: `Energy ${p.energyNow}` });
    if (p.stressDay != null) chips.push({ label: `Stress ${p.stressDay}` });
    const st = p.stressAm != null || p.stressPm != null ? `Your stress readings today are ${p.stressAm ?? '--'} at 9 AM and ${p.stressPm ?? '--'} at 3 PM (0 to 100, against your own normal). ` : '';
    const en = p.energyNow != null ? `Energy is ${p.energyNow} (${String(p.energyBand).toLowerCase()}): last night's sleep charged it, and time awake${p.stressPm > 50 || p.stressAm > 50 ? ', the stressful stretches' : ''} and any hard activity drained it. ` : '';
    return say(`${st}${en}A 10-minute walk or a few slow breaths after work helps, and getting to bed by ${p.windDown} recharges it for tomorrow.`);
  }
  if (/(eat|dinner|lunch|food|meal|protein|hungry)/.test(t)) {
    chips.push({ label: `${p.proteinSoFar} of ${p.proteinTarget} g protein` });
    const left = Math.max(0, p.proteinTarget - p.proteinSoFar);
    return say(`You have about ${left} g of protein left for today. A plate with a palm of lean protein, half vegetables and a fist of rice or potato fits well${p.allergies ? `, and skips ${p.allergies}` : ''}. Snap a photo when you eat and I will log it.`);
  }
  if (/(hrv|heart rate variability)/.test(t)) {
    if (p.hrvZ == null) return say(`HRV is the small variation between heartbeats. Higher than your own normal usually means you are well recovered. Your baseline is still building, so connect a wearable and give it 14 nights.`);
    chips.push({ label: `${p.hrvZ > 0 ? '+' : ''}${p.hrvZ} SD` });
    return say(`HRV is the small variation between heartbeats; higher than your normal usually means better recovery. Yours is ${p.hrvZ > 0 ? '+' : ''}${p.hrvZ} SD versus your own 30-day baseline, so we compare you only to you.`);
  }
  if (/(water|hydrat|drink)/.test(t)) {
    chips.push({ label: `${p.fluidMl} of ${p.waterTargetMl} ml` });
    return say(`You are at ${p.fluidMl} of ${p.waterTargetMl} ml today. A glass now and one with each meal gets you most of the way.`, {
      action: { type: 'log_water', title: 'Log 250 ml of water', detail: 'Adds a glass to today', params: { ml: 250 } },
    });
  }
  if (/(period|cycle|luteal|pms|cramp)/.test(t)) {
    if (!p.cycle) return say(`Cycle tracking is off, so I don't use any cycle data. You can turn it on in Profile, with its own consent.`);
    return say(`You are on cycle day ${p.cycle.day}, ${p.cycle.phase} phase (${p.cycle.label}). Your next period is expected around ${p.cycle.next}. ${p.cycle.normalNote || ''}`.trim());
  }
  if (/(lab|blood|ferritin|vitamin|cholesterol|foundation)/.test(t)) {
    if (!p.foundation) return say(`You haven't added a lab report yet. Upload a PDF in Profile, Foundation and labs, and I will read it with you; nothing is used until you confirm each value.`);
    return say(`Your Foundation score is ${p.foundation.score} from your ${p.foundation.date} report. ${p.foundation.worthALook ? `${p.foundation.worthALook} is worth a look; check with your clinician about what it means for you.` : 'Everything is in range.'}`);
  }
  if (/(remind|reminder)/.test(t)) {
    return say(`Sure. I can remind you at ${p.windDown} to start winding down.`, {
      action: { type: 'set_reminder', title: `Remind me at ${p.windDown}`, detail: 'Start your wind-down', params: { time: p.windDown, text: 'Start your wind-down' } },
    });
  }
  if (/(sleep|tired|flat|exhaust|energy|why|status|score|feel)/.test(t)) {
    if (p.avgSleep3) chips.push({ label: p.avgSleep3 });
    if (p.hrvZ != null) chips.push({ label: `${p.hrvZ > 0 ? '+' : ''}${p.hrvZ} SD` });
    const parts = [];
    if (p.avgSleep3) parts.push(`Your last 3 nights averaged ${p.avgSleep3}, against a need of ${p.sleepNeed}`);
    if (p.hrvZ != null) parts.push(`HRV is ${p.hrvZ > 0 ? '+' : ''}${p.hrvZ} SD from your normal`);
    if (p.lateCaffeineDays) parts.push(`caffeine landed late on ${p.lateCaffeineDays} of the last 7 days`);
    return say(`${parts.join(', ')}. Your status today is ${p.status ?? 'still building'}${p.band ? `, ${p.band}` : ''}. The biggest lever is your One Thing: ${p.oneThing}.`);
  }
  return say(`Today you are ${p.status != null ? `${p.status}, ${p.band}` : 'still building a baseline'}. Your One Thing is: ${p.oneThing}. Ask me why a number moved, whether to train, or what to eat.`);
}

export function toTextSummary(packet) {
  return [
    packet.status != null ? `Status ${packet.status} ${packet.band}` : 'Status building',
    packet.avgSleep3 ? `sleep ${packet.avgSleep3}` : null,
    packet.readiness != null ? `readiness ${packet.readiness}` : null,
  ].filter(Boolean).join(', ');
}

export { fmtHours };
