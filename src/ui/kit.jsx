import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// ---------------- context ----------------
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function asset(name) {
  return (typeof window !== 'undefined' && window.__HT_ASSETS__?.[name]) || `/assets/${name}`;
}

// Load a service method and re-run when `deps` change or the app data version bumps.
export function useLoad(method, args, deps = []) {
  const { call, version } = useApp();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    return call(method, args).then((data) => setState({ data, error: null, loading: false }), (error) => setState({ data: null, error, loading: false }));
  }, [method, JSON.stringify(args || {})]);
  useEffect(() => { reload(); }, [reload, version, ...deps]);
  return { ...state, reload };
}

// ---------------- icons (simple 24px strokes) ----------------
const P = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  insights: 'M5 20V12M10 20V6M15 20v-9M20 20V4',
  progress: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 7-10 16-10 0 9-4 16-9 17zM4 21c4-4 7-6 11-8',
  drop: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  barcode: 'M4 6v12M7 6v12M11 6v12M14 6v12M18 6v12M20 6v12',
  coffee: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM8.5 8.5l7 7',
  check: 'M5 12l5 5L20 7',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  x: 'M6 6l12 12M18 6L6 18',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  send: 'M4 12l16-8-6 16-3-7z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8a7 7 0 0 0 7 7z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  watch: 'M8 7h8v10H8zM9 3h6l1 4H8zM9 21h6l1-4H8z',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  stop: 'M6 6h12v12H6z',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M9 2h6',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  ruler: 'M4 16L16 4l4 4L8 20zM8 12l2 2M11 9l2 2M14 6l2 2',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 5v6h-6',
};
export function Icon({ name, size = 22, color = 'currentColor', stroke = 2, fill = 'none', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <path d={P[name] || P.info} />
    </svg>
  );
}

export const PILLAR = {
  sleep: { name: 'Sleep', icon: 'moon', color: 'var(--sleep)', tint: 'var(--tint-violet)' },
  recovery: { name: 'Recovery', icon: 'heart', color: 'var(--coral)', tint: 'var(--tint-coral)' },
  activity: { name: 'Activity', icon: 'pulse', color: 'var(--green)', tint: 'var(--tint-green)' },
  nutrition: { name: 'Fuel', icon: 'leaf', color: 'var(--amber)', tint: 'var(--tint-amber)' },
  hydration: { name: 'Water', icon: 'drop', color: 'var(--blue)', tint: 'var(--tint-blue)' },
  fitness: { name: 'Fitness', icon: 'dumbbell', color: 'var(--teal)', tint: 'var(--tint-teal)' },
  biomarkers: { name: 'Biomarkers', icon: 'file', color: 'var(--navy)', tint: 'var(--tint-blue)' },
};

export const bandColor = (name) => ({ Thrive: 'var(--green)', Steady: 'var(--teal)', 'Ease up': 'var(--amber)', Recover: 'var(--coral)' }[name] || 'var(--violet)');
export const confColor = (c) => (c === 'High' ? 'green' : c === 'Medium' ? 'teal' : 'amber');

// ---------------- building blocks ----------------
export function Btn({ kind = 'primary', block, sm, children, ...rest }) {
  return <button className={`btn ${kind} ${block ? 'block' : ''} ${sm ? 'sm' : ''}`} {...rest}>{children}</button>;
}
export function Toggle({ on, onChange, label }) {
  return <button role="switch" aria-checked={!!on} aria-label={label} className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}
export function Seg({ value, options, onChange }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([v, l]) => <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}
export function Sheet({ onClose, children, title }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title || 'Sheet'}>
        <div className="grab" />
        {title && <div className="row between" style={{ marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: 20 }}>{title}</h3><button className="icon-btn" style={{ width: 36, height: 36 }} onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div>}
        {children}
      </div>
    </>
  );
}
export function Back({ to = 'today', label = 'Back' }) {
  const { go } = useApp();
  return <button className="back" onClick={() => (to === -1 ? history.back() : go(to))}><Icon name="back" size={18} />{label}</button>;
}
export function Loading({ label = 'Loading' }) {
  return <div className="center muted" style={{ padding: 40 }}><div className="typing"><span /><span /><span /></div><div className="small" style={{ marginTop: 8 }}>{label}</div></div>;
}
export function ErrorBox({ error }) {
  return <div className="notice" style={{ margin: '20px 0' }}><Icon name="info" /> <div>{String(error?.message || error)}</div></div>;
}
export function Locked({ what }) {
  const { go } = useApp();
  return (
    <div className="card center" style={{ marginTop: 20 }}>
      <div className="ico" style={{ background: 'var(--tint-violet)', color: 'var(--violet)', margin: '0 auto 10px' }}><Icon name="lock" /></div>
      <h3>{what} is part of Health Track Plus</h3>
      <p className="muted small">Your Essentials plan keeps Health Genie and Nutrition. Upgrade back any time; your data was kept.</p>
      <Btn block onClick={() => go('plans')}>See plans</Btn>
    </div>
  );
}
export function SimBadge({ show = true }) {
  return show ? <span className="badge sim" title="Simulated wearable data for the demo">Simulated</span> : null;
}
export function Empty({ icon = 'info', title, body, action }) {
  return (
    <div className="card center">
      <div className="ico" style={{ background: 'var(--surface2)', margin: '0 auto 10px' }}><Icon name={icon} /></div>
      <h3>{title}</h3>
      {body && <p className="muted small" style={{ margin: '6px 0 12px' }}>{body}</p>}
      {action}
    </div>
  );
}

export function useHold(onHold, onTap, ms = 450) {
  const t = useRef(null);
  const held = useRef(false);
  return {
    onPointerDown: () => { held.current = false; t.current = setTimeout(() => { held.current = true; onHold(); }, ms); },
    onPointerUp: () => { clearTimeout(t.current); if (!held.current) onTap(); },
    onPointerLeave: () => clearTimeout(t.current),
    onContextMenu: (e) => e.preventDefault(),
  };
}

export const fmtH = (h) => { if (h == null) return '--'; const hh = Math.floor(h); const mm = Math.round((h - hh) * 60); return `${hh} h ${mm} m`; };
export const clock = (m) => { if (m == null) return '--'; m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60); return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`; };
export const dayName = (d, opts = { weekday: 'short' }) => new Date(d + 'T12:00').toLocaleDateString('en-US', opts);
