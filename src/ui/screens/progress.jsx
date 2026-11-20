import React, { useEffect, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, ErrorBox, PILLAR } from '../kit.jsx';
import { Ring, CountUp, Spark } from '../viz.jsx';

export function Progress() {
  const { go, ent } = useApp();
  const { data: p, error } = useLoad('progress');
  if (error) return <ErrorBox error={error} />;
  if (!p) return <Loading />;
  const cells = p.cells.slice(-84);
  return (
    <div className="stack">
      <div className="rise"><div className="eyebrow">Progress</div><h1 className="page">Small steps, adding up</h1></div>

      <button className="card tap row rise" style={{ textAlign: 'left', gap: 16 }} onClick={() => go('review')}>
        <Ring value={p.momentum} size={96} stroke={10}><b className="num" style={{ fontSize: 26 }}><CountUp to={p.momentum} /></b></Ring>
        <div style={{ flex: 1 }}>
          <div className="xs muted">Momentum</div>
          <b>{p.momentum >= 80 ? 'Strong and steady' : p.momentum >= 60 ? 'Building' : 'Getting going'}</b>
          <div className="xs muted" style={{ marginTop: 4 }}>{p.rate7}% of One Things done this week · best streak {p.bestStreak} days</div>
          <span className="link xs">Open your weekly review →</span>
        </div>
      </button>

      {p.focus && (
        <div className="card rise" style={{ animationDelay: '.05s' }}>
          <div className="row between"><b>Focus habit</b><span className="chip violet" style={{ fontSize: 12 }}>Day {p.focus.day} of {p.focus.of}</span></div>
          <h3 style={{ margin: '8px 0 4px' }}>{p.focus.title}</h3>
          <div className="xs muted">Done {p.focus.doneThisWeek} of 7 this week. 5 of 7 for 2 weeks makes it automatic.</div>
          <div className="col" style={{ marginTop: 12, gap: 8 }}>
            {p.focus.weeks.map((w, i) => (
              <div key={i} className="streak">{w.map((d) => <i key={d.date} className={d.outcome || 'missed'} title={`${d.date}: ${d.outcome || 'no entry'}`}>{d.outcome === 'done' ? '✓' : ''}</i>)}</div>
            ))}
          </div>
        </div>
      )}

      <div className="card rise" style={{ animationDelay: '.1s' }}>
        <div className="row between"><h3>Last 12 weeks</h3><span className="xs muted">{p.doneN} done · {p.graduatedN} habit{p.graduatedN === 1 ? '' : 's'} graduated</span></div>
        <div className="heat" style={{ marginTop: 10 }} role="img" aria-label="One Thing calendar for the last 12 weeks">
          {cells.map((c, i) => <i key={c.date} className={c.v ? `v${c.v}` : ''} style={{ animationDelay: `${i * 6}ms` }} title={c.date} />)}
        </div>
        <div className="row xs muted" style={{ marginTop: 8, gap: 6 }}>Less <i className="dot" style={{ background: 'var(--track)' }} /><i className="dot" style={{ background: 'color-mix(in srgb, var(--violet) 22%, var(--track))' }} /><i className="dot" style={{ background: 'color-mix(in srgb, var(--violet) 55%, var(--track))' }} /><i className="dot" style={{ background: 'var(--violet)' }} /> More</div>
      </div>

      {p.graduated.length > 0 && (
        <div className="card flat">
          <div className="xs muted" style={{ marginBottom: 6 }}>Graduated habits 🎓</div>
          {p.graduated.map((g) => <div key={g.actionId} className="row small"><Icon name="check" size={16} color="var(--green)" />{g.title}</div>)}
        </div>
      )}

      <button className="card tap" style={{ textAlign: 'left' }} onClick={() => go('goals')}>
        <div className="row between"><h3>Your goals</h3><Icon name="chev" /></div>
        {p.goalsRows.map((g) => (
          <div key={g.goal} style={{ marginTop: 10 }}>
            <div className="row between small"><span>{g.goal}</span><span className="xs muted">{g.done} of {g.of} days on track</span></div>
            <div className="progressbar" style={{ marginTop: 4 }}><i style={{ width: `${(g.done / g.of) * 100}%`, background: PILLAR[g.pillar]?.color }} /></div>
          </div>
        ))}
      </button>

      <div className="grid2">
        <button className="tile" onClick={() => go(ent?.train === false ? 'plans' : 'train')}>
          <span className="ico" style={{ background: 'var(--tint-teal)', color: 'var(--teal)', width: 34, height: 34 }}><Icon name={ent?.train === false ? 'lock' : 'dumbbell'} size={18} /></span>
          <b>Train</b><span className="xs muted">Plan, sets, fitness score</span>
        </button>
        <div className="tile">
          <span className="ico" style={{ background: 'var(--tint-green)', color: 'var(--green)', width: 34, height: 34 }}><Icon name="pulse" size={18} /></span>
          <b>Steps, 30 days</b>
          <Spark values={p.steps30.map((s) => s.v)} color="var(--green)" w={130} h={34} />
        </div>
      </div>

      <div className="card">
        <h3>Fitness ladder</h3>
        <p className="xs muted" style={{ marginTop: 0 }}>One rung at a time. Each unlocks when the one below is steady.</p>
        <div className="ladder">
          {p.ladder.map((r, i) => (
            <div key={r.id} className={`rung ${r.state}`}>
              <span className="ico" style={{ width: 34, height: 34, background: r.state === 'done' ? 'var(--green)' : r.state === 'current' ? 'var(--violet)' : 'var(--track)', color: '#fff', borderRadius: 99 }}>{r.state === 'done' ? <Icon name="check" size={16} /> : r.state === 'locked' ? <Icon name="lock" size={14} /> : i + 1}</span>
              <div><b className="small">{r.title}</b><div className="xs muted">{r.rule}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ALL_GOALS = ['Sleep better', 'More energy', 'Lose weight', 'Build strength', 'Manage stress', 'Eat better', 'Get fitter', 'Feel balanced'];
const ALL_STRUGGLES = ['I drink coffee late in the day', 'I sleep at odd times after shifts', 'I skip meals', 'I forget to drink water', 'I sit most of the day', 'I train hard without rest', 'I snack late at night'];

export function Goals() {
  const { act, go } = useApp();
  const { data: p } = useLoad('progress');
  const [g, setG] = useState(null);
  const [s, setS] = useState(null);
  useEffect(() => { if (p && !g) { setG(p.goals); setS(p.struggles); } }, [p]);
  if (!g) return <Loading />;
  const tog = (arr, set, v, max = 99) => set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.length >= max ? arr : [...arr, v]);
  return (
    <div className="stack">
      <Back to="progress" label="Progress" />
      <h1 className="page">Your goals</h1>
      <p className="muted" style={{ marginTop: -6 }}>Up to 3. Changing them changes what your One Thing focuses on.</p>
      <div className="row wrap">{ALL_GOALS.map((x) => <button key={x} className={`chip select ${g.includes(x) ? 'on' : ''}`} aria-pressed={g.includes(x)} onClick={() => tog(g, setG, x, 3)}>{x}</button>)}</div>
      <h3 style={{ margin: '10px 0 0' }}>What gets in the way</h3>
      <div className="row wrap">{ALL_STRUGGLES.map((x) => <button key={x} className={`chip select ${s.includes(x) ? 'on' : ''}`} aria-pressed={s.includes(x)} onClick={() => tog(s, setS, x)}>{x}</button>)}</div>
      <Btn block disabled={!g.length} onClick={async () => { await act('updateGoals', { goals: g, struggles: s }, 'Goals updated'); go('progress'); }}>Save goals</Btn>
    </div>
  );
}

export function WeeklyReview() {
  const { go } = useApp();
  const { data: p } = useLoad('progress');
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  const cards = p?.weekly?.cards || [];
  useEffect(() => {
    if (!cards.length) return;
    setTick(0);
    const t = setInterval(() => setTick((x) => { if (x >= 100) { setI((k) => Math.min(cards.length - 1, k + 1)); return 0; } return x + 2; }), 100);
    return () => clearInterval(t);
  }, [i, cards.length]);
  if (!p) return <Loading />;
  const c = cards[i];
  const emoji = { Win: '🏆', Pattern: '🔍', 'Next week': '🎯', Focus: '✨' }[c?.type] || '✨';
  return (
    <div className="story" onClick={(e) => { const x = e.clientX - e.currentTarget.getBoundingClientRect().left; setI((k) => (x < e.currentTarget.clientWidth / 3 ? Math.max(0, k - 1) : Math.min(cards.length - 1, k + 1))); }}>
      <div className="segs">{cards.map((_, k) => <i key={k}><b style={{ width: k < i ? '100%' : k === i ? `${tick}%` : '0%' }} /></i>)}</div>
      <div className="row between"><span style={{ opacity: 0.8 }}>Your week in review</span><button onClick={(e) => { e.stopPropagation(); go('progress'); }} style={{ color: '#fff' }} aria-label="Close"><Icon name="x" /></button></div>
      {c && (
        <div key={i} className="rise" style={{ marginTop: 60 }}>
          <div style={{ fontSize: 64 }}>{emoji}</div>
          <div style={{ textTransform: 'uppercase', letterSpacing: '.1em', fontSize: 13, opacity: 0.7, marginTop: 10 }}>{c.type}</div>
          <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: '8px 0 14px' }}>{c.title}</h1>
          <p style={{ fontSize: 17, opacity: 0.88, lineHeight: 1.5 }}>{c.body}</p>
        </div>
      )}
      <div className="spacer" />
      <div className="xs" style={{ opacity: 0.6 }}>{p.weekly.generatedBy}. Tap the right side to go on.</div>
    </div>
  );
}
