// Foundation score and lab report reading (PRD v4 section 6.3).
// Lab results never change the morning status. Ranges: lab reference intervals plus
// physician-approved "optimal" bands. The optimal bands below are demo placeholders
// that the clinical advisory board must sign off before launch.

import { round, daysBetween, mean } from './util.js';

export const MARKERS = [
  { key: 'hba1c', name: 'HbA1c', unit: '%', loinc: '4548-4', ref: [4.0, 5.6], opt: [4.5, 5.3], lowerBetter: true,
    aliases: ['hba1c', 'hemoglobin a1c', 'a1c', 'glycated hemoglobin'], about: 'Your average blood sugar over the last 2 to 3 months.' },
  { key: 'glucose', name: 'Fasting glucose', unit: 'mg/dL', loinc: '1558-6', ref: [70, 99], opt: [75, 90],
    aliases: ['fasting glucose', 'glucose, fasting', 'glucose'], about: 'Blood sugar after not eating overnight.' },
  { key: 'apob', name: 'ApoB', unit: 'mg/dL', loinc: '1884-6', ref: [0, 130], opt: [0, 90], lowerBetter: true,
    aliases: ['apob', 'apolipoprotein b', 'apo b'], about: 'The number of cholesterol-carrying particles that can enter artery walls.' },
  { key: 'ldl', name: 'LDL cholesterol', unit: 'mg/dL', loinc: '13457-7', ref: [0, 129], opt: [0, 100], lowerBetter: true,
    aliases: ['ldl cholesterol', 'ldl-c', 'ldl chol calc', 'ldl'], about: 'Cholesterol carried in LDL particles.' },
  { key: 'hdl', name: 'HDL cholesterol', unit: 'mg/dL', loinc: '2085-9', ref: [40, 200], opt: [50, 90],
    aliases: ['hdl cholesterol', 'hdl-c', 'hdl'], about: 'Cholesterol carried in HDL particles.' },
  { key: 'tg', name: 'Triglycerides', unit: 'mg/dL', loinc: '2571-8', ref: [0, 149], opt: [0, 100], lowerBetter: true,
    aliases: ['triglycerides', 'triglyceride', 'trig'], about: 'Fats in the blood, sensitive to recent meals, alcohol and activity.' },
  { key: 'crp', name: 'hs-CRP', unit: 'mg/L', loinc: '30522-7', ref: [0, 3.0], opt: [0, 1.0], lowerBetter: true,
    aliases: ['hs-crp', 'hscrp', 'c-reactive protein, high sensitivity', 'c reactive protein', 'crp'], about: 'A general marker of inflammation in the body.' },
  { key: 'ferritin', name: 'Ferritin', unit: 'ng/mL', loinc: '2276-4', ref: [15, 150], opt: [40, 150],
    aliases: ['ferritin'], about: 'Your iron stores.' },
  { key: 'vitd', name: 'Vitamin D, 25-OH', unit: 'ng/mL', loinc: '1989-3', ref: [30, 100], opt: [35, 60],
    aliases: ['vitamin d, 25-hydroxy', '25-hydroxy vitamin d', 'vitamin d 25', '25(oh)d', 'vitamin d'], about: 'Your vitamin D level.' },
];

export const markerByKey = (k) => MARKERS.find((m) => m.key === k);

export function markerStatus(m, v) {
  if (v >= m.opt[0] && v <= m.opt[1]) return { word: 'Optimal', points: 100 };
  if (v >= m.ref[0] && v <= m.ref[1]) return { word: 'In range', points: 75 };
  return { word: 'Worth a look', points: 40 };
}

// Rule-based reader for lab report text. Used on its own when no AI is connected and as
// a cross-check of AI extraction. Every value still needs the user's confirmation (DATA-06).
export function parseLabText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const found = [];
  const dateMatch = text.match(/(?:collected|collection date|date collected|drawn|reported)[^0-9]{0,20}(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  let testDate = null;
  if (dateMatch) {
    const s = dateMatch[1];
    if (s.includes('-')) testDate = s;
    else {
      const [mm, dd, yy] = s.split('/').map(Number);
      const y = yy < 100 ? 2000 + yy : yy;
      testDate = `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  for (const m of MARKERS) {
    for (let i = 0; i < lines.length; i++) {
      const low = lines[i].toLowerCase();
      const alias = m.aliases.find((a) => low.includes(a));
      if (!alias) continue;
      if (m.key === 'glucose' && /a1c/.test(low)) continue;
      if (m.key === 'ldl' && /hdl/.test(low) && !/ldl/.test(low.split('hdl')[0])) continue;
      if (m.key === 'crp' && found.find((f) => f.key === 'crp')) continue;
      const rest = (lines[i].slice(low.indexOf(alias) + alias.length) + ' ' + (lines[i + 1] || '')).replace(/,/g, '');
      const num = rest.match(/(-?\d+(?:\.\d+)?)/);
      if (!num) continue;
      const v = Number(num[1]);
      if (Number.isNaN(v)) continue;
      const snippet = lines[i].slice(0, 90);
      const plausible = v > m.ref[0] * 0.2 - 1 && v < (m.ref[1] || 10) * 6;
      found.push({ key: m.key, name: m.name, value: v, unit: m.unit, loinc: m.loinc, snippet, confidence: plausible ? 0.9 : 0.5 });
      break;
    }
  }
  // de-duplicate ApoB vs LDL text matches
  return { testDate, markers: found };
}

export function foundationScore(labs, today, extras = {}) {
  // labs: [{key, value, date, confirmed}]
  const latest = {};
  for (const l of labs.filter((x) => x.confirmed)) {
    if (!latest[l.key] || l.date > latest[l.key].date) latest[l.key] = l;
  }
  const rows = Object.values(latest).map((l) => {
    const m = markerByKey(l.key);
    const st = markerStatus(m, l.value);
    return { ...l, name: m.name, unit: m.unit, ref: m.ref, opt: m.opt, status: st.word, points: st.points, about: m.about };
  });
  const pts = rows.map((r) => r.points);
  // Body and fitness markers that also feed Foundation
  if (extras.rhrTrend != null) pts.push(extras.rhrTrend <= 0 ? 90 : extras.rhrTrend <= 3 ? 75 : 55);
  if (extras.crf != null) pts.push(Math.max(40, Math.min(100, 40 + extras.crf * 0.6)));
  if (!rows.length) return { score: null, rows, confidence: 'None', ageMonths: null };
  const newest = rows.map((r) => r.date).sort().slice(-1)[0];
  const ageMonths = round(daysBetween(newest, today) / 30.4, 1);
  // Confidence fades as results age (PRD 6.3)
  const confidence = ageMonths <= 6 && rows.length >= 5 ? 'High' : ageMonths <= 12 ? 'Medium' : 'Low';
  return { score: round(mean(pts)), rows, confidence, ageMonths, testDate: newest, panelCoverage: `${rows.length} of ${MARKERS.length}` };
}

export const SAMPLE_LAB_TEXT = `QUEST-STYLE SAMPLE REPORT (demo, not a real patient)
Patient: Demo User      Collected: 2026-10-02      Reported: 2026-10-04
COMPREHENSIVE PANEL
Test                         Result    Flag   Reference range   Units
Hemoglobin A1c               5.4              4.0-5.6           %
Glucose, Fasting             92               70-99             mg/dL
Cholesterol, Total           188              <200              mg/dL
LDL Cholesterol              112       H      <100              mg/dL
HDL Cholesterol              58               >39               mg/dL
Triglycerides                96               <150              mg/dL
Apolipoprotein B             88               <90               mg/dL
hs-CRP                       1.4              <3.0              mg/L
Ferritin                     31               15-150            ng/mL
Vitamin D, 25-Hydroxy        27        L      30-100            ng/mL
`;
