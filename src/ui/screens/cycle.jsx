import React, { useEffect, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Seg, Toggle, Back, Loading, Locked } from '../kit.jsx';
import { CycleDial } from '../viz.jsx';

const fmt = (d, o = { month: 'short', day: 'numeric' }) => new Date(d + 'T12:00').toLocaleDateString('en-US', o);
const PHASE_COPY = {
  Menstrual: 'Energy can dip. Lighter sessions are fine; iron-rich food helps.',
  Follicular: 'Often a good window for harder training as energy tends to rise.',
  Luteal: 'Resting heart rate and temperature usually rise a little. We adjust Recovery for this, so a small dip is not counted against you.',
  Late: 'Your period may be close. Sleep can be lighter; keep caffeine early.',
};

export function Cycle() {
  const { go, act, ent, call, bump } = useApp();
  const { data: c } = useLoad('cycle');
  const [lastStart, setLastStart] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  if (!c) return <Loading />;
  if (!c.enabled) return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <h1 className="page">Cycle tracking</h1>
      <div className="card">
        <p className="small" style={{ marginTop: 0 }}>Track periods and symptoms, see predictions, and let Recovery account for normal changes across your cycle. Optional, private, and deletable in one tap.</p>
        <div className="field"><label htmlFor="cy-last">When did your last period start?</label><input id="cy-last" type="date" className="input" value={lastStart} max={c.today} onChange={(e) => setLastStart(e.target.value)} /></div>
        <Btn block style={{ marginTop: 12 }} onClick={() => act('setCycle', { enabled: true, ...(lastStart ? { lastPeriodStart: lastStart } : {}) }, 'Cycle tracking on')}>Turn on cycle tracking</Btn>
      </div>
    </div>
  );
  const p = c.pred;
  const phaseKnown = c.phase && !['hormonal', 'menopause', 'pregnant'].includes(c.lifeStage);
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <div className="row between"><h1 className="page" style={{ margin: 0 }}>Cycle</h1><Btn sm onClick={() => go('cycle-log')}><Icon name="plus" size={16} />Log today</Btn></div>
      {p ? (
        <div className="card center">
          <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
            <CycleDial days={c.days} cd={p.CD} length={Math.max(p.Lhat, c.days.length)} windowFrom={p.windowFrom} windowTo={p.windowTo} predNext={p.next} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="xs muted">Day</div>
              <div className="num" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{p.CD}</div>
              {phaseKnown && <div className="small" style={{ fontWeight: 700 }}>{c.phase.phase}</div>}
              {phaseKnown && <div className="xs muted">{c.phase.label}</div>}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 6 }}>
            {[['Menstrual', 'var(--coral)'], ['Follicular', 'var(--teal)'], ['Luteal', 'var(--violet)']].map(([n, col]) => <span key={n} className="xs row" style={{ gap: 4 }}><i className="dot" style={{ background: col }} />{n}</span>)}
          </div>
        </div>
      ) : <div className="card"><p className="small" style={{ margin: 0 }}>Log your next period start and predictions will appear.</p></div>}
      {p && (
        <div className="card">
          <div className="xs muted">Next period</div>
          <h2 style={{ margin: '2px 0' }}>{fmt(p.windowFrom)} to {fmt(p.windowTo)}</h2>
          <div className="small muted">Most likely {fmt(p.next, { weekday: 'long', month: 'short', day: 'numeric' })} · {p.confidence} confidence from {p.cycles} cycle{p.cycles === 1 ? '' : 's'} (about {p.Lhat} days each)</div>
          <p className="xs muted" style={{ marginBottom: 0 }}>Predictions are estimates and can't be used for contraception or to plan or avoid pregnancy.</p>
        </div>
      )}
      {phaseKnown && ent?.cycleInsights !== false && <div className="card tint"><b className="small">{c.phase.phase} phase</b><p className="small muted" style={{ margin: '4px 0 0' }}>{PHASE_COPY[c.phase.phase]}</p>{c.recoveryNote && <p className="small" style={{ marginBottom: 0 }}>{c.recoveryNote}</p>}</div>}
      {ent?.cycleInsights === false && <Locked what="Cycle-aware recovery" />}
      {c.shift?.dRhr != null && (
        <div className="card flat small">
          <b>What your body shows</b>
          <div className="kv"><span>Resting HR, second half vs first half</span><b className="num">{c.shift.dRhr > 0 ? '+' : ''}{c.shift.dRhr} bpm</b></div>
          {c.shift.dh != null && <div className="kv"><span>Temperature shift</span><b className="num">{c.shift.dh > 0 ? '+' : ''}{c.shift.dh} °C</b></div>}
        </div>
      )}
      {c.notices.map((n, i) => <div key={i} className="notice info"><Icon name="info" /><div>{n}</div></div>)}
      <div className="card">
        <h3>Recent periods</h3>
        {c.periods.slice().reverse().slice(0, 6).map((x) => <div key={x.start} className="kv"><span>{fmt(x.start)} to {fmt(x.end)}</span><span className="muted">{Math.round((new Date(x.end) - new Date(x.start)) / 86400000) + 1} days</span></div>)}
      </div>
      <div className="card">
        <h3>Settings</h3>
        <div className="field"><label>Life stage</label>
          <div className="row wrap" style={{ gap: 6 }}>{[['none', 'Regular cycles'], ['hormonal', 'Hormonal birth control'], ['postpartum', 'After birth'], ['perimenopause', 'Perimenopause'], ['menopause', 'Menopause']].map(([v, l]) => <button key={v} className={`chip select ${c.lifeStage === v ? 'on' : ''}`} onClick={() => act('setCycle', { lifeStage: v }, 'Saved')}>{l}</button>)}</div></div>
        <div className="field" style={{ marginTop: 12 }}><label>Stored</label><Seg value={c.storage} onChange={(v) => act('setCycle', { storage: v }, v === 'device' ? 'Cycle data stays on this device' : 'Encrypted cloud backup on')} options={[['device', 'This device only'], ['cloud', 'Encrypted cloud']]} /></div>
        <div className="divider" />
        {!confirmDel ? <button className="link small" style={{ color: 'var(--coral)' }} onClick={() => setConfirmDel(true)}>Delete all cycle data</button> : (
          <div className="notice"><div style={{ flex: 1 }}><b>Delete all cycle data?</b><div className="xs">Periods, symptoms and predictions are removed for good.</div><div className="row" style={{ gap: 8, marginTop: 8 }}><Btn sm kind="danger" onClick={async () => { await act('deleteCycleData', {}, 'Cycle data deleted'); go('profile'); }}>Delete</Btn><Btn sm kind="plain" onClick={() => setConfirmDel(false)}>Cancel</Btn></div></div></div>
        )}
      </div>
    </div>
  );
}

export function CycleLog() {
  const { act, go } = useApp();
  const { data: c } = useLoad('cycle');
  const [date, setDate] = useState(null);
  const [flow, setFlow] = useState(0);
  const [sym, setSym] = useState({});
  useEffect(() => { if (c && date == null) { setDate(c.today); setFlow(c.todayFlow || 0); setSym(c.todaySymptoms || {}); } }, [c]);
  if (!c) return <Loading />;
  if (!c.enabled) return <><Back to="cycle" label="Cycle" /><p>Turn on cycle tracking first.</p><Btn onClick={() => go('cycle')}>Open cycle settings</Btn></>;
  return (
    <div className="stack">
      <Back to="cycle" label="Cycle" />
      <h1 className="page">Log your day</h1>
      <div className="field"><label htmlFor="cl-date">Date</label><input id="cl-date" type="date" className="input" value={date || ''} max={c.today} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Flow</label>
        <div className="scale">{c.flows.map((f, i) => <button key={f} className={flow === i ? 'on' : ''} onClick={() => setFlow(i)} style={{ fontSize: 12 }}>{f}</button>)}</div></div>
      <div className="field"><label>Symptoms</label>
        {c.symptomsList.map((s) => (
          <div key={s.key} className="row between" style={{ padding: '6px 0' }}>
            <span className="small">{s.label}</span>
            <div className="seg" style={{ padding: 3, width: 190 }}>{['None', 'Mild', 'Strong'].map((l, k) => <button key={l} className={(sym[s.key] || 0) === k ? 'on' : ''} style={{ height: 30 }} onClick={() => setSym({ ...sym, [s.key]: k })}>{l}</button>)}</div>
          </div>
        ))}
      </div>
      <Btn block onClick={async () => { await act('logCycleDay', { date, flow, symptoms: sym }, 'Saved'); go('cycle'); }}>Save</Btn>
      <p className="xs muted">Logging a flow of Light or more starts a new period if one isn't running.</p>
    </div>
  );
}
