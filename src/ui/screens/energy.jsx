import React from 'react';
import { useApp, useLoad, Icon, Back, Loading, ErrorBox, SimBadge, confColor, dayName } from '../kit.jsx';
import { Ring, CountUp } from '../viz.jsx';

export const ENERGY_COLOR = { green: 'var(--green)', teal: 'var(--teal)', amber: 'var(--amber)', coral: 'var(--coral)' };
const clock12 = (m) => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60); return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; };

// Energy through the day: solid for hours that have passed, dashed for the rest.
export function EnergyCurve({ curve, nowMin, height = 120, compact = false }) {
  if (!curve?.length) return null;
  const W = 320, H = height, padL = compact ? 4 : 26, padB = compact ? 4 : 20;
  const t0 = curve[0].abs, t1 = curve[curve.length - 1].abs;
  const X = (m) => padL + ((m - t0) / Math.max(1, t1 - t0)) * (W - padL - 6);
  const Y = (v) => 6 + (1 - v / 100) * (H - padB - 6);
  const past = curve.filter((p) => !p.projected);
  const fut = curve.filter((p, i) => p.projected || (curve[i + 1]?.projected && !p.projected));
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.abs).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
  const nowAbs = nowMin < t0 % 1440 ? nowMin + 1440 : nowMin;
  const showNow = nowAbs >= t0 && nowAbs <= t1;
  const ticks = curve.filter((p, i) => i % 3 === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Energy from ${curve[0].v} at waking`}>
      {!compact && [25, 50, 75].map((v) => <g key={v}><line x1={padL} x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeDasharray={v === 50 ? '0' : '3 4'} /><text x={padL - 6} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}</text></g>)}
      {past.length > 1 && <path d={`${path(past)} L${X(past[past.length - 1].abs)} ${Y(0)} L${X(past[0].abs)} ${Y(0)} Z`} fill="var(--amber)" opacity=".12" />}
      {past.length > 1 && <path d={path(past)} fill="none" stroke="var(--amber)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {fut.length > 1 && <path d={path(fut)} fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" opacity=".7" />}
      {showNow && <line x1={X(nowAbs)} x2={X(nowAbs)} y1={6} y2={Y(0)} stroke="var(--muted)" strokeDasharray="2 3" />}
      {!compact && ticks.map((p) => <text key={p.abs} x={X(p.abs)} y={H - 5} textAnchor="middle" fontSize="10" fill="var(--muted)">{clock12(p.min)}</text>)}
    </svg>
  );
}

// Two stress readings a day as paired bars (9 AM lighter, 3 PM darker).
export function StressBars({ series, height = 110 }) {
  const W = 320, H = height, padB = 18, n = series.length;
  const bw = (W - 8) / n;
  const Y = (v) => (H - padB) - (v / 100) * (H - padB - 6);
  const col = (v) => (v == null ? 'var(--track)' : v <= 25 ? 'var(--green)' : v <= 50 ? 'var(--teal)' : v <= 75 ? 'var(--amber)' : 'var(--coral)');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Stress readings, last 14 days">
      {[25, 50, 75].map((v) => <line key={v} x1="4" x2={W - 4} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeDasharray="3 4" />)}
      {series.map((d, i) => {
        const x = 4 + i * bw;
        const w = Math.max(3, bw / 2 - 2.5);
        return (
          <g key={d.date}>
            {d.am != null && <rect x={x + 1} y={Y(d.am)} width={w} height={Math.max(2, Y(0) - Y(d.am))} rx="2.5" fill={col(d.am)} opacity=".55" />}
            {d.pm != null && <rect x={x + 2 + w} y={Y(d.pm)} width={w} height={Math.max(2, Y(0) - Y(d.pm))} rx="2.5" fill={col(d.pm)} />}
            {(i % 2 === 1 || i === n - 1) && <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight={i === n - 1 ? 700 : 400}>{i === n - 1 ? 'Today' : dayName(d.date).slice(0, 2)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function StressReadingTile({ r }) {
  return (
    <div className="card flat" style={{ flex: 1, padding: 12 }}>
      <div className="xs muted">{r.at} reading</div>
      {r.pending ? <><b className="num" style={{ fontSize: 26 }}>--</b><div className="xs faint">Comes at {r.at}</div></>
        : r.value == null ? <><b className="num" style={{ fontSize: 26 }}>--</b><div className="xs faint">Skipped: {r.reason === 'baseline' ? 'still learning your normal' : 'under 30 minutes of still time'}</div></>
          : <>
            <div className="row" style={{ gap: 6, alignItems: 'baseline' }}><b className="num" style={{ fontSize: 26, color: ENERGY_COLOR[r.band.color] }}>{r.value}</b><span className="small" style={{ color: ENERGY_COLOR[r.band.color], fontWeight: 700 }}>{r.band.name}</span></div>
            <div className="xs faint">{r.method === 'check-in' ? 'From your check-in' : `${r.stillMin} still minutes, ${r.covers}${r.method === 'hr' ? ', heart rate only' : ', heart rate and HRV'}`}</div>
          </>}
    </div>
  );
}

export function EnergyStress() {
  const { go } = useApp();
  const { data: d, error } = useLoad('energyStress');
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  const e = d.energy, s = d.stress;
  const ec = ENERGY_COLOR[e?.band?.color] || 'var(--amber)';
  return (
    <div className="stack">
      <Back to="insights" />
      <div className="rise"><div className="eyebrow">Insights</div><h1 className="page">Energy and stress</h1></div>

      {e ? (
        <div className="card rise">
          <div className="row between"><h3 style={{ margin: 0 }}>Energy now</h3><span className="row" style={{ gap: 6 }}><SimBadge show={d.hasWearable} /><span className={`chip ${confColor(e.confidence)}`} style={{ fontSize: 11, padding: '2px 8px' }}>{e.confidence} confidence</span></span></div>
          <div className="row" style={{ gap: 16, marginTop: 10 }}>
            <Ring value={e.now} size={116} stroke={12} color={ec}>
              <div className="num" style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}><CountUp to={e.now} /></div>
              <div className="xs" style={{ fontWeight: 700, color: ec }}>{e.band.name}</div>
            </Ring>
            <div className="small" style={{ flex: 1 }}>
              <div className="kv"><span>At waking</span><b className="num">{e.atWake}</b></div>
              <div className="kv"><span>Stress so far</span><b className="num">−{Math.round(e.parts.stressDrain)}</b></div>
              <div className="kv"><span>Workouts so far</span><b className="num">−{Math.round(e.parts.activityDrain)}</b></div>
              {e.parts.rest > 0 && <div className="kv"><span>Calm stretches</span><b className="num">+{e.parts.rest}</b></div>}
            </div>
          </div>
          <div style={{ marginTop: 10 }}><EnergyCurve curve={e.curve} nowMin={d.nowMin} /></div>
          <p className="small" style={{ margin: '6px 0 0' }}>{e.goodUntilMin != null ? <>Energy stays above 50 until about <b>{clock12(e.goodUntilMin)}</b>. That is your best window for a hard session today.</> : <>Energy is under 50 for the rest of the day. Keep training easy and protect tonight's sleep.</>}</p>
          <p className="xs muted" style={{ marginBottom: 0 }}>Energy is charged by last night's sleep ({e.tstH} h) and this morning's recovery ({Math.round(e.parts.recovery)}), and falls with time awake, stress and hard activity. The dashed line is where it heads if the rest of the day is calm.</p>
        </div>
      ) : <div className="card"><p className="small">Energy needs last night's sleep. Add it in your morning check-in.</p></div>}

      <div className="card rise" style={{ animationDelay: '.05s' }}>
        <div className="row between"><h3 style={{ margin: 0 }}>Stress today</h3>{s.day != null && <span className={`chip ${s.band.color}`} style={{ fontSize: 12, padding: '3px 10px' }}>Day {s.day} · {s.band.name}</span>}</div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}><StressReadingTile r={s.am} /><StressReadingTile r={s.pm} /></div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Two readings a day, at 9 AM and 3 PM, from times you were sitting still. Each one compares your heart rate{d.device ? ` and HRV from your ${d.device}` : ''} with your own 30-day normal{d.baseline.rhr ? ` (resting heart rate ${d.baseline.rhr} bpm)` : ''}. Moving and workouts are left out, so exercise never counts as stress.</p>
      </div>

      <div className="card rise" style={{ animationDelay: '.1s' }}>
        <div className="row between"><h3 style={{ margin: 0 }}>Last 14 days</h3>{d.stressAvg7 != null && <span className="xs muted">7-day average {d.stressAvg7}</span>}</div>
        <StressBars series={d.series} />
        <div className="row wrap xs muted" style={{ gap: '4px 12px' }}><span className="row" style={{ gap: 4, whiteSpace: 'nowrap' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--teal)', opacity: 0.55, display: 'inline-block' }} />9 AM</span><span className="row" style={{ gap: 4, whiteSpace: 'nowrap' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--teal)', display: 'inline-block' }} />3 PM</span><span>0 to 25 resting · 26 to 50 low · 51 to 75 medium · 76+ high</span></div>
        {d.alert && <div className="notice warn" style={{ marginTop: 10 }}><Icon name="info" /><div>{d.alert.text} Health Genie can help you plan a lighter evening.</div></div>}
      </div>

      <button className="card flat row" style={{ textAlign: 'left' }} onClick={() => go('genie')}>
        <span className="ico" style={{ background: 'var(--tint-violet)', color: 'var(--violet)' }}><Icon name="sparkle" /></span>
        <span style={{ flex: 1 }}><b className="small">Ask Health Genie</b><div className="xs muted">"When should I train today?" · "Why was today so draining?"</div></span>
        <Icon name="chev" />
      </button>
      <p className="xs faint">Stress {d.versions.stress} and Energy {d.versions.energy} are wellness estimates, not medical measurements.</p>
    </div>
  );
}

// Weight trend: raw weigh-ins as dots, smoothed trend as a line.
export function WeightTrend({ points, units, height = 120 }) {
  if (!points?.length || points.length < 2) return null;
  const conv = (kg) => (units === 'imperial' ? kg * 2.2046 : kg);
  const vals = points.flatMap((p) => [conv(p.kg), conv(p.trend)]);
  const lo = Math.min(...vals) - 0.2, hi = Math.max(...vals) + 0.2;
  const W = 320, H = height;
  const d0 = Date.parse(points[0].date), d1 = Date.parse(points[points.length - 1].date);
  const X = (d) => 30 + ((Date.parse(d) - d0) / Math.max(1, d1 - d0)) * (W - 38);
  const Y = (v) => 6 + (1 - (v - lo) / (hi - lo)) * (H - 26);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Y(conv(p.trend)).toFixed(1)}`).join(' ');
  const ticks = [lo + 0.2, (lo + hi) / 2, hi - 0.2];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Weight trend">
      {ticks.map((v) => <g key={v}><line x1="30" x2={W - 6} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeDasharray="3 4" /><text x="24" y={Y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v.toFixed(1)}</text></g>)}
      {points.map((p) => <circle key={p.date} cx={X(p.date)} cy={Y(conv(p.kg))} r="2.6" fill="var(--muted)" opacity=".55" />)}
      <path d={line} fill="none" stroke="var(--coral)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x={X(points[0].date)} y={H - 4} fontSize="10" fill="var(--muted)">{new Date(points[0].date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
      <text x={W - 6} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">Today</text>
    </svg>
  );
}

// Projection: on-plan curve and the slower 80% curve, both bending as maintenance falls.
export function ProjectionChart({ range, targetKg, units, height = 130 }) {
  if (!range?.curve?.length) return null;
  const conv = (kg) => (units === 'imperial' ? kg * 2.2046 : kg);
  const a = range.curve, b = range.slowCurve;
  const maxW = Math.max(a[a.length - 1].week, b[b.length - 1].week);
  const all = [...a, ...b].map((p) => conv(p.kg)).concat(targetKg ? [conv(targetKg)] : []);
  const lo = Math.min(...all) - 0.3, hi = Math.max(...all) + 0.3;
  const W = 320, H = height;
  const X = (w) => 30 + (w / Math.max(1, maxW)) * (W - 38);
  const Y = (v) => 6 + (1 - (v - lo) / (hi - lo)) * (H - 26);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.week).toFixed(1)} ${Y(conv(p.kg)).toFixed(1)}`).join(' ');
  const area = `${path(a)} L${[...b].reverse().map((p) => `${X(p.week).toFixed(1)} ${Y(conv(p.kg)).toFixed(1)}`).join(' L')} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Projected weight">
      {targetKg && <g><line x1="30" x2={W - 6} y1={Y(conv(targetKg))} y2={Y(conv(targetKg))} stroke="var(--green)" strokeDasharray="4 4" /><text x={W - 6} y={Y(conv(targetKg)) - 5} textAnchor="end" fontSize="10" fill="var(--green)">Target</text></g>}
      <path d={area} fill="var(--coral)" opacity=".1" />
      <path d={path(b)} fill="none" stroke="var(--coral)" strokeWidth="2" strokeDasharray="4 5" opacity=".7" />
      <path d={path(a)} fill="none" stroke="var(--coral)" strokeWidth="3" strokeLinecap="round" />
      <text x="24" y={Y(conv(a[0].kg)) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{conv(a[0].kg).toFixed(0)}</text>
      <text x="30" y={H - 4} fontSize="10" fill="var(--muted)">Now</text>
      <text x={W - 6} y={H - 4} textAnchor="end" fontSize="10" fill="var(--muted)">{maxW} weeks</text>
    </svg>
  );
}
