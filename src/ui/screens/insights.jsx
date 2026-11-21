import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, ErrorBox, Locked, SimBadge, PILLAR, bandColor, confColor, fmtH, clock, dayName } from '../kit.jsx';
import { Ring, CountUp, BandSpark, Spark, SleepWindows, ContributionStack, CutoffTimeline, CapsuleBars, SegRing } from '../viz.jsx';

export function Insights() {
  const { go } = useApp();
  const { data: d, error } = useLoad('insights');
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  const route = { sleep: 'sleep', recovery: 'recovery', activity: 'load', nutrition: 'nutrition', hydration: 'water', fitness: 'fitness', biomarkers: 'labs' };
  return (
    <div className="stack">
      <div className="rise"><div className="eyebrow">Insights</div><h1 className="page">How you are doing</h1></div>
      <div className="rise" style={{ animationDelay: '.05s', borderRadius: 24, padding: 12, background: 'linear-gradient(140deg, var(--tint-violet), var(--tint-teal))', border: '1px solid var(--line)' }}>
      <div className="row between" style={{ padding: '0 4px 10px' }}><b className="small">Today at a glance</b><span className="xs muted">Status and readiness</span></div>
      <div className="grid2">
        <button className="card tap" style={{ textAlign: 'left' }} onClick={() => go('status')}>
          <div className="xs muted">Wellness Status</div>
          <div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{d.status ?? '--'}</div>
          <Spark values={d.statusSeries.map((p) => p.v)} w={130} h={34} />
          <div className="xs link" style={{ marginTop: 4 }}>How it is made</div>
        </button>
        <div className="card">
          <div className="xs muted">Readiness to train</div>
          <div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{d.readiness ?? '--'}</div>
          <div className="small">{d.readinessLine}</div>
          <span className={`chip ${confColor(d.confidence)}`} style={{ marginTop: 6, fontSize: 11, padding: '2px 8px' }}>{d.confidence}</span>
        </div>
      </div>
      </div>
      <div className="row between" style={{ padding: '4px 4px 0' }}><b className="small">Your trackers</b></div>
      <div className="grid2">
        {d.tiles.map((tl, i) => {
          const P = PILLAR[tl.key];
          const locked = (tl.key === 'fitness' && !d.entitlements.train) || (tl.key === 'biomarkers' && !d.entitlements.labs);
          return (
            <button key={tl.key} className="tile rise" style={{ animationDelay: `${0.08 + i * 0.04}s` }} onClick={() => go(locked ? 'plans' : route[tl.key])}>
              <div className="row between">
                <span className="ico" style={{ background: P.tint, color: P.color, width: 34, height: 34 }}><Icon name={locked ? 'lock' : P.icon} size={18} /></span>
                <span className="badge">{tl.source}</span>
              </div>
              <span className="small muted">{tl.name}</span>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}><b className="num" style={{ fontSize: 26 }}>{tl.score ?? '--'}</b></div>
              <div className="progressbar"><i style={{ width: `${tl.score ?? 0}%`, background: P.color }} /></div>
              <span className="xs muted">{tl.detail}</span>
            </button>
          );
        })}
      </div>
      <div className="card">
        <h3>Last 14 days</h3>
        <BandSpark points={d.statusSeries} band={[65, 79]} color="var(--violet)" />
        <p className="xs muted">The shaded band is Steady (65 to 79).</p>
      </div>
    </div>
  );
}

export function StatusExplained() {
  const { data: d } = useLoad('insights');
  if (!d) return <Loading />;
  const e = d.explained;
  return (
    <div className="stack">
      <Back to="insights" />
      <h1 className="page">How your status is made</h1>
      <div className="card center">
        <SegRing parts={e.rows.filter((r) => r.eff > 0).map((r, _, a) => ({ w: r.eff / a.reduce((x, y) => x + y.eff, 0), v: r.score ?? 0, color: PILLAR[r.key].color }))} size={190}>
          <div className="num" style={{ fontSize: 44, fontWeight: 800 }}><CountUp to={e.status ?? 0} /></div>
          <div className="xs muted">of 100</div>
        </SegRing>
        <p className="xs muted" style={{ marginTop: 6 }}>Each arc's length is the tracker's weight; how full it is shows its score.</p>
        <p className="small" style={{ marginTop: 6 }}>Five trackers, each scored 0 to 100. Each one counts for a set share of your status (the % next to it), and the shares add up to 100%. When a tracker has partial data, its share shrinks instead of us guessing.</p>
        <ContributionStack rows={e.rows} />
      </div>
      <div className="card">
        <div className="list">
          {e.rows.map((r) => (
            <div key={r.key} className="item" style={{ alignItems: 'flex-start' }}>
              <span className="ico" style={{ background: PILLAR[r.key].tint, color: PILLAR[r.key].color }}><Icon name={PILLAR[r.key].icon} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between"><b>{r.name}</b><span className="num"><b>{r.score ?? '--'}</b> <span className="xs muted" title="This tracker's share of your status">counts {Math.round(r.eff * 100)}%</span></span></div>
                <div className="xs muted">{r.driver}</div>
                {r.eff < r.w && <div className="xs" style={{ color: 'var(--amber)' }}>Counts {Math.round(r.eff * 100)}% instead of {Math.round(r.w * 100)}% because data is partial</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card flat small">
        <div className="kv"><span>Raw weighted score</span><b className="num">{e.raw}</b></div>
        <div className="kv"><span>Total weight with data</span><b className="num">{Math.round(e.TW * 100)}%</b></div>
        {e.cap && <div className="kv"><span>Safety cap</span><b>{e.cap}</b></div>}
        <div className="kv"><span>Biggest lever today</span><b>{e.lever?.pillar}</b></div>
        <div className="kv"><span>Training load balance (ACWR)</span><b className="num">{e.lb?.acwr ?? '--'}</b></div>
        <div className="kv"><span>Data from</span><b>{e.sources.join(', ') || 'Check-ins'}</b></div>
        <div className="kv"><span>Engine</span><b>{e.engineVersion}</b></div>
      </div>
      <p className="xs muted">Bands: Thrive 80+, Steady 65 to 79, Ease up 50 to 64, Recover under 50. Feeling unwell caps the status at 49.</p>
    </div>
  );
}

export function SleepDetail() {
  const { data: d } = useLoad('sleepDetail');
  const { data: t } = useLoad('getToday');
  if (!d) return <Loading />;
  const s = d.score;
  const last = d.nights[d.nights.length - 1];
  return (
    <div className="stack">
      <Back to="insights" />
      <div className="row between"><h1 className="page">Sleep</h1><SimBadge show={t?.devices?.some((x) => x.provider === 'simulated')} /></div>
      <div className="card row" style={{ gap: 18 }}>
        <Ring value={s?.score} size={120} stroke={12} color="var(--sleep)"><div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{s ? Math.round(s.score) : '--'}</div></Ring>
        <div style={{ flex: 1 }}>
          <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{fmtH(s?.t)}</div>
          <div className="small muted">last night · need {fmtH(d.need.N)}{d.need.learned ? ' (learned)' : ''}</div>
          <div className="small" style={{ marginTop: 6 }}>7-day average {fmtH(d.avg7)}</div>
        </div>
      </div>
      {s && (
        <div className="grid3">
          {[['Duration', s.D, '50%'], ['Quality', s.Q, '30%'], ['Regularity', s.R, '20%']].map(([n, v, w]) => (
            <div key={n} className="tile center"><span className="xs muted">{n}</span><b className="num" style={{ fontSize: 22 }}>{Math.round(v)}</b><span className="xs faint">weight {w}</span></div>
          ))}
        </div>
      )}
      <div className="card">
        <h3>Sleep windows</h3>
        <p className="xs muted" style={{ marginTop: 0 }}>Usual bedtime {d.usualBed}. Steady timing helps as much as length.</p>
        <SleepWindows nights={d.nights} usualBed={d.usualBed} need={d.need.N} />
      </div>
      {last?.deep != null && (
        <div className="card">
          <h3>Last night's stages</h3>
          <div className="stackbar" style={{ marginTop: 10 }}>
            <i style={{ flexGrow: last.deep, background: 'var(--navy)' }} />
            <i style={{ flexGrow: last.rem, background: 'var(--violet)' }} />
            <i style={{ flexGrow: Math.max(0, last.tst - last.deep - last.rem), background: 'var(--sleep)' }} />
          </div>
          <div className="row between xs muted" style={{ marginTop: 8 }}><span>Deep {fmtH(last.deep)}</span><span>REM {fmtH(last.rem)}</span><span>Light {fmtH(last.tst - last.deep - last.rem)}</span></div>
          <p className="xs muted">Stages from a wearable are estimates. We use them lightly; efficiency and timing matter more.</p>
        </div>
      )}
      {d.insight && <div className="notice info"><Icon name="sparkle" /><div>{d.insight} <span className="muted">(an association in your data, not proof)</span></div></div>}
    </div>
  );
}

export function RecoveryDetail() {
  const { data: d } = useLoad('recoveryDetail');
  if (!d) return <Loading />;
  const s = d.score;
  return (
    <div className="stack">
      <Back to="insights" />
      <h1 className="page">Recovery</h1>
      <div className="card row" style={{ gap: 18 }}>
        <Ring value={s?.score} size={120} stroke={12} color="var(--coral)"><div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{s ? Math.round(s.score) : '--'}</div></Ring>
        <div style={{ flex: 1 }} className="small">
          {s?.mode === 'wearable' ? <>
            <div className="kv"><span>HRV vs normal</span><b className="num">{s.z > 0 ? '+' : ''}{s.z} SD</b></div>
            <div className="kv"><span>Resting HR vs normal</span><b className="num">{s.delta > 0 ? '+' : ''}{s.delta} bpm</b></div>
            <div className="kv"><span>Check-in</span><b className="num">{s.CHK != null ? Math.round(s.CHK) : '--'}</b></div>
          </> : <p>{s?.mode === 'phone' ? 'Without a wearable, Recovery comes from your morning check-in.' : 'Calibrating: using your check-in while we learn your normal.'}</p>}
        </div>
      </div>
      {d.hasWearable && d.base?.active && (
        <>
          <div className="card">
            <div className="row between"><h3>HRV</h3><span className="xs muted">your normal {d.base.hrvBaselineMs} ms</span></div>
            <BandSpark points={d.hrv} band={d.hrvBand} color="var(--coral)" fmt={(v) => `${v} ms`} />
          </div>
          <div className="card">
            <div className="row between"><h3>Resting heart rate</h3><span className="xs muted">your normal {d.base.rhrBaseline} bpm</span></div>
            <BandSpark points={d.rhr} band={d.rhrBand} color="var(--blue)" fmt={(v) => `${v} bpm`} />
          </div>
        </>
      )}
      {d.cycle && <div className="notice info"><Icon name="calendar" /><div>{d.cycle}</div></div>}
      <p className="xs muted">The shaded band is your normal range (30-day median ± spread). Inside it means normal for you, even if the number looks low.</p>
    </div>
  );
}

export function Nutrition() {
  const { go, act, ent } = useApp();
  const { data: d } = useLoad('nutritionDay', {});
  if (ent && ent.active === false) return <Locked what="Nutrition" />;
  if (!d) return <Loading />;
  const tg = d.targets;
  const macro = (label, v, target, color) => (
    <div style={{ flex: 1 }}>
      <div className="xs muted">{label}</div>
      <b className="num">{Math.round(v)}<span className="xs muted"> / {Array.isArray(target) ? `${target[0]}–${target[1]}` : target} g</span></b>
      <div className="progressbar" style={{ marginTop: 4 }}><i style={{ width: `${Math.min(100, (v / (Array.isArray(target) ? target[1] : target)) * 100)}%`, background: color }} /></div>
    </div>
  );
  return (
    <div className="stack">
      <Back to="insights" />
      <h1 className="page">Food and water</h1>
      <div className="card">
        <div className="row between">
          <div>
            <div className="xs muted">Eaten so far</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 800 }}>{!d.kcalRange ? 0 : d.kcalRange[0] === d.kcalRange[1] ? Math.round(d.totals.kcal) : `${d.kcalRange[0]}–${d.kcalRange[1]}`}<span className="small muted"> kcal</span></div>
            {d.showCalories && <div className="xs muted">of about {tg.kcal} for your day</div>}
          </div>
          <Ring value={d.score?.score ?? 0} size={80} stroke={8} color="var(--amber)"><b className="num">{d.score ? Math.round(d.score.score) : '--'}</b></Ring>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 14 }}>
          {macro('Protein', d.totals.protein, tg.protein, 'var(--violet)')}
          {macro('Carbs', d.totals.carbs, tg.carbsRange, 'var(--amber)')}
          {macro('Fiber', d.totals.fiber, tg.fiber, 'var(--green)')}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>{d.score ? `${d.score.confirmed} of ${d.score.usual} usual meals logged, so Fuel counts ${Math.round(d.score.cov * 100)}% of its share today.` : 'No meals logged yet today. Snap your first meal and your Fuel score appears here.'}</p>
      </div>
      <DeficitCard />
      <div className="row" style={{ gap: 8 }}>
        <Btn sm onClick={() => go('food')}><Icon name="camera" size={18} />Snap a meal</Btn>
        <Btn sm kind="secondary" onClick={() => go('voice')}><Icon name="mic" size={18} />Say it</Btn>
        <Btn sm kind="plain" onClick={() => go('water')}><Icon name="drop" size={18} />Water</Btn>
      </div>
      <div className="card">
        <h3>Meals today</h3>
        {d.meals.length === 0 && <p className="small muted">Nothing logged yet. A photo takes 5 seconds.</p>}
        <div className="list">
          {d.meals.map((m) => (
            <div key={m.id} className="item">
              <span className="ico" style={{ background: 'var(--tint-amber)', color: 'var(--amber)' }}><Icon name={m.source === 'photo' ? 'camera' : m.source === 'voice' ? 'mic' : 'leaf'} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">{m.name} · {clock(m.minute)}</b>
                <div className="xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.items.map((i) => i.name || i.foodId).join(', ')}</div>
              </div>
              <span className="num small">{m.kcalLow !== m.kcalHigh ? `${m.kcalLow}–${m.kcalHigh}` : Math.round(m.kcal)}</span>
              <button className="icon-btn" style={{ width: 32, height: 32, boxShadow: 'none' }} aria-label={`Delete ${m.name}`} onClick={() => act('deleteMeal', { id: m.id }, 'Meal removed')}><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      {d.idea && (
        <div className="card tint">
          <div className="xs muted">Idea for your next meal</div>
          <h3 style={{ marginTop: 4 }}>{d.idea.name}</h3>
          <div className="small muted">{d.idea.kcalLow}–{d.idea.kcalHigh} kcal · {Math.round(d.idea.protein)} g protein · {Math.round(d.idea.fiber)} g fiber</div>
          <Btn sm kind="secondary" style={{ marginTop: 10 }} onClick={() => act('logMeal', { items: d.idea.items, confirmed: true, source: 'idea' }, 'Logged')}>I ate this</Btn>
        </div>
      )}
      <div className="card">
        <div className="row between"><h3>Caffeine</h3><span className="xs muted">cut-off {clock(d.caffeine.cutoffMin)}</span></div>
        <CutoffTimeline logs={d.caffeine.logs} cutoffMin={d.caffeine.cutoffMin} bed={d.caffeine.bed} />
        <p className="xs muted">Caffeine has a half-life of about 5 hours. Stopping 8 hours before bed protects deep sleep.</p>
      </div>
      <div className="card">
        <h3>Protein, last 7 days</h3>
        <CapsuleBars items={d.days7.map((x) => ({ label: dayName(x.date).slice(0, 1), v: x.protein }))} target={tg.protein} fmt={(v) => `${v ?? 0} g`} />
      </div>
      <p className="xs muted">Calories are shown as ranges because photos and portions are estimates. Food values from USDA FoodData Central (rounded).</p>
    </div>
  );
}

// ---------------- Calorie deficit ----------------
const toLb = (kg) => Math.round(kg * 2.2046);
const wFmt = (kg, units) => (kg == null ? '--' : units === 'imperial' ? `${toLb(kg)} lb` : `${Math.round(kg * 10) / 10} kg`);
const wIn = (v, units) => (v === '' || v == null ? '' : units === 'imperial' ? Math.round((Number(v) / 2.2046) * 10) / 10 : Number(v));
const shortDate = (d) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function DeficitCard() {
  const { go } = useApp();
  const { data: d } = useLoad('deficit');
  if (!d || d.hidden) return null;
  return (
    <button className="card tap row" style={{ textAlign: 'left', gap: 12 }} onClick={() => go('deficit')}>
      <span className="ico" style={{ background: 'var(--tint-coral)', color: 'var(--coral)' }}><Icon name="target" /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>Calorie deficit</b>
        <div className="xs muted">{d.paused ? 'Paused for now. Tap to see why.' : d.enabled
          ? `Target ${d.plan.target.toLocaleString()} kcal today · ${d.today.left >= 0 ? `${d.today.left.toLocaleString()} left` : `${Math.abs(d.today.left).toLocaleString()} over`}`
          : 'See your maintenance calories and set a safe weight-loss pace'}</div>
      </span>
      <Icon name="chev" />
    </button>
  );
}

export function Deficit() {
  const { act, toast, bump } = useApp();
  const { data: d, error } = useLoad('deficit');
  const [pace, setPace] = useState(null);
  const [w, setW] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [newW, setNewW] = useState('');
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  const u = d.units;
  const unit = u === 'imperial' ? 'lb' : 'kg';
  const show = (kg) => (kg == null ? '' : u === 'imperial' ? toLb(kg) : kg);
  if (d.hidden) return <div className="stack"><Back to="nutrition" label="Food" /><h1 className="page">Calorie deficit</h1><div className="card"><p className="small">{d.reason}</p></div></div>;
  const sel = pace || d.pace;
  const opt = d.paces.find((x) => x.id === sel) || d.paces[0];
  const tgt = target ?? (d.targetKg != null ? show(d.targetKg) : '');
  async function save(enabled) {
    setBusy(true); setErr(null);
    try {
      await act('setDeficitGoal', { enabled, pace: sel, weightKg: d.weightKg ? undefined : wIn(w, u), targetKg: enabled ? wIn(tgt, u) : undefined });
      toast(enabled ? 'Calorie target set' : 'Calorie deficit turned off');
      setPace(null); setTarget(null); bump();
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }
  const p = d.plan;
  const eatenPct = Math.min(100, (d.today.kcal / Math.max(1, p.target)) * 100);
  return (
    <div className="stack">
      <Back to="nutrition" label="Food" />
      <div className="rise"><div className="eyebrow">Nutrition</div><h1 className="page">Calorie deficit</h1></div>

      {d.paused && <div className="notice info"><Icon name="info" /><div>{d.pausedReason}</div></div>}

      {d.enabled && (
        <div className="card rise">
          <div className="xs muted">Today's target</div>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{p.target.toLocaleString()}<span className="small muted"> kcal</span></div>
            <span className="chip coral">−{p.daily} kcal a day</span>
          </div>
          <div className="progressbar" style={{ marginTop: 8, height: 10 }}><i style={{ width: `${eatenPct}%`, background: d.today.left < 0 ? 'var(--coral)' : 'var(--amber)' }} /></div>
          <div className="row between xs muted" style={{ marginTop: 6 }}>
            <span>Eaten {d.today.low === d.today.high ? d.today.kcal : `${d.today.low}–${d.today.high}`} kcal ({d.today.meals} of {d.today.usual} meals)</span>
            <b style={{ color: d.today.left < 0 ? 'var(--coral)' : 'var(--text)' }}>{d.today.left >= 0 ? `${d.today.left.toLocaleString()} left` : `${(-d.today.left).toLocaleString()} over`}</b>
          </div>
          {d.today.deficit && (
            <div className="small" style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 12, padding: '10px 12px' }}>
              {d.today.complete
                ? <>Today's deficit so far: <b>{d.today.deficit.low === d.today.deficit.high ? d.today.deficit.mid : `${d.today.deficit.low} to ${d.today.deficit.high}`} kcal</b> below your maintenance of {p.tdee.toLocaleString()}.</>
                : <>Log all your meals today and we will show today's real deficit. Until then it would look bigger than it is.</>}
            </div>
          )}
        </div>
      )}

      <div className="card rise" style={{ animationDelay: '.05s' }}>
        <h3>How your numbers are worked out</h3>
        <div className="kv"><span>Resting burn (BMR)<div className="xs faint">Mifflin-St Jeor: weight, height, age, sex</div></span><b className="num">{p.bmr.toLocaleString()} kcal</b></div>
        <div className="kv"><span>Activity factor<div className="xs faint">From your last 14 days of steps and exercise</div></span><b className="num">× {p.AF}</b></div>
        <div className="kv"><span>Maintenance (TDEE)<div className="xs faint">What keeps your weight steady</div></span><b className="num">{p.tdee.toLocaleString()} kcal</b></div>
        {!d.paused && <div className="kv"><span>Deficit ({Math.round(opt.pct * 100)}% pace)<div className="xs faint">Never more than 20% of maintenance</div></span><b className="num">−{opt.daily} kcal</b></div>}
        {!d.paused && <div className="kv"><span>Daily target<div className="xs faint">Never below {d.floor.toLocaleString()} kcal</div></span><b className="num">{opt.target.toLocaleString()} kcal</b></div>}
        {!d.paused && <div className="kv"><span>Expected change</span><b className="num">about {u === 'imperial' ? `${Math.round(opt.weeklyKg * 2.2046 * 10) / 10} lb` : `${opt.weeklyKg} kg`} a week</b></div>}
        {opt.limitedBy === 'floor' && <p className="xs" style={{ color: 'var(--amber)' }}>Your target is held at the {d.floor.toLocaleString()} kcal minimum, so the deficit is smaller than the pace suggests.</p>}
        {opt.limitedBy === 'pace' && <p className="xs" style={{ color: 'var(--amber)' }}>Capped so you lose no more than 1% of your body weight a week.</p>}
        <p className="xs muted" style={{ marginBottom: 0 }}>About 7,700 kcal of deficit equals roughly 1 kg ({u === 'imperial' ? 'about 3,500 kcal per lb' : '2.2 lb'}). Treat it as a guide: loss usually slows over time, and water can move your weight 1 to 2 kg from day to day.</p>
      </div>

      {!d.paused && (
        <div className="card rise" style={{ animationDelay: '.1s' }}>
          <h3>{d.enabled ? 'Your pace' : 'Set up a calorie deficit'}</h3>
          {!d.weightKg && (
            <div className="field"><label htmlFor="df-w">Your weight now ({unit})</label><input id="df-w" className="input" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={u === 'imperial' ? 'e.g. 170' : 'e.g. 78'} /></div>
          )}
          <div role="radiogroup" aria-label="Pace" className="col" style={{ gap: 8, marginTop: 6 }}>
            {d.paces.map((x) => (
              <button key={x.id} role="radio" aria-checked={x.id === sel} className={`pill-opt ${x.id === sel ? 'on' : ''}`} onClick={() => setPace(x.id)}>
                <div className="row between"><b>{x.label} · {Math.round(x.pct * 100)}%</b><span className="num small">{x.target.toLocaleString()} kcal a day</span></div>
                <div className="xs muted">{x.note}. About {u === 'imperial' ? `${Math.round(x.weeklyKg * 2.2046 * 10) / 10} lb` : `${x.weeklyKg} kg`} a week.</div>
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 10 }}><label htmlFor="df-t">Target weight ({unit}), optional</label><input id="df-t" className="input" inputMode="decimal" value={tgt} onChange={(e) => setTarget(e.target.value)} placeholder="Leave empty if you just want a steady pace" /></div>
          {err && <p className="small" style={{ color: 'var(--coral)' }}>{err}</p>}
          <Btn block disabled={busy || (!d.weightKg && !w)} onClick={() => save(true)} style={{ marginTop: 6 }}>{d.enabled ? 'Save changes' : 'Start my calorie deficit'}</Btn>
          {d.enabled && <Btn block kind="plain" disabled={busy} onClick={() => save(false)} style={{ marginTop: 6 }}>Turn off, eat at maintenance</Btn>}
        </div>
      )}

      {d.enabled && d.projection && (
        <div className="card tint rise">
          <div className="xs muted">At this pace</div>
          <b>{wFmt(d.targetKg, u)} in about {d.projection.weeks} weeks</b>
          <div className="small muted">Around {new Date(d.projection.date + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, if you hit your target most days. Most people take longer, and that is fine.</div>
        </div>
      )}

      <div className="card rise">
        <div className="row between"><h3>Last 7 days</h3><span className="xs muted">{d.week.loggedDays} fully logged</span></div>
        <div className="list">
          {d.days7.map((x) => (
            <div key={x.date} className="kv">
              <span>{dayName(x.date)} {shortDate(x.date)}<div className="xs faint">{x.meals} of {d.today.usual} meals · maintenance {x.tdee.toLocaleString()}</div></span>
              {x.complete ? <b className="num" style={{ color: x.deficit >= 0 ? 'var(--green)' : 'var(--coral)' }}>{x.deficit >= 0 ? `−${x.deficit}` : `+${-x.deficit}`} kcal</b> : <span className="xs muted">Not fully logged</span>}
            </div>
          ))}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>{d.week.loggedDays ? `On fully logged days you averaged ${d.week.avgDaily >= 0 ? `${d.week.avgDaily} kcal under` : `${-d.week.avgDaily} kcal over`} maintenance, about ${u === 'imperial' ? `${Math.round(d.week.estKg * 2.2046 * 10) / 10} lb` : `${d.week.estKg} kg`} in total.` : 'Only days with all your usual meals logged (or most of the day\'s food) count, so half-logged days do not look like big deficits.'}</p>
      </div>

      <div className="card rise">
        <h3>Weight</h3>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" inputMode="decimal" aria-label={`Today's weight in ${unit}`} placeholder={`Today's weight (${unit})`} value={newW} onChange={(e) => setNewW(e.target.value)} />
          <Btn sm disabled={!newW} onClick={async () => { try { await act('logWeight', { kg: wIn(newW, u) }, 'Weight saved'); setNewW(''); } catch (e) { toast(e.message); } }}>Save</Btn>
        </div>
        {d.weightLog.length > 1 && <Spark values={d.weightLog.map((x) => x.kg)} w={300} h={50} />}
        <div className="list" style={{ marginTop: 6 }}>
          {d.weightLog.slice(-5).reverse().map((x) => <div key={x.date} className="kv"><span>{shortDate(x.date)}</span><b className="num">{wFmt(x.kg, u)}</b></div>)}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Weigh in the morning, after the bathroom, a few times a week. Look at the trend, not single days.</p>
      </div>
      <p className="xs muted">Health Track is a wellness app, not medical advice. If you have a health condition or take medication, check with your doctor before cutting calories.</p>
    </div>
  );
}
