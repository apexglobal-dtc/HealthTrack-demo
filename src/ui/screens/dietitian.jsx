// Registered dietitian (RD) dashboard, Health Track 1.0 "Plus + Dietitian".
// RdDashboard and RdMember are the dietitian's side. MyDietitian and DietitianCard are the member's side.
import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, ErrorBox, Seg } from '../kit.jsx';

const dShort = (d) => new Date(d.slice(0, 10) + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const dDay = (d) => new Date(d.slice(0, 10) + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
const stamp = (at) => `${dShort(at)}${at.length > 10 ? ', ' + at.slice(11, 16) : ''}`;
const LEVEL = { warn: 'amber', info: 'teal', msg: 'violet' };
const DIET = { none: 'No diet limits', vegetarian: 'Vegetarian', vegan: 'Vegan', pescatarian: 'Pescatarian', keto: 'Keto', halal: 'Halal', kosher: 'Kosher' };
const fmt = (v, unit = '') => (v == null ? '–' : `${Math.round(v).toLocaleString()}${unit}`);

function Avatar({ name, live, size = 44 }) {
  return <span style={{ width: size, height: size, flex: 'none', borderRadius: 99, background: live ? 'var(--grad)' : 'var(--tint-blue)', color: live ? '#fff' : 'var(--violet)', fontWeight: 800, fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>;
}

function AlertChip({ a }) {
  return <span className={`chip ${LEVEL[a.level] || 'teal'}`} style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'normal', textAlign: 'left' }}>{a.text}</span>;
}

// ---------------- dietitian: member list ----------------
export function RdDashboard() {
  const { go } = useApp();
  const { data: r, error } = useLoad('rdRoster', {});
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading label="Loading your members" />;
  const s = r.stats;
  return (
    <div className="pro-page stack">
      <div className="rise">
        <div className="eyebrow">Health Track Pro · Dietitian</div>
        <h1 className="page">Your members</h1>
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <Avatar name={r.dietitian.name} size={30} live />
          <span className="small"><b>{r.dietitian.name}</b>, {r.dietitian.credentials}</span>
        </div>
      </div>
      <div className="pro-stats">
        <Stat label="Members" v={s.members} />
        <Stat label="Need attention" v={s.needAttention} color="var(--amber)" />
        <Stat label="Visits in the next 7 days" v={s.visitsThisWeek} />
        <Stat label="New messages" v={s.messages} color="var(--violet)" />
      </div>
      <div className="notice info"><Icon name="info" /><div className="small">Demo: the member marked <b>Live</b> is your own account, so changes the dietitian makes here show up in your app. The other members are samples. Members appear here only after they choose Plus + Dietitian and agree to share.</div></div>
      <div className="pro-grid">
        {r.members.map((m) => (
          <button key={m.id} className="card tap rise" style={{ textAlign: 'left' }} onClick={() => go('rd-member', { id: m.id, name: m.name })}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Avatar name={m.name} live={m.live} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <b>{m.name}</b>
                  {m.live ? <span className="chip green" style={{ fontSize: 11, padding: '2px 8px' }}>Live</span> : <Icon name="chev" size={18} color="var(--faint)" />}
                </div>
                <div className="xs muted">{[m.age && `${m.age}`, m.goals?.[0], DIET[m.diet] || m.diet].filter(Boolean).join(' · ')}</div>
                <div className="xs muted">Next visit {m.nextVisit ? dShort(m.nextVisit) : 'not booked'} · logged {m.logDays7} of 7 days</div>
                {m.alerts.length > 0
                  ? <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>{m.alerts.map((a) => <AlertChip key={a.key} a={a} />)}</div>
                  : <div className="xs" style={{ marginTop: 6, color: 'var(--green)' }}>On track, nothing to review</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="xs muted">Alerts are simple rules: logging on fewer than 4 of 7 days, losing more than 1% of body weight in a week, protein under 80% of target, fiber under 60%, eating below a set calorie floor, sleep under 6.5 hours, and lab values outside the optimal range.</p>
    </div>
  );
}

function Stat({ label, v, color = 'var(--text)' }) {
  return <div className="tile" style={{ padding: 12 }}><span className="xs muted">{label}</span><b className="num" style={{ fontSize: 26, color }}>{v}</b></div>;
}

// ---------------- dietitian: one member ----------------
export function RdMember() {
  const { params } = useApp();
  const id = params?.id || 'me';
  const [m, setM] = useState(null);
  const { data, error } = useLoad('rdMember', { id });
  if (error) return <ErrorBox error={error} />;
  const d = m && m.id === id ? m : data;
  if (!d) return <Loading label="Loading member" />;
  return (
    <div className="pro-page stack">
      <div className="row rise" style={{ gap: 12 }}>
        <Avatar name={d.name} live={d.live} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">{d.live ? 'Live member (your account)' : 'Sample member'}</div>
          <h1 className="page" style={{ margin: 0 }}>{d.name}</h1>
          <div className="xs muted">{[d.age, d.sex, d.heightCm && `${d.heightCm} cm`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      {d.notShared?.length > 0 && <div className="xs muted"><Icon name="lock" size={12} /> Not shared by the member: {d.notShared.map((k) => ({ food: 'food', body: 'weight', activity: 'sleep and activity', labs: 'labs', cycle: 'cycle' }[k])).join(', ')}</div>}
      <div className="pro-cols">
      <div className="col" style={{ gap: 14 }}>
      <div className="card">
        <div className="kv"><span>Goals</span><b>{d.goals.join(', ') || '–'}</b></div>
        <div className="kv"><span>Diet</span><b>{DIET[d.diet] || d.diet}{d.allergies.length ? ` · allergic to ${d.allergies.join(', ')}` : ''}</b></div>
        <div className="kv"><span>Member since</span><b>{dShort(d.since)}</b></div>
        <div className="kv"><span>Last visit</span><b>{dShort(d.lastVisit)}</b></div>
        <div className="kv"><span>Next visit</span><b>{d.nextVisit ? dShort(d.nextVisit) : 'Not booked'}</b></div>
      </div>
      {d.alerts.length > 0 && (
        <div className="card">
          <h3>To review</h3>
          <div className="col" style={{ gap: 6 }}>{d.alerts.map((a) => <div key={a.key} className="row small" style={{ gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 9, flex: 'none', background: `var(--${LEVEL[a.level] || 'teal'})` }} />{a.text}</div>)}</div>
        </div>
      )}
      <Snapshot d={d} />
      <WeightTrend d={d} />
      <WeekLog d={d} />
      {d.labs.length > 0 && (
        <div className="card">
          <h3>Labs</h3>
          {d.labs.map((l) => <div key={l.key} className="kv"><span>{l.name}</span><b>{l.value} {l.unit} <span className={`chip ${l.status === 'Optimal' || l.status === 'In range' ? 'green' : 'amber'}`} style={{ fontSize: 11, padding: '2px 8px', marginLeft: 4 }}>{l.status}</span></b></div>)}
        </div>
      )}
      </div>
      <div className="col" style={{ gap: 14 }}>
      <PlanView d={d} />
      <Settings d={d} onSaved={setM} />
      <Notes d={d} onSaved={setM} />
      <Messages d={d} onSaved={setM} />
      </div>
      </div>
      <p className="xs muted">Shared with the member's consent under Plus + Dietitian. The member can stop sharing at any time from Privacy and data.</p>
    </div>
  );
}

function Snapshot({ d }) {
  const lose = d.weeklyLossKg;
  return (
    <div className="card">
      <h3>Last 7 days</h3>
      <div className="grid2" style={{ gap: 8 }}>
        <Mini label="Weight" v={d.weightKg ? `${d.weightKg} kg` : '–'} sub={lose != null ? (lose > 0 ? `Down ${lose} kg this week` : lose < 0 ? `Up ${-lose} kg this week` : 'No change this week') : d.targetKg ? `Target ${d.targetKg} kg` : ''} />
        <Mini label="Food logged" v={`${d.logDays7} of 7 days`} sub={d.logDays7 < 4 ? 'Low logging' : 'Good logging'} />
        <Mini label="Consumed, average" v={fmt(d.kcalAvg, ' kcal')} sub={`Target ${fmt(d.kcalTarget)}`} />
        <Mini label="Burned, average" v={fmt(d.burnAvg, ' kcal')} sub={d.kcalAvg != null && d.burnAvg != null ? `Net ${(d.kcalAvg - d.burnAvg).toLocaleString()} kcal a day` : ''} />
        <Mini label="Protein, average" v={fmt(d.proteinAvg, ' g')} sub={`Target ${fmt(d.proteinTarget)} g`} />
        <Mini label="Fiber, average" v={fmt(d.fiberAvg, ' g')} sub={`Target ${fmt(d.fiberTarget)} g`} />
        <Mini label="Sleep" v={d.sleepAvg != null ? `${d.sleepAvg} h` : '–'} sub="a night" />
        <Mini label="Steps" v={fmt(d.stepsAvg)} sub="a day" />
      </div>
    </div>
  );
}
function Mini({ label, v, sub }) {
  return <div className="tile" style={{ padding: 10, gap: 2 }}><span className="xs muted">{label}</span><b className="num">{v}</b>{sub && <span className="xs faint">{sub}</span>}</div>;
}

function WeightTrend({ d }) {
  const pts = d.weightTrend || [];
  if (pts.length < 2) return null;
  const W = 300, H = 90, pad = 8;
  const kgs = pts.map((p) => p.kg);
  const lo = Math.min(...kgs, d.targetKg || Infinity) - 0.5, hi = Math.max(...kgs) + 0.5;
  const x = (i) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (kg) => pad + (1 - (kg - lo) / (hi - lo)) * (H - pad * 2);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <div className="card">
      <div className="row between"><h3 style={{ margin: 0 }}>Weight trend</h3><span className="xs muted">{pts[0].kg} → {pts[pts.length - 1].kg} kg</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 8 }} role="img" aria-label={`Weight from ${pts[0].kg} to ${pts[pts.length - 1].kg} kg`}>
        {d.targetKg && d.targetKg >= lo && <><line x1={pad} x2={W - pad} y1={y(d.targetKg)} y2={y(d.targetKg)} stroke="var(--green)" strokeDasharray="4 4" strokeWidth="1.5" /><text x={W - pad} y={y(d.targetKg) - 4} textAnchor="end" fontSize="10" fill="var(--green)">Target {d.targetKg} kg</text></>}
        <path d={path} fill="none" stroke="var(--violet)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.kg)} r={i === pts.length - 1 ? 4 : 2.5} fill="var(--violet)" />)}
      </svg>
      <div className="row between xs faint"><span>{dShort(pts[0].date)}</span><span>{dShort(pts[pts.length - 1].date)}</span></div>
    </div>
  );
}

function WeekLog({ d }) {
  return (
    <div className="card">
      <h3>Day by day</h3>
      <div className="row xs muted" style={{ fontWeight: 700, paddingBottom: 4 }}><span style={{ flex: 1.2 }}>Day</span><span style={{ flex: 1, textAlign: 'right' }}>Consumed</span><span style={{ flex: 1, textAlign: 'right' }}>Burned</span><span style={{ flex: 1, textAlign: 'right' }}>Protein</span></div>
      {d.days.map((x) => (
        <div key={x.date} className="kv" style={{ padding: '6px 0', fontSize: 13 }}>
          <span style={{ flex: 1.2 }}>{dDay(x.date)}</span>
          <b style={{ flex: 1, textAlign: 'right', color: x.kcal == null ? 'var(--faint)' : undefined }}>{x.kcal == null ? 'Not logged' : x.kcal.toLocaleString()}</b>
          <span style={{ flex: 1, textAlign: 'right' }}>{fmt(x.burned)}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{x.protein == null ? '–' : `${x.protein} g`}</span>
        </div>
      ))}
      <div className="xs muted" style={{ marginTop: 6 }}>kcal. Burned is resting energy plus steps and workouts, or the wearable's measured active calories.</div>
    </div>
  );
}

function PlanView({ d }) {
  const g = d.plan.goal;
  const by = g.setBy || [];
  const set = (k) => (by.includes(k) ? <span className="chip violet" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>You set this</span> : null);
  return (
    <div className="card">
      <h3>Today's plan in the member's app</h3>
      <div className="kv"><span>Energy</span><b>{g.kcal.toLocaleString()} kcal{set('kcal')}</b></div>
      <div className="kv"><span>Protein</span><b>{g.protein} g{set('protein')}</b></div>
      <div className="kv"><span>Carbs · Fat · Fiber</span><b>{g.carbs} g · {g.fat} g · {g.fiber} g</b></div>
      <div className="col" style={{ gap: 4, marginTop: 10 }}>
        {d.plan.meals.filter((m) => !m.empty).map((m) => <div key={m.slot} className="row small" style={{ gap: 8 }}><span className="xs muted" style={{ width: 70 }}>{m.label}</span><span style={{ flex: 1, minWidth: 0 }}>{m.out ? 'Eating out' : m.name}</span>{m.totals?.kcal != null && !m.out && <span className="xs faint">{Math.round(m.totals.kcal)} kcal</span>}</div>)}
      </div>
    </div>
  );
}

function Settings({ d, onSaved }) {
  const { call, toast, bump } = useApp();
  const s0 = d.settings || {};
  const [ppk, setPpk] = useState(s0.proteinPerKg ?? '');
  const [floor, setFloor] = useState(s0.kcalFloor ?? '');
  const [pace, setPace] = useState(s0.pace || d.pace || 'steady');
  const [avoid, setAvoid] = useState(s0.avoid || []);
  const [busy, setBusy] = useState(false);
  const lose = d.weightGoal === 'lose';
  const planIds = d.plan.meals.filter((m) => m.recipeId).map((m) => ({ id: m.recipeId, name: m.name }));
  const named = (rid) => d.recipes.find((r) => r.id === rid)?.name || planIds.find((r) => r.id === rid)?.name || rid;
  const toggle = (rid) => setAvoid((a) => (a.includes(rid) ? a.filter((x) => x !== rid) : [...a, rid]));
  async function saveIt() {
    setBusy(true);
    try {
      const out = await call('rdSave', { id: d.id, settings: { proteinPerKg: ppk, kcalFloor: floor, pace: lose ? pace : undefined, avoid } });
      onSaved(out); bump();
      toast(d.live ? 'Saved. The member\'s plan is updated.' : 'Saved');
    } catch (e) { toast(e.message || 'Could not save'); }
    setBusy(false);
  }
  const kg = d.weightKg || 70;
  return (
    <div className="card tint">
      <h3>Your settings for this plan</h3>
      <div className="xs muted" style={{ marginBottom: 10 }}>These replace the app's own rules. The member sees "Set by your dietitian" next to each one.</div>
      <div className="field">
        <label>Protein, g per kg body weight (0.8 to 2.2)</label>
        <input className="input" type="number" step="0.1" min="0.8" max="2.2" inputMode="decimal" placeholder="App rule" value={ppk} onChange={(e) => setPpk(e.target.value)} aria-label="Protein per kg" />
        {ppk !== '' && Number(ppk) >= 0.8 && Number(ppk) <= 2.2 && <div className="xs muted" style={{ marginTop: 4 }}>About {Math.round(Number(ppk) * kg)} g a day at {kg} kg</div>}
      </div>
      <div className="field">
        <label>Minimum calories a day (1,000 to 3,000)</label>
        <input className="input" type="number" step="10" min="1000" max="3000" inputMode="numeric" placeholder="No minimum" value={floor} onChange={(e) => setFloor(e.target.value)} aria-label="Calorie floor" />
      </div>
      {lose && (
        <div className="field">
          <label>Weight loss pace</label>
          <Seg value={pace} onChange={setPace} options={[['gentle', 'Gentle'], ['steady', 'Steady'], ['faster', 'Faster']]} />
        </div>
      )}
      <div className="field">
        <label>Recipes not to offer</label>
        {avoid.length > 0 && <div className="row wrap" style={{ gap: 6, marginBottom: 6 }}>{avoid.map((rid) => <button key={rid} className="chip coral" onClick={() => toggle(rid)}>{named(rid)} <Icon name="x" size={12} /></button>)}</div>}
        <div className="xs muted" style={{ marginBottom: 4 }}>Tap a meal from today's plan to remove it:</div>
        <div className="row wrap" style={{ gap: 6 }}>{planIds.filter((r) => !avoid.includes(r.id)).map((r) => <button key={r.id} className="chip select" onClick={() => toggle(r.id)}>{r.name}</button>)}</div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Btn block disabled={busy} onClick={saveIt}>{busy ? 'Saving...' : 'Save settings'}</Btn>
        {Object.keys(s0).length > 0 && <Btn kind="secondary" disabled={busy} onClick={() => { setPpk(''); setFloor(''); setAvoid([]); }}>Clear</Btn>}
      </div>
    </div>
  );
}

function Notes({ d, onSaved }) {
  const { call, toast } = useApp();
  const [text, setText] = useState('');
  async function add() {
    try { onSaved(await call('rdNote', { id: d.id, text })); setText(''); toast('Note saved'); } catch (e) { toast(e.message); }
  }
  return (
    <div className="card">
      <h3>Visit notes</h3>
      <div className="xs muted" style={{ marginBottom: 8 }}>Private to you. The member does not see notes.</div>
      {d.notes.length === 0 && <div className="small muted">No notes yet.</div>}
      {[...d.notes].reverse().map((n, i) => <div key={i} style={{ padding: '8px 0', borderBottom: '1px dashed var(--line)' }}><div className="xs muted">{stamp(n.at)}</div><div className="small">{n.text}</div></div>)}
      <textarea className="input" rows={3} style={{ marginTop: 10 }} placeholder="Add a note" value={text} onChange={(e) => setText(e.target.value)} aria-label="New note" />
      <Btn sm style={{ marginTop: 8 }} disabled={!text.trim()} onClick={add}>Save note</Btn>
    </div>
  );
}

function Thread({ messages, mine }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {messages.length === 0 && <div className="small muted">No messages yet.</div>}
      {messages.map((x, i) => {
        const me = x.from === mine;
        return (
          <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div className="small" style={{ padding: '9px 12px', borderRadius: 16, background: me ? 'var(--violet)' : 'var(--surface2)', color: me ? '#fff' : 'var(--text)' }}>{x.text}</div>
            <div className="xs faint" style={{ textAlign: me ? 'right' : 'left', marginTop: 2 }}>{stamp(x.at)}</div>
          </div>
        );
      })}
    </div>
  );
}

function Composer({ onSend, placeholder }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await onSend(text); setText(''); } finally { setBusy(false); }
  }
  return (
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <input className="input" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} aria-label="Message" />
      <Btn sm disabled={busy || !text.trim()} onClick={send} aria-label="Send"><Icon name="send" size={18} /></Btn>
    </div>
  );
}

function Messages({ d, onSaved }) {
  const { call, toast, bump } = useApp();
  return (
    <div className="card">
      <h3>Messages with {d.name.split(' ')[0]}</h3>
      <Thread messages={d.messages} mine="rd" />
      <Composer placeholder="Write to the member" onSend={async (text) => { try { onSaved(await call('rdMessage', { id: d.id, text })); bump(); toast('Sent'); } catch (e) { toast(e.message); } }} />
    </div>
  );
}

// ---------------- member side ----------------
export function DietitianCard() {
  const { go } = useApp();
  const { data: r } = useLoad('myDietitian', {});
  if (!r) return null;
  const last = r.messages.at(-1);
  return (
    <button className="card tap rise" style={{ textAlign: 'left' }} onClick={() => go('my-dietitian')}>
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={r.dietitian.name} size={40} live />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b className="small">Your dietitian, {r.dietitian.name}</b>
          <div className="xs muted">{r.dietitian.credentials}{r.nextVisit ? ` · next visit ${dShort(r.nextVisit)}` : ''}</div>
        </div>
        <Icon name="chev" size={18} color="var(--faint)" />
      </div>
      {last && <div className="xs" style={{ marginTop: 8, background: 'var(--surface2)', borderRadius: 12, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.from === 'rd' ? '' : 'You: '}{last.text}</div>}
    </button>
  );
}

export function MyDietitian() {
  const { call, toast, bump, params } = useApp();
  const { data: r, error, reload } = useLoad('myDietitian', {});
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading />;
  const s = r.settings || {};
  const items = [
    s.proteinPerKg && `Protein: ${s.proteinPerKg} g per kg of body weight`,
    s.kcalFloor && `At least ${s.kcalFloor.toLocaleString()} kcal a day`,
    s.pace && `Weight loss pace: ${s.pace}`,
    s.avoid?.length && `${s.avoid.length} recipe${s.avoid.length > 1 ? 's' : ''} left out of your meal plan`,
  ].filter(Boolean);
  return (
    <div className="stack">
      <Back to={params?.back || 'profile'} />
      <div className="rise"><div className="eyebrow">Plus + Dietitian</div><h1 className="page">Your dietitian</h1></div>
      <div className="card row" style={{ gap: 12 }}>
        <Avatar name={r.dietitian.name} size={52} live />
        <div style={{ flex: 1 }}>
          <b>{r.dietitian.name}</b>
          <div className="xs muted">{r.dietitian.credentials} · Registered dietitian</div>
          <div className="xs muted">Last visit {dShort(r.lastVisit)}{r.nextVisit ? ` · next ${dShort(r.nextVisit)}` : ''}</div>
        </div>
      </div>
      <div className="card">
        <h3>Set by your dietitian</h3>
        {items.length ? items.map((t) => <div key={t} className="row small" style={{ gap: 8, padding: '4px 0' }}><Icon name="check" size={16} color="var(--green)" />{t}</div>)
          : <div className="small muted">Nothing yet. Your plan follows Health Track's own rules until your dietitian changes something.</div>}
        <div className="xs muted" style={{ marginTop: 6 }}>Your dietitian's settings take priority over the app's rules in your meal plan.</div>
      </div>
      <div className="card">
        <h3>Messages</h3>
        <Thread messages={r.messages} mine="member" />
        <Composer placeholder={`Write to ${r.dietitian.name.split(' ')[0]}`} onSend={async (text) => { try { await call('memberMessage', { text }); await reload(); bump(); toast('Sent'); } catch (e) { toast(e.message); } }} />
        <div className="xs muted" style={{ marginTop: 8 }}>For urgent health concerns, contact your doctor or emergency services.</div>
      </div>
    </div>
  );
}
