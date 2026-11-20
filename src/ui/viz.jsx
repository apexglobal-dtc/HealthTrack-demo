// Data presentation components (storyboard v2 data presentation guide, components c01 to c17).
import React, { useEffect, useState } from 'react';
import { Icon } from './kit.jsx';

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(t); }, []);
  return m;
}

// c01 hero ring
export function Ring({ value, size = 150, stroke = 16, color = 'url(#htgrad)', track = 'var(--track)', children, dashed, max = 100, label }) {
  const m = useMounted();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(max, value)) / max;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={label || (value == null ? 'No value yet' : `${Math.round(value)} of ${max}`)}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs><linearGradient id="htgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--teal)" /><stop offset="1" stopColor="var(--violet)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} strokeDasharray={dashed ? '6 8' : undefined} />
        <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={m ? C * (1 - v) : C} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

export function CountUp({ to, dur = 900 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (to == null) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(to); return; }
    let raf; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / dur); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{to == null ? '--' : v}</>;
}

// c02 signal ring row item
export function MiniRing({ value, color, icon, label, onClick, delay = 0 }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, animation: `rise .5s ${delay}s both` }} aria-label={`${label} ${value ?? 'not yet'}`}>
      <Ring value={value} size={56} stroke={6} color={color} dashed={value == null}><Icon name={icon} size={20} color={color} /></Ring>
      <b className="num" style={{ fontSize: 17 }}>{value ?? '--'}</b>
      <span className="muted xs">{label}</span>
    </button>
  );
}

// c03 segmented ring (Fitness Score 40/30/30)
export function SegRing({ parts, size = 150, stroke = 14, children }) {
  const m = useMounted();
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const gap = 6;
  let off = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {parts.map((p, i) => {
          const len = C * p.w - gap;
          const el = (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} strokeDasharray={`${len} ${C}`} strokeDashoffset={-off} strokeLinecap="round" />
              <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${m ? len * ((p.v ?? 0) / 100) : 0} ${C}`} strokeDashoffset={-off} />
            </g>
          );
          off += C * p.w;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

// c04 sweet-spot gauge for ACWR
export function Gauge({ value, min = 0.4, max = 2.2, lo = 0.8, hi = 1.3 }) {
  const w = 300, h = 160, cx = 150, cy = 140, r = 110;
  const ang = (v) => Math.PI * (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min));
  const pt = (a, rr = r) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
  const arc = (a0, a1, color) => { const [x0, y0] = pt(a0); const [x1, y1] = pt(a1); return <path d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={color} strokeWidth="16" fill="none" strokeLinecap="round" />; };
  const [nx, ny] = pt(ang(value), r - 26);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Load ratio ${value}`}>
      {arc(Math.PI, ang(lo), 'var(--track)')}
      {arc(ang(lo), ang(hi), 'var(--green)')}
      {arc(ang(hi), 0, 'var(--tint-coral)')}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="4" strokeLinecap="round" style={{ transition: 'all 1s' }} />
      <circle cx={cx} cy={cy} r="8" fill="var(--text)" />
      <text x={pt(ang(lo), r + 18)[0]} y={pt(ang(lo), r + 18)[1]} fontSize="12" fill="var(--muted)" textAnchor="middle">{lo}</text>
      <text x={pt(ang(hi), r + 18)[0]} y={pt(ang(hi), r + 18)[1]} fontSize="12" fill="var(--muted)" textAnchor="middle">{hi}</text>
    </svg>
  );
}

// c05 range bullet (labs): reference interval light, optimal band solid, value marker
export function RangeBullet({ value, range: refR, opt, unit }) {
  const lo = Math.min(refR[0], opt[0], value) * 0.8;
  const hi = Math.max(refR[1], opt[1], value) * 1.1 || 1;
  const x = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const m = useMounted();
  return (
    <div style={{ position: 'relative', height: 26 }} role="img" aria-label={`${value} ${unit}; reference ${refR[0]} to ${refR[1]}; optimal ${opt[0]} to ${opt[1]}`}>
      <div style={{ position: 'absolute', top: 9, height: 8, left: 0, right: 0, borderRadius: 9, background: 'var(--track)' }} />
      <div style={{ position: 'absolute', top: 9, height: 8, left: x(refR[0]), width: `calc(${x(refR[1])} - ${x(refR[0])})`, borderRadius: 9, background: 'var(--tint-teal)' }} />
      <div style={{ position: 'absolute', top: 9, height: 8, left: x(opt[0]), width: `calc(${x(opt[1])} - ${x(opt[0])})`, borderRadius: 9, background: 'var(--teal)', opacity: .7 }} />
      <div style={{ position: 'absolute', top: 2, width: 4, height: 22, borderRadius: 4, background: 'var(--text)', left: m ? x(value) : 0, transition: 'left 1s cubic-bezier(.2,.8,.2,1)' }} />
    </div>
  );
}

// c06 baseline band sparkline
export function BandSpark({ points, band, color = 'var(--violet)', height = 90, fmt = (v) => v }) {
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (!vals.length) return <div className="muted small">Not enough data yet</div>;
  const lo = Math.min(...vals, band?.[0] ?? Infinity) * 0.95;
  const hi = Math.max(...vals, band?.[1] ?? -Infinity) * 1.05;
  const W = 300, H = height;
  const X = (i) => 8 + (i / Math.max(1, points.length - 1)) * (W - 16);
  const Y = (v) => H - 8 - ((v - lo) / (hi - lo || 1)) * (H - 16);
  const d = points.map((p, i) => (p.v == null ? '' : `${i && points[i - 1]?.v != null ? 'L' : 'M'}${X(i)} ${Y(p.v)}`)).join(' ');
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Trend, latest ${fmt(points[last]?.v)}`}>
      {band && <rect x="0" width={W} y={Y(band[1])} height={Math.max(2, Y(band[0]) - Y(band[1]))} rx="8" fill="var(--track)" />}
      <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {points[last]?.v != null && <circle cx={X(last)} cy={Y(points[last].v)} r="6" fill="var(--surface)" stroke={color} strokeWidth="3" />}
    </svg>
  );
}

export function Spark({ values, color = 'var(--violet)', w = 120, h = 40 }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const X = (i) => 4 + (i / (values.length - 1)) * (w - 8);
  const Y = (x) => h - 4 - ((x - lo) / (hi - lo || 1)) * (h - 8);
  const d = values.map((x, i) => (x == null ? '' : `${i ? 'L' : 'M'}${X(i)} ${Y(x)}`)).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`${d} L${X(values.length - 1)} ${h} L${X(0)} ${h} Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1] ?? lo)} r="4" fill="var(--surface)" stroke={color} strokeWidth="2.5" />
    </svg>
  );
}

// c07 capsule bars with a target
export function CapsuleBars({ items, target, fmt = (v) => v, labels = true }) {
  const max = Math.max(target || 0, ...items.map((i) => i.v || 0)) || 1;
  return (
    <div>
      <div className="bar-cap" role="img" aria-label={items.map((i) => `${i.label}: ${fmt(i.v)}`).join(', ')}>
        {items.map((it, i) => (
          <div key={i}>
            <i className={target && it.v >= target ? 'hit' : ''} style={{ height: `${Math.max(6, ((it.v || 0) / max) * 100)}%`, outline: it.today ? '2px solid var(--violet)' : 'none', outlineOffset: 2 }} />
          </div>
        ))}
      </div>
      {labels && <div className="row" style={{ gap: 6, marginTop: 6 }}>{items.map((it, i) => <span key={i} className="xs faint center" style={{ flex: 1, fontWeight: it.today ? 700 : 400 }}>{it.label}</span>)}</div>}
    </div>
  );
}

// c08 floating range bars (sleep windows on a clock axis)
export function SleepWindows({ nights, usualBed, need }) {
  const startAxis = 20 * 60; // 8 pm
  const span = 14 * 60; // to 10 am
  const pos = (m) => { let x = m - startAxis; if (x < 0) x += 1440; return Math.min(100, Math.max(0, (x / span) * 100)); };
  return (
    <div role="img" aria-label="Sleep windows for the last 7 nights">
      {nights.map((n) => (
        <div key={n.date} className="row" style={{ gap: 10, marginBottom: 8 }}>
          <span className="xs muted" style={{ width: 30 }}>{new Date(n.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
          <div style={{ position: 'relative', flex: 1, height: 16, borderRadius: 9, background: 'var(--surface2)' }}>
            {n.start != null && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos(n.start)}%`, width: `${Math.max(4, pos(n.end) - pos(n.start))}%`, borderRadius: 9, background: n.tst < need - 0.5 ? 'color-mix(in srgb, var(--sleep) 55%, transparent)' : 'var(--sleep)', animation: 'fade .6s both' }} />}
            {n.start == null && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 8 }} className="xs muted">{n.tst ? `${n.tst} h (manual)` : 'no data'}</div>}
          </div>
          <span className="xs num" style={{ width: 52, textAlign: 'right' }}>{n.tst ? `${Math.floor(n.tst)}h ${Math.round((n.tst % 1) * 60)}m` : '--'}</span>
        </div>
      ))}
      <div className="row xs faint" style={{ marginLeft: 40, marginRight: 62, justifyContent: 'space-between' }}><span>8 pm</span><span>midnight</span><span>4 am</span><span>10 am</span></div>
    </div>
  );
}

// c10 fill vessel
export function Vessel({ value, target, color = 'var(--blue)', label }) {
  const p = Math.min(1, (value || 0) / (target || 1));
  const m = useMounted();
  return (
    <div style={{ position: 'relative', width: 120, height: 170, borderRadius: '20px 20px 40px 40px', border: '3px solid var(--line)', overflow: 'hidden', background: 'var(--surface2)' }} role="img" aria-label={label}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${m ? p * 100 : 0}%`, background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 70%, #000))`, transition: 'height 1.1s cubic-bezier(.2,.8,.2,1)' }}>
        <svg viewBox="0 0 120 10" width="120" height="10" style={{ position: 'absolute', top: -9 }}><path d="M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 V10 H0z" fill={color}><animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 V10 H0z;M0 5 Q15 10 30 5 T60 5 T90 5 T120 5 V10 H0z;M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 V10 H0z" /></path></svg>
      </div>
    </div>
  );
}

// c11 timeline with cut-off (caffeine)
export function CutoffTimeline({ logs, cutoffMin, bed, wake = 6 * 60 }) {
  const span = ((bed - wake + 1440) % 1440) || 1;
  const pos = (m) => `${Math.min(100, Math.max(0, (((m - wake + 1440) % 1440) / span) * 100))}%`;
  return (
    <div style={{ position: 'relative', height: 54, marginTop: 8 }} role="img" aria-label="Caffeine timeline with the cut-off 8 hours before bed">
      <div style={{ position: 'absolute', top: 22, left: 0, right: 0, height: 6, borderRadius: 9, background: 'var(--track)' }} />
      <div style={{ position: 'absolute', top: 22, left: pos(cutoffMin), right: 0, height: 6, borderRadius: 9, background: 'var(--tint-coral)' }} />
      <div style={{ position: 'absolute', top: 10, left: pos(cutoffMin), width: 2, height: 30, background: 'var(--coral)' }} />
      <div className="xs" style={{ position: 'absolute', top: 40, left: pos(cutoffMin), transform: 'translateX(-50%)', color: 'var(--coral)', fontWeight: 700, whiteSpace: 'nowrap' }}>cut-off</div>
      {logs.map((l, i) => <div key={i} title={`${l.mg} mg`} style={{ position: 'absolute', top: 15, left: pos(l.minute), transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: 99, background: l.minute >= cutoffMin ? 'var(--coral)' : 'var(--amber)', border: '3px solid var(--surface)' }} />)}
      <div className="xs faint" style={{ position: 'absolute', top: 0, left: 0 }}>wake</div>
      <div className="xs faint" style={{ position: 'absolute', top: 0, right: 0 }}>bed</div>
    </div>
  );
}

// c13 contribution stack
export function ContributionStack({ rows }) {
  const colors = { sleep: 'var(--sleep)', recovery: 'var(--coral)', activity: 'var(--green)', nutrition: 'var(--amber)', hydration: 'var(--blue)' };
  return (
    <div className="stackbar" role="img" aria-label="How each pillar adds up to the status">
      {rows.filter((r) => r.contrib > 0).map((r) => <i key={r.key} style={{ flexGrow: r.contrib, background: colors[r.key] }} title={`${r.name}: ${r.contrib}`} />)}
    </div>
  );
}

// c15 cycle dial
export function CycleDial({ days, cd, length, windowFrom, windowTo, predNext, size = 240 }) {
  const r = size / 2 - 22;
  const cx = size / 2, cy = size / 2;
  const colors = { Menstrual: 'var(--coral)', Follicular: 'var(--teal)', Luteal: 'var(--violet)', Late: 'var(--amber)' };
  const a = (i) => (i / length) * 2 * Math.PI - Math.PI / 2;
  const m = useMounted();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Cycle day ${cd} of about ${length}`}>
      <g style={{ transformOrigin: 'center', transform: m ? 'rotate(0deg)' : 'rotate(-40deg)', transition: 'transform 1.2s cubic-bezier(.2,.8,.2,1)' }}>
        {days.slice(0, length).map((d, i) => {
          const a0 = a(i) + 0.02, a1 = a(i + 1) - 0.02;
          const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
          return <path key={i} d={`M${p0[0]} ${p0[1]} A${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`} stroke={colors[d.phase] || 'var(--track)'} strokeWidth={i + 1 === cd ? 22 : 14} fill="none" opacity={i + 1 > cd ? 0.35 : 1} />;
        })}
      </g>
      <circle cx={cx + r * Math.cos(a(cd - 0.5))} cy={cy + r * Math.sin(a(cd - 0.5))} r="9" fill="var(--surface)" stroke="var(--text)" strokeWidth="3" />
    </svg>
  );
}
