import React, { useEffect, useMemo, useState } from 'react';
import { useApp, Icon, Btn, Toggle, Seg, asset, bandColor } from '../kit.jsx';
import { Ring, CountUp } from '../viz.jsx';
import { minToClock } from '../../engine/util.js';

const GOALS = ['Sleep better', 'More energy', 'Lose weight', 'Build strength', 'Manage stress', 'Eat better', 'Get fitter', 'Feel balanced'];
const STRUGGLES = ['I drink coffee late in the day', 'I sleep at odd times after shifts', 'I skip meals', 'I forget to drink water', 'I sit most of the day', 'I train hard without rest', 'I snack late at night'];
const ALLERGIES = ['Peanuts', 'Tree nuts', 'Dairy', 'Gluten', 'Shellfish', 'Eggs', 'Soy'];
const DIETS = [['none', 'No preference'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['pescatarian', 'Pescatarian'], ['halal', 'Halal'], ['kosher', 'Kosher']];
const CONSENTS = [['sleep', 'Sleep', 'moon', 'Nights, stages and timing'], ['heart', 'Heart', 'heart', 'Resting heart rate and HRV'], ['activity', 'Activity', 'pulse', 'Steps, workouts and heart-rate zones'], ['nutrition', 'Nutrition', 'leaf', 'Meals, water and caffeine you log']];

// Profile fields as onboarding answers, so a returning user edits what they gave before.
function answersFromProfile(p) {
  if (!p) return {};
  const o = {};
  for (const k of ['goals', 'struggles', 'name', 'dob', 'sex', 'heightCm', 'units', 'shiftWork', 'pregnant', 'activityLevel', 'workoutsPerWeek', 'usualMeals', 'allergies', 'diet', 'consents']) if (p[k] != null) o[k] = p[k];
  o.weightKg = p.weightKg ?? '';
  if (p.usualBedMin != null) o.bedtime = minToClock(p.usualBedMin);
  if (p.usualWakeMin != null) o.wake = minToClock(p.usualWakeMin);
  return o;
}

// Setup screens for a signed-in user: all of them, or only the ones they skipped (route params.only).
export function SetupEdit() {
  const { go, boot, refreshBoot, toast, params } = useApp();
  return <Onboarding edit={{ profile: boot?.profile, only: params?.only }} onDone={async () => { await refreshBoot(); toast('Saved'); go(params?.back || 'profile'); }} />;
}

export function Onboarding({ trialBilling, onDone, edit }) {
  const { call, info, go } = useApp();
  const DRAFT = 'ht-onboarding-draft';
  const draft = edit ? null : (() => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { return null; } })();
  const [step, setStep] = useState(draft?.step || 0);
  const [skipped, setSkipped] = useState(draft?.skipped || []);
  const [catalog, setCatalog] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [ob, setOb] = useState({
    goals: [], struggles: [], name: '', dob: '1992-05-14', sex: '', heightCm: 170, weightKg: '', units: 'metric',
    devices: [], phoneOnly: false, consents: { sleep: true, heart: true, activity: true, nutrition: true },
    bedtime: '23:00', wake: '07:00', shiftWork: false, pregnant: false,
    activityLevel: 'moderate', workoutsPerWeek: 3, usualMeals: 3, allergies: [], diet: 'none',
    cycle: null, typicalLength: 29, cycleStorage: 'device',
    checkin: { energy: 3, soreness: 2, stress: 3, mood: 3, sleepQuality: 3, sleepHours: 7 },
    ...(draft?.ob || {}),
    ...(edit ? answersFromProfile(edit.profile) : {}),
  });
  const set = (k, v) => setOb((o) => ({ ...o, [k]: v }));
  const toggleIn = (k, v, max = 99) => setOb((o) => ({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : o[k].length >= max ? o[k] : [...o[k], v] }));

  useEffect(() => { call('devicesCatalog').then(setCatalog).catch(() => setCatalog([])); }, []);
  useEffect(() => {
    if (!edit) return;
    call('devices').then((d) => { const ids = (d.devices || []).filter((x) => x.connected).map((x) => x.id); setOb((o) => ({ ...o, devices: ids, phoneOnly: ids.length === 0 })); }).catch(() => {});
    call('cycle').then((c) => { if (c?.enabled) setOb((o) => ({ ...o, cycle: 'yes' })); }).catch(() => {});
  }, []);

  const showCycle = ob.sex !== 'male';
  const steps = useMemo(() => {
    const all = ['goals', 'about', 'sources', 'consent', 'rhythm', 'routine', ...(showCycle ? ['cycle'] : [])];
    if (!edit) return [...all, 'checkin', 'reveal'];
    const only = Array.isArray(edit.only) && edit.only.length ? all.filter((k) => edit.only.includes(k)) : all;
    return [...(only.length ? only : all), 'save'];
  }, [showCycle]);
  const cur = steps[step];
  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  // keep progress so a person who leaves mid-way picks up where they stopped
  useEffect(() => { if (!edit && cur !== 'reveal') { try { localStorage.setItem(DRAFT, JSON.stringify({ step, skipped, ob })); } catch (e) {} } }, [step, skipped, ob]);
  const skip = () => { setSkipped((x) => [...new Set([...x, cur])]); next(); };
  const isLast = edit && step === steps.length - 2;
  const finishLater = () => { setSkipped((x) => [...new Set([...x, ...steps.slice(step, -1)])]); setStep(steps.length - 1); };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const canNext = {
    goals: ob.goals.length > 0,
    about: ob.name.trim() && ob.sex && ob.heightCm,
    sources: ob.devices.length > 0 || ob.phoneOnly,
    consent: true, rhythm: !!ob.bedtime && !!ob.wake, routine: true, cycle: ob.cycle != null, checkin: true,
  }[cur];

  async function finish() {
    setBusy(true); setErr(null);
    try {
      const filled = {
        ...ob,
        name: ob.name.trim() || 'Friend',
        sex: ob.sex || 'prefer_not',
        phoneOnly: ob.phoneOnly || ob.devices.length === 0,
        cycle: ob.cycle ?? 'later',
        setupSkipped: skipped.filter((k) => k !== 'checkin'),
      };
      const ci = skipped.includes('checkin') ? undefined : (filled.phoneOnly ? ob.checkin : { ...ob.checkin, sleepHours: undefined });
      await call('completeOnboarding', { ...filled, checkin: ci });
      try { localStorage.removeItem(DRAFT); } catch (e) {}
      await call('subscription', { op: 'startTrial', billing: trialBilling || 'yearly' });
      const t = await call('getToday');
      setResult(t);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }
  useEffect(() => { if (cur === 'reveal' && !result && !busy) finish(); }, [cur]);

  async function saveEdit(extraSkipped = []) {
    setBusy(true); setErr(null);
    try {
      const prev = edit.profile?.setupSkipped || [];
      const visited = steps.slice(0, -1);
      const nowSkipped = [...new Set([...skipped, ...extraSkipped])];
      const setupSkipped = [...new Set([...prev.filter((k) => !visited.includes(k)), ...nowSkipped])].filter((k) => k !== 'checkin');
      const done = (k) => !nowSkipped.includes(k);
      const patch = { setupSkipped };
      if (done('goals') && visited.includes('goals')) Object.assign(patch, { goals: ob.goals, struggles: ob.struggles });
      if (done('about') && visited.includes('about')) Object.assign(patch, { name: ob.name, dob: ob.dob, sex: ob.sex, heightCm: ob.heightCm, weightKg: ob.weightKg, units: ob.units });
      if (done('sources') && visited.includes('sources')) patch.devices = ob.phoneOnly ? [] : ob.devices;
      if (done('consent') && visited.includes('consent')) patch.consents = ob.consents;
      if (done('rhythm') && visited.includes('rhythm')) Object.assign(patch, { bedtime: ob.bedtime, wake: ob.wake, shiftWork: ob.shiftWork, pregnant: ob.pregnant });
      if (done('routine') && visited.includes('routine')) Object.assign(patch, { activityLevel: ob.activityLevel, workoutsPerWeek: ob.workoutsPerWeek, usualMeals: ob.usualMeals, allergies: ob.allergies, diet: ob.diet });
      if (done('cycle') && visited.includes('cycle')) Object.assign(patch, { cycle: ob.cycle, typicalLength: ob.typicalLength, cycleStorage: ob.cycleStorage });
      await call('updateSetup', patch);
      await onDone();
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  }
  useEffect(() => { if (cur === 'save' && !busy) saveEdit(); }, [cur]);

  const filtered = catalog.filter((d) => d.id !== 'phone' && d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="scroll noNav" style={{ paddingTop: 50 }}>
      {cur !== 'reveal' && cur !== 'save' && (
        <>
          <div className="row between">
            {step > 0 ? <button className="back" style={{ margin: 0, width: 80 }} onClick={back}><Icon name="back" size={18} />Back</button> : <span style={{ width: 80 }} />}
            <span className="logo-chip"><img src={asset('logo.png')} alt="Health Track" /></span>
            {edit
              ? <button className="link small" style={{ width: 80, textAlign: 'right' }} onClick={() => go('profile')}>Cancel</button>
              : <button className="link small" style={{ width: 80, textAlign: 'right' }} onClick={finishLater}>Finish later</button>}
          </div>
          <div className="xs muted" style={{ textAlign: 'center', marginTop: 6 }}>Step {step + 1} of {steps.length - 1}</div>
          <div className="steps-top" style={{ gridTemplateColumns: `repeat(${steps.length - 1}, 1fr)` }}>{steps.slice(0, -1).map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>
        </>
      )}

      <div className="rise" key={cur}>
        {cur === 'goals' && (
          <>
            <h1 className="page">What would you like to work on?</h1>
            <p className="muted">Pick up to 3. Health Genie will keep these in mind.</p>
            <div className="row wrap" style={{ margin: '14px 0 22px' }}>
              {GOALS.map((g) => <button key={g} className={`chip select ${ob.goals.includes(g) ? 'on' : ''}`} aria-pressed={ob.goals.includes(g)} onClick={() => toggleIn('goals', g, 3)}>{g}</button>)}
            </div>
            <h3 style={{ margin: '0 0 6px' }}>Anything that gets in the way?</h3>
            <p className="muted small">Optional. These shape your first One Thing.</p>
            <div className="row wrap" style={{ marginTop: 10 }}>
              {STRUGGLES.map((g) => <button key={g} className={`chip select ${ob.struggles.includes(g) ? 'on' : ''}`} aria-pressed={ob.struggles.includes(g)} onClick={() => toggleIn('struggles', g)}>{g}</button>)}
            </div>
          </>
        )}

        {cur === 'about' && (
          <>
            <h1 className="page">A little about you</h1>
            <p className="muted">Used for sleep need, energy targets and heart-rate zones. Never shared.</p>
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="field"><label htmlFor="ob-name">First name</label><input id="ob-name" className="input" value={ob.name} onChange={(e) => set('name', e.target.value)} placeholder="Your first name" autoComplete="given-name" /></div>
              <div className="field"><label htmlFor="ob-dob">Date of birth</label><input id="ob-dob" type="date" className="input" value={ob.dob} max="2012-01-01" onChange={(e) => set('dob', e.target.value)} /></div>
              <div className="field"><label>Sex (for physiology formulas)</label>
                <Seg value={ob.sex} onChange={(v) => set('sex', v)} options={[['female', 'Female'], ['male', 'Male'], ['prefer_not', 'Prefer not to say']]} />
              </div>
              <div className="field"><label>Units</label><Seg value={ob.units} onChange={(v) => set('units', v)} options={[['metric', 'kg and cm'], ['imperial', 'lb and in']]} /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="ob-h">Height ({ob.units === 'metric' ? 'cm' : 'in'})</label>
                  <input id="ob-h" className="input" inputMode="numeric" value={ob.units === 'metric' ? ob.heightCm : Math.round(ob.heightCm / 2.54)} onChange={(e) => set('heightCm', ob.units === 'metric' ? Number(e.target.value) : Math.round(Number(e.target.value) * 2.54))} /></div>
                <div className="field"><label htmlFor="ob-w">Weight ({ob.units === 'metric' ? 'kg' : 'lb'}), optional</label>
                  <input id="ob-w" className="input" inputMode="decimal" value={ob.weightKg === '' ? '' : ob.units === 'metric' ? ob.weightKg : Math.round(ob.weightKg * 2.2046)} onChange={(e) => set('weightKg', e.target.value === '' ? '' : ob.units === 'metric' ? Number(e.target.value) : Math.round((Number(e.target.value) / 2.2046) * 10) / 10)} /></div>
              </div>
              <p className="xs muted">Skipping weight is fine. We will use a safe estimate and never show calorie targets you did not ask for.</p>
            </div>
          </>
        )}

        {cur === 'sources' && (
          <>
            <h1 className="page">Where should your data come from?</h1>
            <p className="muted">Pick every device you wear. If two record the same thing, we pick the better one.</p>
            <div className="notice info" style={{ margin: '12px 0' }}><Icon name="info" /><div>In this demo, devices connect with <b>simulated data</b>. The real app links them through {info?.wearablesLabel || 'Open Wearables or Junction'}.</div></div>
            <div className="row" style={{ background: 'var(--glass-strong)', borderRadius: 14, padding: '0 12px', border: '1.5px solid var(--line)' }}>
              <Icon name="search" size={18} color="var(--muted)" />
              <input className="input" style={{ border: 0, background: 'transparent', paddingLeft: 4 }} placeholder="Search devices" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search devices" />
            </div>
            <div className="list" style={{ marginTop: 6 }}>
              {filtered.map((d) => {
                const on = ob.devices.includes(d.id);
                return (
                  <button key={d.id} className="item" onClick={() => { toggleIn('devices', d.id); set('phoneOnly', false); }} aria-pressed={on}>
                    <span className="ico" style={{ background: on ? 'var(--tint-violet)' : 'var(--surface2)', color: on ? 'var(--violet)' : 'var(--muted)' }}><Icon name={d.kind === 'ring' ? 'target' : d.kind === 'scale' ? 'ruler' : 'watch'} /></span>
                    <span style={{ flex: 1 }}><b>{d.name}</b><div className="xs muted">{[d.stages && 'sleep stages', d.hrv && 'HRV', d.temp && 'temperature', d.vo2 && 'VO2 max'].filter(Boolean).join(' · ') || 'activity'}</div></span>
                    <span className="ico" style={{ width: 28, height: 28, borderRadius: 99, background: on ? 'var(--violet)' : 'transparent', border: on ? 0 : '1.5px solid var(--line)', color: '#fff' }}>{on && <Icon name="check" size={16} />}</span>
                  </button>
                );
              })}
            </div>
            <button className={`pill-opt ${ob.phoneOnly ? 'on' : ''}`} style={{ width: '100%', marginTop: 12 }} onClick={() => { set('phoneOnly', !ob.phoneOnly); set('devices', []); }} aria-pressed={ob.phoneOnly}>
              <div className="row"><Icon name="phone" /><b>No wearable, just my phone</b></div>
              <div className="small muted" style={{ marginTop: 4 }}>We estimate sleep from phone use and ask a 20-second morning check-in. Everything still works.</div>
            </button>
          </>
        )}

        {cur === 'consent' && (
          <>
            <h1 className="page">You choose what we read</h1>
            <p className="muted">Change any of these later in Profile. Turning one off only removes that pillar.</p>
            <div className="card" style={{ marginTop: 14 }}>
              <div className="list">
                {CONSENTS.map(([k, name, icon, desc]) => (
                  <div className="item" key={k}>
                    <span className="ico" style={{ background: 'var(--surface2)' }}><Icon name={icon} /></span>
                    <span style={{ flex: 1 }}><b>{name}</b><div className="xs muted">{desc}</div></span>
                    <Toggle on={ob.consents[k]} label={name} onChange={(v) => set('consents', { ...ob.consents, [k]: v })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="notice info" style={{ marginTop: 14 }}><Icon name="shield" /><div>Health data is encrypted, never sold, and never used for advertising. Health Genie only sees a summary of your numbers.</div></div>
          </>
        )}

        {cur === 'rhythm' && (
          <>
            <h1 className="page">Your usual rhythm</h1>
            <p className="muted">We learn your real sleep need over 2 weeks. This is a starting point.</p>
            <div className="grid2" style={{ marginTop: 16 }}>
              <div className="field"><label htmlFor="ob-bed">Usual bedtime</label><input id="ob-bed" type="time" className="input" value={ob.bedtime} onChange={(e) => set('bedtime', e.target.value)} /></div>
              <div className="field"><label htmlFor="ob-wake">Usual wake time</label><input id="ob-wake" type="time" className="input" value={ob.wake} onChange={(e) => set('wake', e.target.value)} /></div>
            </div>
            <div className="card flat" style={{ marginTop: 16 }}>
              <div className="row between"><span><b>I work shifts</b><div className="xs muted">Nights or rotating hours. We anchor to your main sleep, not the clock.</div></span><Toggle on={ob.shiftWork} label="Shift work" onChange={(v) => set('shiftWork', v)} /></div>
              {ob.sex !== 'male' && <>
                <div className="divider" />
                <div className="row between"><span><b>I am pregnant</b><div className="xs muted">Turns off weight-loss and intensity nudges.</div></span><Toggle on={ob.pregnant} label="Pregnant" onChange={(v) => set('pregnant', v)} /></div>
              </>}
            </div>
          </>
        )}

        {cur === 'routine' && (
          <>
            <h1 className="page">Your routine and food</h1>
            <div className="stack" style={{ marginTop: 14 }}>
              <div className="field"><label>How active are you on a typical day?</label>
                <Seg value={ob.activityLevel} onChange={(v) => set('activityLevel', v)} options={[['low', 'Mostly sitting'], ['moderate', 'Some walking'], ['high', 'On my feet']]} /></div>
              <div className="field"><label>Workouts a week</label>
                <div className="scale" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>{[0, 1, 2, 3, 4, 5].map((n) => <button key={n} className={ob.workoutsPerWeek === n ? 'on' : ''} onClick={() => set('workoutsPerWeek', n)}>{n === 5 ? '5+' : n}</button>)}</div></div>
              <div className="field"><label>Meals a day</label>
                <div className="scale" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>{[2, 3, 4, 5].map((n) => <button key={n} className={ob.usualMeals === n ? 'on' : ''} onClick={() => set('usualMeals', n)}>{n}</button>)}</div></div>
              <div className="field"><label>Allergies (we never suggest these)</label>
                <div className="row wrap">{ALLERGIES.map((a) => <button key={a} className={`chip select ${ob.allergies.includes(a) ? 'on' : ''}`} aria-pressed={ob.allergies.includes(a)} onClick={() => toggleIn('allergies', a)}>{a}</button>)}</div></div>
              <div className="field"><label>Eating style</label>
                <div className="row wrap">{DIETS.map(([v, l]) => <button key={v} className={`chip select ${ob.diet === v ? 'on' : ''}`} aria-pressed={ob.diet === v} onClick={() => set('diet', v)}>{l}</button>)}</div></div>
            </div>
          </>
        )}

        {cur === 'cycle' && (
          <>
            <h1 className="page">Do you have periods you would like to track?</h1>
            <p className="muted">Optional. It helps us read your recovery fairly, because temperature and resting heart rate shift across a cycle.</p>
            <div className="col" style={{ marginTop: 14 }}>
              {[['yes', 'Yes, track my cycle'], ['no', 'No'], ['later', 'Not now, ask me later']].map(([v, l]) => (
                <button key={v} className={`pill-opt ${ob.cycle === v ? 'on' : ''}`} aria-pressed={ob.cycle === v} onClick={() => set('cycle', v)}><b>{l}</b></button>
              ))}
            </div>
            {ob.cycle === 'yes' && (
              <div className="card flat rise" style={{ marginTop: 14 }}>
                <div className="field"><label htmlFor="ob-len">Typical cycle length (days)</label><input id="ob-len" className="input" inputMode="numeric" value={ob.typicalLength} onChange={(e) => set('typicalLength', Number(e.target.value) || '')} /></div>
                <div className="field" style={{ marginTop: 12 }}><label>Where to keep cycle data</label>
                  <Seg value={ob.cycleStorage} onChange={(v) => set('cycleStorage', v)} options={[['device', 'This device only'], ['cloud', 'Encrypted cloud']]} /></div>
                <p className="xs muted" style={{ marginTop: 8 }}>You can delete all cycle data in one tap at any time. In the demo we add a few simulated past periods so predictions show.</p>
              </div>
            )}
          </>
        )}

        {cur === 'checkin' && (
          <>
            <h1 className="page">Your first check-in</h1>
            <p className="muted">20 seconds. This gives you a status today, before any data syncs.</p>
            <CheckinFields value={ob.checkin} onChange={(c) => set('checkin', c)} phoneOnly={ob.phoneOnly} />
          </>
        )}

        {cur === 'save' && (
          <div className="center" style={{ paddingTop: 60 }}>
            {err ? <><p className="muted">{err}</p><Btn onClick={() => saveEdit()}>Try again</Btn></> : <p className="muted">Saving your changes...</p>}
          </div>
        )}
        {cur === 'reveal' && <Reveal result={result} busy={busy} err={err} retry={finish} onDone={onDone} name={ob.name} />}
      </div>

      {cur !== 'reveal' && cur !== 'save' && (
        <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, paddingBottom: 8, marginTop: 20, background: 'linear-gradient(180deg, transparent, var(--bg) 40%)' }}>
          <Btn block disabled={!canNext} onClick={next}>{cur === 'checkin' ? 'See my status' : isLast ? 'Save changes' : 'Continue'}</Btn>
          <Btn block kind="plain" style={{ marginTop: 8, height: 44, background: 'transparent' }} onClick={skip}>Skip, come back later</Btn>
        </div>
      )}
    </div>
  );
}

const SCALES = [
  ['energy', 'Energy', ['Drained', 'Low', 'OK', 'Good', 'Great']],
  ['soreness', 'Soreness', ['None', 'Light', 'Some', 'Sore', 'Very sore']],
  ['stress', 'Stress', ['Calm', 'Low', 'Some', 'High', 'Very high']],
  ['mood', 'Mood', ['Low', 'Meh', 'OK', 'Good', 'Great']],
];

export function CheckinFields({ value, onChange, phoneOnly, showSleep = true }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="stack" style={{ marginTop: 14 }}>
      {SCALES.map(([k, label, words]) => (
        <div className="field" key={k}>
          <label>{label}: <span style={{ color: 'var(--violet)' }}>{words[(value[k] || 3) - 1]}</span></label>
          <div className="scale" role="radiogroup" aria-label={label}>{[1, 2, 3, 4, 5].map((n) => <button key={n} role="radio" aria-checked={value[k] === n} className={value[k] === n ? 'on' : ''} onClick={() => set(k, n)}>{n}</button>)}</div>
        </div>
      ))}
      {showSleep && (
        <div className="field">
          <label>How did you sleep?</label>
          <div className="scale" role="radiogroup" aria-label="Sleep quality">{['😫', '😕', '😐', '🙂', '😴'].map((e, i) => <button key={i} role="radio" aria-checked={value.sleepQuality === i + 1} className={value.sleepQuality === i + 1 ? 'on' : ''} onClick={() => set('sleepQuality', i + 1)} aria-label={`Sleep quality ${i + 1} of 5`}>{e}</button>)}</div>
        </div>
      )}
      {phoneOnly && (
        <div className="field"><label htmlFor="ci-h">Hours slept: <span style={{ color: 'var(--violet)' }}>{value.sleepHours} h</span></label>
          <input id="ci-h" type="range" min="3" max="11" step="0.25" value={value.sleepHours || 7} onChange={(e) => set('sleepHours', Number(e.target.value))} style={{ accentColor: 'var(--violet)' }} /></div>
      )}
      <button className={`chip select ${value.flags?.includes('unwell') ? 'on' : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => set('flags', value.flags?.includes('unwell') ? [] : ['unwell'])} aria-pressed={!!value.flags?.includes('unwell')}>🤒 I feel unwell today</button>
    </div>
  );
}

function Reveal({ result, busy, err, retry, onDone, name }) {
  if (err) return <div style={{ paddingTop: 80 }}><h1 className="page">Something went wrong</h1><p className="err">{err}</p><Btn onClick={retry}>Try again</Btn></div>;
  if (!result) return (
    <div className="center" style={{ paddingTop: 120 }}>
      <div className="orb" style={{ width: 140, height: 140 }} />
      <h2>Setting things up{name ? `, ${name}` : ''}</h2>
      <p className="muted">Reading your check-in and building today's plan</p>
    </div>
  );
  const t = result;
  return (
    <div className="center" style={{ paddingTop: 60 }}>
      <span className="chip violet">Your first Wellness Status</span>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0 12px' }}>
        <Ring value={t.status} size={210} stroke={18}>
          <div className="num" style={{ fontSize: 56, fontWeight: 800 }}>{t.status != null ? <CountUp to={t.status} /> : '--'}</div>
          <div style={{ fontWeight: 700, color: bandColor(t.band?.name) }}>{t.band?.name || 'Building'}</div>
        </Ring>
      </div>
      <span className="chip amber">Confidence: {t.confidence}</span>
      <p className="muted" style={{ margin: '14px 8px' }}>{t.eligible ? 'This first number leans on your check-in. It gets sharper every day as data comes in.' : 'We need a little more data for a full status. Your check-in and One Thing still work today.'}</p>
      {t.oneThing && (
        <div className="card" style={{ textAlign: 'left', marginTop: 10 }}>
          <div className="eyebrow">Your first One Thing</div>
          <h3 style={{ marginTop: 4 }}>{t.oneThing.title}</h3>
          <p className="small muted" style={{ margin: 0 }}>{t.oneThing.why}</p>
        </div>
      )}
      <Btn block style={{ marginTop: 20 }} disabled={busy} onClick={onDone}>Go to Today</Btn>
    </div>
  );
}
