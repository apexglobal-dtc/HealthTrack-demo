import React, { useEffect, useRef, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Toggle, Seg, Back, Loading, ErrorBox, Locked, SimBadge, clock, dayName } from '../kit.jsx';
import { Ring, CountUp, Gauge, Spark, CapsuleBars } from '../viz.jsx';

const VERDICT_CHIP = { push: 'green', planned: 'teal', lighter: 'amber', rest: 'coral' };

export function Train() {
  const { go, act, ent } = useApp();
  const { data: d, error } = useLoad('train');
  const [override, setOverride] = useState(false);
  if (ent && ent.train === false) return <><Back to="progress" label="Progress" /><Locked what="Train" /></>;
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  if (!d.plan) return (
    <div className="stack">
      <Back to="progress" label="Progress" />
      <h1 className="page">Train</h1>
      <div className="card tint"><h3>Build your plan</h3><p className="small muted">Tell us your goal, days and time. Each day the plan flexes with your readiness.</p><Btn onClick={() => go('train-setup')}>Set up training</Btn></div>
    </div>
  );
  const s = d.session;
  return (
    <div className="stack">
      <Back to="progress" label="Progress" />
      <div className="row between"><h1 className="page" style={{ margin: 0 }}>Train</h1><button className="link small" onClick={() => go('train-setup')}>Edit plan</button></div>

      <div className="card rise">
        <div className="row between">
          <span className="eyebrow">Today · readiness {d.readiness ?? '--'}</span>
          {!s.rest && <span className={`chip ${VERDICT_CHIP[s.verdict.code]}`}>{s.verdict.verdict}</span>}
        </div>
        {s.rest ? (
          <><h2 style={{ margin: '8px 0 4px' }}>Rest day</h2><p className="small muted">{s.subtitle || 'Recovery is when the gains happen. A walk or mobility counts.'}</p><Btn sm kind="secondary" onClick={() => go('live')}>Start a walk</Btn></>
        ) : (
          <>
            <h2 style={{ margin: '8px 0 4px' }}>{s.title} · {s.minutes} min</h2>
            <p className="small muted" style={{ marginTop: 0 }}>{s.verdict.note}</p>
            <div className="list">
              {s.exercises.map((e) => (
                <div key={e.id} className="item">
                  <span className="ico" style={{ background: e.done >= e.sets ? 'var(--tint-green)' : 'var(--surface2)', color: e.done >= e.sets ? 'var(--green)' : 'var(--muted)' }}><Icon name={e.done >= e.sets ? 'check' : 'dumbbell'} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="small">{e.name}</b>
                    <div className="xs muted">{e.sets} × {e.reps[0]}–{e.reps[1]} · {e.rir[0]}–{e.rir[1]} in reserve{e.load ? ` · ${e.load} kg` : ''}</div>
                    {e.loadReason && <div className="xs" style={{ color: e.change === 'up' ? 'var(--green)' : 'var(--muted)' }}>{e.change === 'up' ? '↑ ' : ''}{e.loadReason}</div>}
                  </div>
                  <span className="xs num muted">{e.done}/{e.sets}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <Btn sm onClick={() => go('logger')}><Icon name="play" size={16} />Start session</Btn>
              <Btn sm kind="plain" onClick={() => setOverride(!override)}>Change today</Btn>
            </div>
          </>
        )}
        {override && (
          <div className="row wrap rise" style={{ gap: 6, marginTop: 10 }}>
            {[['push', 'Push'], ['planned', 'As planned'], ['lighter', 'Lighter'], ['rest', 'Rest']].map(([c, l]) => <button key={c} className={`chip select ${s.verdict?.code === c ? 'on' : ''}`} onClick={async () => { await act('overrideSession', { code: c }, `Today set to ${l}`); setOverride(false); }}>{l}</button>)}
          </div>
        )}
      </div>

      <div className="grid2">
        <button className="tile" onClick={() => go('fitness')}>
          <span className="xs muted">Fitness Score</span>
          <b className="num" style={{ fontSize: 30 }}>{d.fitness.FS ?? '--'}</b>
          <span className="xs muted">VO2 max {d.fitness.vo2?.value ?? '--'} · {d.fitness.confidence}</span>
        </button>
        <button className="tile" onClick={() => go('load')}>
          <span className="xs muted">Load balance</span>
          <b className="num" style={{ fontSize: 30 }}>{d.load.acwr ?? '--'}</b>
          <span className="xs muted">{d.load.acwr == null ? 'Building' : d.load.acwr < 0.8 ? 'Room to build' : d.load.acwr <= 1.3 ? 'Sweet spot' : 'Spiking, ease in'}</span>
        </button>
      </div>

      {d.deload.deload && <div className="notice"><Icon name="info" /><div><b>Time for a lighter week.</b> {d.deload.signals.filter((x) => x.fired).map((x) => x.label).join('; ')}. Cut sets by about 40% this week.</div></div>}

      <div className="card">
        <div className="row between"><h3>Weekly sets per muscle</h3><span className="xs muted">target {d.weeklySetTarget}</span></div>
        <CapsuleBars items={Object.entries(d.groupSets).map(([k, v]) => ({ label: k.slice(0, 3), v }))} target={d.weeklySetTarget} fmt={(v) => v ?? 0} />
      </div>

      <div className="card">
        <div className="row between"><h3>This week</h3><button className="link small" onClick={() => go('history')}>History</button></div>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div className="center"><b className="num" style={{ fontSize: 22 }}>{d.weekSummary.sessions}</b><div className="xs muted">sessions</div></div>
          <div className="center"><b className="num" style={{ fontSize: 22 }}>{d.weekSummary.minutes}</b><div className="xs muted">minutes</div></div>
          <div className="center"><b className="num" style={{ fontSize: 22 }}>{d.load.zoneMin?.['3'] ?? 0}</b><div className="xs muted">zone 2 min</div></div>
        </div>
      </div>

      <div className="card">
        <h3>Heart-rate zones</h3>
        <p className="xs muted" style={{ marginTop: 0 }}>Max {d.zones.hrmax} bpm {d.zones.observed ? '(seen in your workouts)' : '(age estimate)'} · resting {d.zones.rest} bpm</p>
        {d.zones.zones.map((z) => (
          <div key={z.z} className="kv"><span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: ['var(--faint)', 'var(--blue)', 'var(--teal)', 'var(--amber)', 'var(--coral)'][z.z - 1] }} />{z.name}</span><b className="num">{z.from}–{z.to}</b></div>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Btn sm kind="secondary" onClick={() => go('live')}><Icon name="timer" size={16} />Live workout</Btn>
        <Btn sm kind="plain" onClick={() => go('workout-new')}><Icon name="plus" size={16} />Add a workout</Btn>
      </div>
      <p className="xs muted">Protein for your goal: {d.plan.proteinGPerKg} g per kg a day. Stop any set that causes sharp pain.</p>
    </div>
  );
}

export function SetLogger() {
  const { call, go, toast, bump } = useApp();
  const { data: d, reload } = useLoad('train');
  const [i, setI] = useState(0);
  const [load, setLoad] = useState('');
  const [reps, setReps] = useState(10);
  const [rir, setRir] = useState(2);
  const [pain, setPain] = useState(false);
  const [rest, setRest] = useState(0);
  const [last, setLast] = useState(null);
  const ex = d?.session?.exercises?.[i];
  useEffect(() => { if (ex) { setLoad(ex.load ?? (ex.id === 'pushup' ? 0 : '')); setReps(ex.reps[1] - 2); setPain(false); } }, [ex?.id]);
  useEffect(() => { if (rest <= 0) return; const t = setTimeout(() => setRest((r) => r - 1), 1000); return () => clearTimeout(t); }, [rest]);
  if (!d) return <div style={{ padding: 50 }}><Loading /></div>;
  if (!ex) return <div style={{ padding: '50px 20px' }}><Back to="train" label="Train" /><p>No session planned today.</p></div>;
  const exs = d.session.exercises;
  const allDone = exs.every((e) => e.done >= e.sets);
  return (
    <div style={{ padding: '50px 20px 30px' }} className="stack">
      <div className="row between"><button className="back" style={{ margin: 0 }} onClick={() => go('train')}><Icon name="back" size={18} />Train</button><span className="small muted">{d.session.title}</span></div>
      <div className="row" style={{ gap: 6, overflowX: 'auto' }}>
        {exs.map((e, k) => <button key={e.id} className={`chip select ${k === i ? 'on' : ''}`} onClick={() => setI(k)}>{e.done >= e.sets ? '✓ ' : ''}{e.name}</button>)}
      </div>
      <div className="card center rise" key={ex.id}>
        <div className="eyebrow">Set {Math.min(ex.done + 1, ex.sets)} of {ex.sets}</div>
        <h2 style={{ margin: '4px 0' }}>{ex.name}</h2>
        <div className="xs muted">{ex.reps[0]}–{ex.reps[1]} reps · leave {ex.rir[0]}–{ex.rir[1]} in reserve{ex.last ? ` · last time ${ex.last}` : ''}</div>
        <div className="grid2" style={{ marginTop: 16, textAlign: 'left' }}>
          <div className="field"><label htmlFor="sl-load">Load (kg)</label>
            <div className="row" style={{ gap: 4 }}><button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setLoad((x) => Math.max(0, (Number(x) || 0) - 2.5))} aria-label="Less load">−</button><input id="sl-load" className="input num" style={{ textAlign: 'center', padding: 0 }} inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} /><button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setLoad((x) => (Number(x) || 0) + 2.5)} aria-label="More load">+</button></div></div>
          <div className="field"><label htmlFor="sl-reps">Reps</label>
            <div className="row" style={{ gap: 4 }}><button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setReps((x) => Math.max(1, x - 1))} aria-label="Fewer reps">−</button><input id="sl-reps" className="input num" style={{ textAlign: 'center', padding: 0 }} inputMode="numeric" value={reps} onChange={(e) => setReps(Number(e.target.value) || 0)} /><button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setReps((x) => x + 1)} aria-label="More reps">+</button></div></div>
        </div>
        <div className="field" style={{ marginTop: 12, textAlign: 'left' }}><label>Reps left in the tank</label>
          <div className="scale">{[0, 1, 2, 3, 4].map((n) => <button key={n} className={rir === n ? 'on' : ''} onClick={() => setRir(n)}>{n === 4 ? '4+' : n}</button>)}</div></div>
        <div className="row between" style={{ marginTop: 12 }}><span className="small">Pain (not just effort)?</span><Toggle on={pain} onChange={setPain} label="Pain during set" /></div>
        <Btn block style={{ marginTop: 14 }} onClick={async () => {
          const r = await call('logSet', { exercise: ex.id, load: Number(load) || 0, reps, rir, pain });
          setLast(r); bump(); await reload(); setRest(ex.id === 'pushup' ? 60 : 90);
          if (pain) toast('Pain noted. We will hold this lift at the current load.');
          else toast(`Set saved · estimated max ${r.e1rm} kg`);
          if (ex.done + 1 >= ex.sets && i < exs.length - 1) setI(i + 1);
        }}>Log set</Btn>
      </div>
      {rest > 0 && (
        <div className="card row rise" style={{ gap: 14 }}>
          <Ring value={(rest / 90) * 100} size={64} stroke={7} color="var(--teal)"><b className="num">{rest}</b></Ring>
          <div style={{ flex: 1 }}><b>Rest</b><div className="xs muted">Breathe. Next set when the timer ends.</div></div>
          <Btn sm kind="plain" onClick={() => setRest(0)}>Skip</Btn>
        </div>
      )}
      {allDone && <div className="card tint center rise"><div style={{ fontSize: 40 }}>💪</div><h3>Session complete</h3><p className="small muted">Nice work. It counts toward your Activity and Fitness scores.</p><Btn onClick={() => go('train')}>Done</Btn></div>}
    </div>
  );
}

export function LiveActivity() {
  const { act, go } = useApp();
  const [type, setType] = useState('Walking');
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  const [hr, setHr] = useState(88);
  const [rpe, setRpe] = useState(5);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSec((s) => s + 1);
      setHr((h) => { const target = type === 'Running' ? 152 : type === 'Cycling' ? 140 : type === 'Strength' ? 118 : 108; return Math.round(h + (target - h) * 0.08 + (Math.random() - 0.5) * 4); });
    }, 1000);
    return () => clearInterval(t);
  }, [running, type]);
  const zone = hr < 108 ? ['Light', 'var(--faint)'] : hr < 133 ? ['Moderate', 'var(--blue)'] : hr < 147 ? ['Zone 2', 'var(--teal)'] : hr < 171 ? ['Vigorous', 'var(--amber)'] : ['Max', 'var(--coral)'];
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(170deg, #0F2A5C, #0B1430)', color: '#fff', padding: '56px 22px 30px', display: 'flex', flexDirection: 'column' }}>
      <div className="row between"><button onClick={() => go('train')} style={{ color: '#fff' }} className="row"><Icon name="back" size={18} />Exit</button><span className="badge sim">Simulated heart rate</span></div>
      {!running && sec === 0 && (
        <div className="row wrap" style={{ gap: 6, marginTop: 20 }}>{['Walking', 'Running', 'Cycling', 'Strength', 'Yoga'].map((t) => <button key={t} className="chip" style={{ background: type === t ? '#fff' : 'rgba(255,255,255,.12)', color: type === t ? '#0F2A5C' : '#fff' }} onClick={() => setType(t)}>{t}</button>)}</div>
      )}
      <div className="center" style={{ marginTop: 40 }}>
        <div style={{ opacity: 0.7 }}>{type}</div>
        <div className="num" style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-.03em' }}>{mm}:{ss}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 10 }}>
          <Icon name="heart" color="#FF7A6B" fill="#FF7A6B" style={{ animation: running ? 'breathe 0.8s infinite' : 'none' }} />
          <span className="num" style={{ fontSize: 34, fontWeight: 800 }}>{running || sec ? hr : '--'}</span><span style={{ opacity: 0.7 }}>bpm</span>
        </div>
        {(running || sec > 0) && <span className="chip" style={{ marginTop: 12, background: zone[1], color: '#fff' }}>{zone[0]}</span>}
      </div>
      <div className="spacer" />
      {done ? (
        <div className="card" style={{ color: 'var(--text)' }}>
          <h3>How hard was that?</h3>
          <div className="scale" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginTop: 8 }}>{[2, 4, 5, 7, 9].map((n) => <button key={n} className={rpe === n ? 'on' : ''} onClick={() => setRpe(n)}>{n}</button>)}</div>
          <div className="row between xs muted" style={{ marginTop: 4 }}><span>easy</span><span>all out</span></div>
          <Btn block style={{ marginTop: 12 }} onClick={async () => { await act('logWorkout', { type, minutes: Math.max(1, Math.round(sec / 60)), rpe, source: 'healthtrack' }, 'Workout saved'); go('train'); }}>Save workout</Btn>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'center', gap: 24 }}>
          <button onClick={() => setRunning(!running)} style={{ width: 84, height: 84, borderRadius: 99, background: running ? '#FFB547' : '#3DDC97', color: '#0B1430', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label={running ? 'Pause' : 'Start'}><Icon name={running ? 'pause' : 'play'} size={32} fill="#0B1430" /></button>
          {sec > 0 && <button onClick={() => { setRunning(false); setDone(true); }} style={{ width: 84, height: 84, borderRadius: 99, background: '#FF7A6B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Finish"><Icon name="stop" size={28} fill="#fff" /></button>}
        </div>
      )}
    </div>
  );
}

export function WorkoutHistory() {
  const { act } = useApp();
  const { data: d } = useLoad('train');
  if (!d) return <Loading />;
  const list = d.history.slice(0, 30);
  return (
    <div className="stack">
      <Back to="train" label="Train" />
      <h1 className="page">Workout history</h1>
      <div className="card">
        <div className="list">
          {list.map((w) => (
            <div key={w.id} className="item">
              <span className="ico" style={{ background: w.strength ? 'var(--tint-teal)' : 'var(--tint-green)', color: w.strength ? 'var(--teal)' : 'var(--green)' }}><Icon name={w.strength ? 'dumbbell' : 'pulse'} size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">{w.type}{w.distanceKm ? ` · ${w.distanceKm} km` : ''}</b>
                <div className="xs muted">{dayName(w.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {w.minutes} min{w.avgHr ? ` · avg ${w.avgHr} bpm` : ''}{w.workingSets ? ` · ${w.workingSets} sets` : ''}</div>
              </div>
              {w.simulated ? <SimBadge /> : <span className="badge">{w.source === 'manual' ? 'Manual' : 'Health Track'}</span>}
              {!w.simulated && <button className="icon-btn" style={{ width: 30, height: 30, boxShadow: 'none' }} aria-label="Delete workout" onClick={() => act('deleteWorkout', { id: w.id }, 'Workout deleted')}><Icon name="trash" size={14} /></button>}
            </div>
          ))}
        </div>
      </div>
      <p className="xs muted">When two devices record the same workout, we keep the one with heart-rate data.</p>
    </div>
  );
}

export function ManualWorkout() {
  const { act, go } = useApp();
  const [w, setW] = useState({ type: 'Walking', minutes: 30, rpe: 4, start: '18:00', distanceKm: '', notes: '' });
  const set = (k, v) => setW((x) => ({ ...x, [k]: v }));
  return (
    <div className="stack">
      <Back to="train" label="Train" />
      <h1 className="page">Add a workout</h1>
      <div className="row wrap" style={{ gap: 6 }}>{['Walking', 'Running', 'Cycling', 'Swimming', 'Strength', 'Yoga', 'Sports', 'Other'].map((t) => <button key={t} className={`chip select ${w.type === t ? 'on' : ''}`} onClick={() => set('type', t)}>{t}</button>)}</div>
      <div className="grid2">
        <div className="field"><label htmlFor="mw-start">Start</label><input id="mw-start" type="time" className="input" value={w.start} onChange={(e) => set('start', e.target.value)} /></div>
        <div className="field"><label htmlFor="mw-min">Minutes</label><input id="mw-min" className="input" inputMode="numeric" value={w.minutes} onChange={(e) => set('minutes', e.target.value)} /></div>
      </div>
      {['Walking', 'Running', 'Cycling', 'Swimming'].includes(w.type) && <div className="field"><label htmlFor="mw-km">Distance (km, optional)</label><input id="mw-km" className="input" inputMode="decimal" value={w.distanceKm} onChange={(e) => set('distanceKm', e.target.value)} /></div>}
      <div className="field"><label>Effort (1 easy to 10 all out): {w.rpe}</label><input type="range" min="1" max="10" value={w.rpe} onChange={(e) => set('rpe', Number(e.target.value))} style={{ accentColor: 'var(--violet)' }} aria-label="Effort" /></div>
      <div className="field"><label htmlFor="mw-notes">Notes</label><input id="mw-notes" className="input" value={w.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      <Btn block disabled={!Number(w.minutes)} onClick={async () => { await act('logWorkout', w, 'Workout added'); go('train'); }}>Save workout</Btn>
    </div>
  );
}

export function FitnessScore() {
  const { act, toast } = useApp();
  const { data: d, reload } = useLoad('train');
  const [test, setTest] = useState(null);
  const [v, setV] = useState({ value: 2400, minutes: 15, endHr: 130 });
  if (!d) return <Loading />;
  const f = d.fitness;
  return (
    <div className="stack">
      <Back to="train" label="Train" />
      <h1 className="page">Fitness Score</h1>
      <div className="card center">
        <Ring value={f.FS} size={170} stroke={14} color="var(--teal)"><div className="num" style={{ fontSize: 46, fontWeight: 800 }}><CountUp to={f.FS ?? 0} /></div><div className="xs muted">{f.confidence} confidence</div></Ring>
        <div className="grid3" style={{ marginTop: 14 }}>
          {[['Cardio', f.CRF, '40%'], ['Strength', f.STR, '30%'], ['Consistency', f.CONS, '30%']].map(([n, x, w]) => <div key={n}><b className="num" style={{ fontSize: 22 }}>{x ?? '--'}</b><div className="xs muted">{n} · {w}</div></div>)}
        </div>
      </div>
      <div className="card small">
        <div className="kv"><span>VO2 max</span><b>{f.vo2?.value ?? '--'} ml/kg/min</b></div>
        <div className="kv"><span>Source</span><b>{f.vo2?.source ?? '--'} ({f.vo2?.confidence})</b></div>
        <div className="kv"><span>Fitness level</span><b>{f.mets ?? '--'} METs</b></div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Cardio percentile uses an approximation for now. Licensed FRIEND reference tables come later.</p>
      </div>
      {f.lifts?.length > 0 && (
        <div className="card">
          <h3>Strength trend (estimated max)</h3>
          {f.lifts.map((l) => <div key={l.id} className="row" style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}><span className="small" style={{ flex: 1 }}>{l.name}</span><Spark values={l.trend} color="var(--teal)" w={80} h={26} /><b className="num small" style={{ width: 70, textAlign: 'right', color: l.pct >= 0 ? 'var(--green)' : 'var(--coral)' }}>{l.pct >= 0 ? '+' : ''}{l.pct}%</b></div>)}
        </div>
      )}
      <div className="card">
        <h3>Test your fitness</h3>
        <p className="xs muted" style={{ marginTop: 0 }}>A field test makes your cardio number more accurate. Only do it on a day you feel well.</p>
        <Seg value={test} onChange={setTest} options={[['cooper', '12-min run'], ['rockport', '1-mile walk']]} />
        {test === 'cooper' && <div className="field" style={{ marginTop: 10 }}><label htmlFor="ft-m">Distance covered in 12 minutes (m)</label><input id="ft-m" className="input" inputMode="numeric" value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} /></div>}
        {test === 'rockport' && <div className="grid2" style={{ marginTop: 10 }}><div className="field"><label htmlFor="ft-min">Time (min)</label><input id="ft-min" className="input" inputMode="decimal" value={v.minutes} onChange={(e) => setV({ ...v, minutes: e.target.value })} /></div><div className="field"><label htmlFor="ft-hr">Heart rate at finish</label><input id="ft-hr" className="input" inputMode="numeric" value={v.endHr} onChange={(e) => setV({ ...v, endHr: e.target.value })} /></div></div>}
        {test && <Btn sm style={{ marginTop: 10 }} onClick={async () => { const r = await act('logFitnessTest', { method: test, ...v }); toast(`VO2 max estimate: ${r.vo2}`); reload(); }}>Save result</Btn>}
        {d.tests.length > 0 && <div className="xs muted" style={{ marginTop: 10 }}>{d.tests.map((t) => `${t.date}: ${t.method}, ${t.vo2}`).join(' · ')}</div>}
      </div>
    </div>
  );
}

export function LoadBalance() {
  const { data: d } = useLoad('train');
  if (!d) return <Loading />;
  const l = d.load;
  return (
    <div className="stack">
      <Back to="train" label="Train" />
      <h1 className="page">Training load</h1>
      <div className="card center">
        {l.acwr != null ? <Gauge value={l.acwr} /> : <p className="muted">Needs 3 weeks of data</p>}
        <div className="num" style={{ fontSize: 32, fontWeight: 800 }}>{l.acwr ?? '--'}</div>
        <div className="small">{l.acwr == null ? '' : l.acwr < 0.8 ? 'Below your usual: room to build' : l.acwr <= 1.3 ? 'Sweet spot: this week matches what you are used to' : 'A spike: add load more slowly'}</div>
        <p className="xs muted">This week's load divided by your 4-week average. 0.8 to 1.3 is the sweet spot.</p>
      </div>
      <div className="card small">
        <div className="kv"><span>This week (acute)</span><b className="num">{l.acute}</b></div>
        <div className="kv"><span>4-week average (chronic)</span><b className="num">{l.chronic}</b></div>
        <div className="kv"><span>Monotony</span><b className="num">{l.monotony}</b></div>
        <div className="kv"><span>Strain</span><b className="num">{l.strain}</b></div>
        <div className="kv"><span>Intensity mix (LIS)</span><b className="num">{l.LIS}</b></div>
      </div>
      <div className="card">
        <h3>Daily load, 4 weeks</h3>
        <CapsuleBars items={l.daily.map((v, i) => ({ label: '', v }))} labels={false} fmt={(v) => v} />
      </div>
      <div className="card">
        <h3>Deload check</h3>
        {d.deload.signals.map((s) => <div key={s.key} className="kv"><span>{s.label}</span><b style={{ color: s.fired ? 'var(--coral)' : 'var(--green)' }}>{s.fired ? 'Yes' : 'No'}</b></div>)}
        <p className="xs muted" style={{ marginBottom: 0 }}>Two or more signals suggest a lighter week.</p>
      </div>
    </div>
  );
}

export function TrainingSetup() {
  const { act, go } = useApp();
  const { data: d } = useLoad('train');
  const [c, setC] = useState(null);
  useEffect(() => { if (d && !c) setC({ goal: d.plan?.goal || 'general', days: d.plan?.days || 3, minutes: d.plan?.minutes || 45, experience: d.plan?.experience || 'novice', equipment: d.plan?.equipment || ['gym'], injuries: d.plan?.injuries || '', screen: { chest: false, dizzy: false, bone: false, meds: false, heart: false } }); }, [d]);
  if (!c) return <Loading />;
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const screenQs = [['heart', 'A doctor said I have a heart condition'], ['chest', 'I get chest pain with activity'], ['dizzy', 'I lose balance from dizziness or faint'], ['bone', 'I have a bone or joint problem made worse by activity'], ['meds', 'I take medicine for blood pressure or a heart condition']];
  const flagged = Object.values(c.screen).some(Boolean);
  return (
    <div className="stack">
      <Back to="train" label="Train" />
      <h1 className="page">Your training plan</h1>
      <div className="field"><label>Main goal</label><div className="row wrap" style={{ gap: 6 }}>{[['general', 'General fitness'], ['muscle', 'Build muscle'], ['strength', 'Get stronger'], ['endurance', 'Endurance'], ['sport', 'Sport']].map(([v, l]) => <button key={v} className={`chip select ${c.goal === v ? 'on' : ''}`} onClick={() => set('goal', v)}>{l}</button>)}</div></div>
      <div className="field"><label>Days a week</label><div className="scale" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>{[2, 3, 4].map((n) => <button key={n} className={c.days === n ? 'on' : ''} onClick={() => set('days', n)}>{n}</button>)}</div></div>
      <div className="field"><label>Minutes per session</label><div className="scale" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>{[20, 30, 45, 60].map((n) => <button key={n} className={c.minutes === n ? 'on' : ''} onClick={() => set('minutes', n)}>{n}</button>)}</div></div>
      <div className="field"><label>Experience</label><Seg value={c.experience} onChange={(v) => set('experience', v)} options={[['novice', 'New'], ['intermediate', 'Some'], ['advanced', 'Lots']]} /></div>
      <div className="field"><label htmlFor="ts-inj">Injuries or limits (optional)</label><input id="ts-inj" className="input" value={c.injuries} onChange={(e) => set('injuries', e.target.value)} placeholder="e.g. sore left knee" /></div>
      <div className="card flat">
        <h3>Safety check</h3>
        <p className="xs muted" style={{ marginTop: 0 }}>Tick any that apply.</p>
        {screenQs.map(([k, q]) => <label key={k} className="row small" style={{ padding: '6px 0' }}><input type="checkbox" checked={c.screen[k]} onChange={(e) => set('screen', { ...c.screen, [k]: e.target.checked })} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} />{q}</label>)}
        {flagged && <div className="notice" style={{ marginTop: 8 }}><Icon name="shield" /><div>Please check with your doctor before hard exercise. Until then your plan stays light to moderate.</div></div>}
      </div>
      <Btn block onClick={async () => { await act('setTrainingGoal', c, 'Plan saved'); go('train'); }}>Save plan</Btn>
    </div>
  );
}
