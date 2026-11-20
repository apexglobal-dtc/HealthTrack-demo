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
      <div className="grid2 rise" style={{ animationDelay: '.05s' }}>
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
        <p className="xs muted" style={{ marginTop: 6 }}>Each arc's length is the pillar's weight; how full it is shows its score.</p>
        <p className="small" style={{ marginTop: 6 }}>Five pillars, each scored 0 to 100, weighted and added up. Missing data shrinks a pillar's weight instead of guessing.</p>
        <ContributionStack rows={e.rows} />
      </div>
      <div className="card">
        <div className="list">
          {e.rows.map((r) => (
            <div key={r.key} className="item" style={{ alignItems: 'flex-start' }}>
              <span className="ico" style={{ background: PILLAR[r.key].tint, color: PILLAR[r.key].color }}><Icon name={PILLAR[r.key].icon} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between"><b>{r.name}</b><span className="num"><b>{r.score ?? '--'}</b> <span className="xs muted">× {Math.round(r.eff * 100)}%</span></span></div>
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
            <div className="num" style={{ fontSize: 30, fontWeight: 800 }}>{d.kcalRange[0] === d.kcalRange[1] ? Math.round(d.totals.kcal) : `${d.kcalRange[0]}–${d.kcalRange[1]}`}<span className="small muted"> kcal</span></div>
            {d.showCalories && <div className="xs muted">of about {tg.kcal} for your day</div>}
          </div>
          <Ring value={d.score.score} size={80} stroke={8} color="var(--amber)"><b className="num">{Math.round(d.score.score)}</b></Ring>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 14 }}>
          {macro('Protein', d.totals.protein, tg.protein, 'var(--violet)')}
          {macro('Carbs', d.totals.carbs, tg.carbsRange, 'var(--amber)')}
          {macro('Fiber', d.totals.fiber, tg.fiber, 'var(--green)')}
        </div>
        <p className="xs muted" style={{ marginBottom: 0 }}>{d.score.confirmed} of {d.score.usual} usual meals logged, so Fuel counts {Math.round(d.score.cov * 100)}% of its weight today.</p>
      </div>
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
