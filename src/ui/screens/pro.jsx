// Health Track Pro (web dashboard for professionals) and the member's Care team (consent).
// One platform, four audiences: dietitian (HT 1.0), sports coach and corporate wellness (HT 2.0),
// healthcare provider (HT 3.0). Every view reads only what the member chose to share.
import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, ErrorBox, Toggle, asset } from '../kit.jsx';

const dShort = (d) => new Date(d.slice(0, 10) + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const stamp = (at) => `${dShort(at)}${at.length > 10 ? ', ' + at.slice(11, 16) : ''}`;
const LEVEL = { warn: 'amber', info: 'teal', msg: 'violet', good: 'green' };

export const PRO_ROUTE_ROLE = { 'pro-signin': null, rd: 'dietitian', 'rd-member': 'dietitian', 'pro-coach': 'coach', 'pro-athlete': 'coach', 'pro-employer': 'employer', 'pro-provider': 'provider', 'pro-patient': 'provider' };
const HOME = { dietitian: 'rd', coach: 'pro-coach', employer: 'pro-employer', provider: 'pro-provider' };
const DETAIL = { 'rd-member': 'rd', 'pro-athlete': 'pro-coach', 'pro-patient': 'pro-provider' };
const ACCOUNTS = [
  { role: 'dietitian', name: 'Dana Lee', title: 'Registered dietitian, RDN, LD', org: 'Health Track Dietitian Network', email: 'dana.lee@pro.myhealthtrack.ai', stage: 'Live · HT 1.0', icon: 'leaf', color: 'var(--green)', tint: 'var(--tint-green)' },
  { role: 'coach', name: 'Alex Rivera', title: 'Head coach, CSCS', org: 'Riverside FC Academy, U19', email: 'alex.rivera@riversidefc.example', stage: 'Preview · HT 2.0', icon: 'dumbbell', color: 'var(--teal)', tint: 'var(--tint-teal)' },
  { role: 'employer', name: 'Morgan Chen', title: 'Wellbeing lead', org: 'Northwind Logistics', email: 'morgan.chen@northwind.example', stage: 'Preview · HT 2.0', icon: 'users', color: 'var(--violet)', tint: 'var(--tint-violet)' },
  { role: 'provider', name: 'Dr. Sam Patel', title: 'MD, Internal Medicine', org: 'Lakeside Family Clinic', email: 's.patel@lakesideclinic.example', stage: 'Preview · HT 3.0', icon: 'heart', color: 'var(--coral)', tint: 'var(--tint-coral)' },
];

export function Avatar({ name, live, size = 44 }) {
  return <span style={{ width: size, height: size, flex: 'none', borderRadius: 99, background: live ? 'var(--grad)' : 'var(--tint-blue)', color: live ? '#fff' : 'var(--violet)', fontWeight: 800, fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{name.replace(/^Dr\. /, '').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>;
}
export const AlertChip = ({ a }) => <span className={`chip ${LEVEL[a.level] || 'teal'}`} style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'normal', textAlign: 'left' }}>{a.text}</span>;
const Stat = ({ label, v, color = 'var(--text)', sub }) => <div className="tile" style={{ padding: 12, gap: 2 }}><span className="xs muted">{label}</span><b className="num" style={{ fontSize: 26, color }}>{v}</b>{sub && <span className="xs faint">{sub}</span>}</div>;
const NotShared = ({ list }) => (list?.length ? <div className="xs muted" style={{ marginTop: 6 }}><Icon name="lock" size={12} /> Not shared by the member: {list.map((k) => ({ food: 'food', body: 'weight', activity: 'sleep and activity', labs: 'labs', cycle: 'cycle' }[k])).join(', ')}</div> : null);

// ---------------- the pro web frame ----------------
export function ProBar() {
  const { go, route, params } = useApp();
  const role = PRO_ROUTE_ROLE[route];
  const acct = ACCOUNTS.find((a) => a.role === role);
  return (
    <div className="probar">
      <div className="pro-url"><span className="dot" /><span className="dot" /><span className="dot" /><span className="pro-url-text"><Icon name="lock" size={11} /> pro.myhealthtrack.ai{route === 'pro-signin' ? '/sign-in' : `/${role}`}</span></div>
      <div className="pro-head">
        <button className="pro-brand" onClick={() => go(role ? HOME[role] : 'pro-signin')}>
          <img src={asset('logo.png')} alt="" /><b>Health Track <span className="gradtext">Pro</span></b>
        </button>
        {acct && (
          <div className="row" style={{ gap: 10 }}>
            <span className="pro-who"><Avatar name={acct.name} size={28} live /><span><b className="small">{acct.name}</b><span className="xs muted pro-hide-sm"> · {acct.org}</span></span></span>
            <button className="link xs" onClick={() => go('pro-signin')}>Switch account</button>
          </div>
        )}
        {!acct && <button className="link xs" onClick={() => go('profile')}>Back to the member app</button>}
      </div>
      {DETAIL[route] && <div className="pro-crumb xs"><button className="link xs" onClick={() => go(DETAIL[route])}>{role === 'coach' ? 'Team' : role === 'provider' ? 'Patients' : 'Members'}</button><span className="muted"> / </span><span className="muted">{params?.name || 'Detail'}</span></div>}
    </div>
  );
}

export function ProSignIn() {
  const { go } = useApp();
  const [pick, setPick] = useState('dietitian');
  const acct = ACCOUNTS.find((a) => a.role === pick);
  return (
    <div className="pro-page">
      <div className="pro-signin">
        <div>
          <div className="eyebrow">Health Track Pro</div>
          <h1 className="page" style={{ marginTop: 2 }}>One platform for the people your members trust</h1>
          <p className="muted small" style={{ maxWidth: 460 }}>Dietitians, coaches, employers and clinicians each get their own view, built on the same core: a member list with alerts, member detail, plan settings, notes and messages. Members choose who sees what, and can stop sharing at any time.</p>
          <div className="col" style={{ gap: 8, marginTop: 14 }}>
            {ACCOUNTS.map((a) => (
              <button key={a.role} className={`card tap row pro-acct ${pick === a.role ? 'on' : ''}`} style={{ gap: 12, textAlign: 'left', padding: 12 }} onClick={() => setPick(a.role)}>
                <span className="ico" style={{ background: a.tint, color: a.color }}><Icon name={a.icon} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><b className="small">{a.name}</b><div className="xs muted">{a.title} · {a.org}</div></span>
                <span className={`chip ${a.stage.startsWith('Live') ? 'green' : 'teal'}`} style={{ fontSize: 10, padding: '2px 8px', flex: 'none' }}>{a.stage}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3>Sign in</h3>
          <div className="field"><label>Work email</label><input className="input" value={acct.email} readOnly aria-label="Work email" /></div>
          <div className="field" style={{ marginTop: 10 }}><label>Password</label><input className="input" type="password" value="demo-password" readOnly aria-label="Password" /></div>
          <Btn block style={{ marginTop: 14 }} onClick={() => go(HOME[pick])}>Sign in as {acct.name}</Btn>
          <div className="xs muted" style={{ marginTop: 10 }}>Demo accounts only. Nothing is created and no password is checked. In the real product, professionals sign in on the web with two-step verification, and their organization is verified before any member can connect.</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- coach ----------------
const SESS_COLOR = { push: 'green', planned: 'teal', lighter: 'amber', rest: 'coral' };
function Spark({ values, color = 'var(--violet)', h = 28, w = 90, full }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return <span className="xs faint">–</span>;
  const lo = Math.min(...v), hi = Math.max(...v) || 1;
  const pts = values.map((x, i) => (x == null ? null : `${(i / (values.length - 1)) * w},${h - 3 - ((x - lo) / Math.max(1, hi - lo)) * (h - 6)}`)).filter(Boolean).join(' ');
  return <svg width={full ? '100%' : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export function CoachDashboard() {
  const { go, call, toast, bump } = useApp();
  const { data: r, error, reload } = useLoad('coachRoster', {});
  const [msg, setMsg] = useState('');
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading label="Loading your team" />;
  const s = r.stats;
  return (
    <div className="pro-page stack">
      <div className="rise"><div className="eyebrow">Riverside FC Academy · U19</div><h1 className="page">Team readiness today</h1></div>
      <div className="pro-stats">
        <Stat label="Athletes sharing" v={s.athletes} />
        <Stat label="Ready to train" v={s.ready} color="var(--green)" />
        <Stat label="Flagged" v={s.flagged} color="var(--amber)" />
        <Stat label="Checking in regularly" v={`${s.checkedIn}/${s.athletes}`} />
      </div>
      <div className="card">
        <div className="pro-table">
          <div className="pro-tr pro-th xs muted"><span>Athlete</span><span>Readiness</span><span className="pro-hide-sm">Last 7 days</span><span>Sleep</span><span>Load (ACWR)</span><span>Next session</span></div>
          {r.athletes.map((a) => (
            <button key={a.id} className="pro-tr tap" onClick={() => go('pro-athlete', { id: a.id, name: a.name })}>
              <span className="row" style={{ gap: 8, minWidth: 0 }}><Avatar name={a.name} live={a.live} size={30} /><span style={{ minWidth: 0 }}><b className="small">{a.name}</b>{a.live && <span className="chip green" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 6 }}>Live</span>}<div className="xs muted">{a.position}</div></span></span>
              <span><b className="num" style={{ color: a.readiness == null ? 'var(--faint)' : a.readiness >= 60 ? 'var(--green)' : a.readiness >= 50 ? 'var(--amber)' : 'var(--coral)' }}>{a.readiness ?? '–'}</b></span>
              <span className="pro-hide-sm"><Spark values={a.readiness7} /></span>
              <span className="small">{a.sleepH != null ? `${a.sleepH} h` : '–'}</span>
              <span className="small" style={{ color: a.acwr > 1.5 ? 'var(--coral)' : undefined, fontWeight: a.acwr > 1.5 ? 700 : 400 }}>{a.acwr ?? '–'}</span>
              <span><span className={`chip ${SESS_COLOR[a.session?.session || a.suggested]}`} style={{ fontSize: 11, padding: '2px 8px' }}>{a.session ? a.session.label : `${r.sessions[a.suggested]} (suggested)`}</span></span>
            </button>
          ))}
        </div>
        <div className="xs muted" style={{ marginTop: 8 }}>Readiness blends sleep, recovery and training load. ACWR compares this week's load with the last four weeks; above 1.5 is linked to higher injury risk.</div>
      </div>
      <div className="pro-cols">
        <div className="card">
          <h3>Flags before training</h3>
          {r.athletes.filter((a) => a.alerts.length).map((a) => <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}><b className="small">{a.name}</b><div className="row wrap" style={{ gap: 5, marginTop: 4 }}>{a.alerts.map((x) => <AlertChip key={x.key} a={x} />)}</div></div>)}
        </div>
        <div className="card">
          <h3>Team announcement</h3>
          {r.announcements.slice(-3).reverse().map((x, i) => <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}><div className="xs muted">{stamp(x.at)}</div>{x.text}</div>)}
          <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="e.g. Recovery session moved to 9 AM tomorrow" value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Announcement" />
          <Btn sm style={{ marginTop: 8 }} disabled={!msg.trim()} onClick={async () => { try { await call('coachAnnounce', { text: msg }); setMsg(''); await reload(); bump(); toast('Sent to the team'); } catch (e) { toast(e.message); } }}>Send to team</Btn>
          <div className="xs muted" style={{ marginTop: 8 }}>Athletes see it on their Care team page.</div>
        </div>
      </div>
      <p className="xs muted">Coaches see sleep, readiness, training load and check-ins only. Food, weight, labs and cycle details stay private unless an athlete chooses to share them. For athletes under 18, a parent or guardian approves sharing.</p>
    </div>
  );
}

export function CoachAthlete() {
  const { params, call, toast, bump } = useApp();
  const id = params?.id;
  const [a2, setA] = useState(null);
  const [note, setNote] = useState('');
  const { data, error } = useLoad('coachAthlete', { id });
  if (error) return <ErrorBox error={error} />;
  const a = a2 || data;
  if (!a) return <Loading />;
  const max = Math.max(1, ...a.load7.filter((x) => x != null));
  return (
    <div className="pro-page stack">
      <div className="row rise" style={{ gap: 12 }}><Avatar name={a.name} live={a.live} size={52} /><div><div className="eyebrow">{a.live ? 'Live athlete (your member account)' : 'Sample athlete'}</div><h1 className="page" style={{ margin: 0 }}>{a.name}</h1><div className="xs muted">{a.position} · {a.age}</div></div></div>
      <NotShared list={a.notShared} />
      <div className="pro-stats">
        <Stat label="Readiness" v={a.readiness ?? '–'} />
        <Stat label="Sleep last night" v={a.sleepH != null ? `${a.sleepH} h` : '–'} />
        <Stat label="Load (ACWR)" v={a.acwr ?? '–'} color={a.acwr > 1.5 ? 'var(--coral)' : undefined} />
        <Stat label="Check-ins" v={`${a.checkins7} of 7`} />
      </div>
      <div className="pro-cols">
        <div className="card">
          <h3>Training load, last 7 days</h3>
          <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 90 }}>{a.load7.map((x, i) => <div key={i} style={{ flex: 1, height: `${((x || 0) / max) * 100}%`, minHeight: 2, borderRadius: 6, background: i === 6 ? 'var(--violet)' : 'var(--tint-violet)' }} />)}</div>
          <div className="row between xs faint" style={{ marginTop: 4 }}><span>7 days ago</span><span>Today</span></div>
          <div className="divider" />
          <h3>Readiness, last 7 days</h3>
          <Spark values={a.readiness7} w={300} h={60} full />
          {a.alerts.length > 0 && <><div className="divider" /><div className="row wrap" style={{ gap: 5 }}>{a.alerts.map((x) => <AlertChip key={x.key} a={x} />)}</div></>}
        </div>
        <div className="card tint">
          <h3>Next session</h3>
          <div className="xs muted" style={{ marginBottom: 8 }}>Suggested from readiness and load: <b>{a.sessions[a.suggested]}</b>. Your choice shows in the athlete's app.</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {Object.entries(a.sessions).map(([k, l]) => <button key={k} className={`chip select ${a.session?.session === k ? 'on' : ''}`} onClick={async () => { try { setA(await call('coachSet', { id: a.id, session: k })); bump(); toast(`Next session: ${l}`); } catch (e) { toast(e.message); } }}>{l}</button>)}
          </div>
          {a.session && <div className="xs muted" style={{ marginTop: 8 }}>Set {stamp(a.session.at)}</div>}
          <div className="divider" />
          <h3>Notes</h3>
          {a.notes.map((n, i) => <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}><div className="xs muted">{stamp(n.at)}</div>{n.text}</div>)}
          <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
          <Btn sm style={{ marginTop: 8 }} disabled={!note.trim()} onClick={async () => { try { setA(await call('coachNote', { id: a.id, text: note })); setNote(''); toast('Note saved'); } catch (e) { toast(e.message); } }}>Save note</Btn>
        </div>
      </div>
    </div>
  );
}

// ---------------- employer ----------------
export function EmployerDashboard() {
  const { call, toast, bump } = useApp();
  const { data: r, error, reload } = useLoad('employerDash', {});
  const [msg, setMsg] = useState('');
  const [ch, setCh] = useState({ name: '', kind: 'Sleep', days: 14 });
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading label="Loading your program" />;
  const wk = r.weeks;
  const maxA = Math.max(...wk.map((w) => w.active));
  return (
    <div className="pro-page stack">
      <div className="rise"><div className="eyebrow">{r.org} · Wellbeing program</div><h1 className="page">Program overview</h1></div>
      <div className="notice violet"><Icon name="shield" /><div className="small"><b>Group totals only.</b> You never see a person's name next to a health number, and any group smaller than {r.minGroup} people is hidden. Employees join with a code and can leave at any time.{r.youJoined ? ' Your member account is counted in these totals.' : ''}</div></div>
      <div className="pro-stats">
        <Stat label="Enrolled" v={r.enrolled} sub={`${r.enrollRate}% of ${r.eligible} eligible`} />
        <Stat label="Active this week" v={`${r.activeRate}%`} color="var(--green)" />
        <Stat label="Average sleep" v={`${r.sleepH} h`} />
        <Stat label="Average steps" v={r.steps.toLocaleString()} />
      </div>
      <div className="pro-cols">
        <div className="card">
          <h3>Weekly active members</h3>
          <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 100 }}>{wk.map((w) => <div key={w.week} title={`${w.active}%`} style={{ flex: 1, height: `${(w.active / maxA) * 100}%`, borderRadius: 6, background: 'var(--grad)' }} />)}</div>
          <div className="row between xs faint" style={{ marginTop: 4 }}><span>8 weeks ago</span><span>This week</span></div>
          <div className="divider" />
          <h3>What we're seeing</h3>
          {r.insights.map((x, i) => <div key={i} className="row small" style={{ gap: 8, padding: '4px 0', alignItems: 'flex-start' }}><span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 9, flex: 'none', background: `var(--${LEVEL[x.level]})` }} />{x.text}</div>)}
        </div>
        <div className="card">
          <h3>By department</h3>
          <div className="pro-table">
            <div className="pro-tr pro-th5 xs muted"><span>Department</span><span>Enrolled</span><span>Active</span><span>Sleep</span><span>Stress</span></div>
            {r.depts.map((d) => d.hidden
              ? <div key={d.name} className="pro-tr pro-th5 small"><span>{d.name}</span><span>{d.enrolled}</span><span className="xs muted" style={{ gridColumn: 'span 3' }}>Hidden: fewer than {r.minGroup} people</span></div>
              : <div key={d.name} className="pro-tr pro-th5 small"><span>{d.name}</span><span>{d.enrolled}</span><span>{Math.round(d.active * 100)}%</span><span>{d.sleepH} h <span className="xs" style={{ color: d.sleepTrend < 0 ? 'var(--coral)' : 'var(--green)' }}>{d.sleepTrend > 0 ? '+' : ''}{d.sleepTrend || ''}</span></span><span style={{ color: d.stress === 'Rising' ? 'var(--amber)' : undefined }}>{d.stress}</span></div>)}
          </div>
        </div>
      </div>
      <div className="pro-cols">
        <div className="card">
          <h3>Challenges</h3>
          {r.challenges.map((c, i) => <div key={i} className="kv"><span>{c.name} <span className="xs muted">· {c.kind}</span></span><b className="small">{c.startsOn ? `Starts ${dShort(c.startsOn)}` : `${c.joined} joined · day ${c.dayNow} of ${c.days}`}</b></div>)}
          <div className="divider" />
          <div className="field"><label>New challenge</label><input className="input" placeholder="Name, e.g. Month-end reset" value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} aria-label="Challenge name" /></div>
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{['Steps', 'Sleep', 'Breathing', 'Hydration'].map((k) => <button key={k} className={`chip select ${ch.kind === k ? 'on' : ''}`} onClick={() => setCh({ ...ch, kind: k })}>{k}</button>)}</div>
          <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>{[7, 14, 21].map((d) => <button key={d} className={`chip select ${ch.days === d ? 'on' : ''}`} onClick={() => setCh({ ...ch, days: d })}>{d} days</button>)}</div>
          <Btn sm style={{ marginTop: 10 }} onClick={async () => { try { await call('employerChallenge', ch); setCh({ name: '', kind: 'Sleep', days: 14 }); await reload(); bump(); toast('Challenge launched'); } catch (e) { toast(e.message); } }}>Launch challenge</Btn>
        </div>
        <div className="card">
          <h3>Announcement to members</h3>
          {r.announcements.slice(-3).reverse().map((x, i) => <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}><div className="xs muted">{stamp(x.at)}</div>{x.text}</div>)}
          <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="e.g. Free flu shots in the lobby on Thursday" value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Announcement" />
          <Btn sm style={{ marginTop: 8 }} disabled={!msg.trim()} onClick={async () => { try { await call('employerAnnounce', { text: msg }); setMsg(''); await reload(); bump(); toast('Announcement sent'); } catch (e) { toast(e.message); } }}>Send</Btn>
        </div>
      </div>
    </div>
  );
}

// ---------------- provider ----------------
export function ProviderDashboard() {
  const { go } = useApp();
  const { data: r, error } = useLoad('providerRoster', {});
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading label="Loading your patients" />;
  const s = r.stats;
  return (
    <div className="pro-page stack">
      <div className="rise"><div className="eyebrow">Lakeside Family Clinic</div><h1 className="page">Patients between visits</h1></div>
      <div className="pro-stats">
        <Stat label="Patients sharing" v={s.patients} />
        <Stat label="Lab values rising" v={s.rising} color="var(--amber)" />
        <Stat label="Follow-up labs due" v={s.careGaps} color="var(--coral)" />
        <Stat label="Visits in 14 days" v={s.visitsSoon} />
      </div>
      <div className="pro-grid">
        {r.patients.map((p) => (
          <button key={p.id} className="card tap" style={{ textAlign: 'left' }} onClick={() => go('pro-patient', { id: p.id, name: p.name })}>
            <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
              <Avatar name={p.name} live={p.live} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between"><b>{p.name}</b>{p.live ? <span className="chip green" style={{ fontSize: 11, padding: '2px 8px' }}>Live</span> : <Icon name="chev" size={18} color="var(--faint)" />}</div>
                <div className="xs muted">{[p.age, p.sex, ...(p.conditions || [])].filter(Boolean).join(' · ')}</div>
                <div className="xs muted">Next visit {p.nextVisit ? dShort(p.nextVisit) : 'not booked'}</div>
                {p.alerts.length ? <div className="row wrap" style={{ gap: 5, marginTop: 8 }}>{p.alerts.map((a) => <AlertChip key={a.key} a={a} />)}</div> : <div className="xs" style={{ color: 'var(--green)', marginTop: 6 }}>Stable, nothing to review</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="xs muted">Wellness data from consumer devices supports a conversation; it is not a diagnosis. Patients share by choice and can stop at any time. In production this view would sit alongside the clinic's record system.</p>
    </div>
  );
}

export function ProviderPatient() {
  const { params, call, toast, bump } = useApp();
  const id = params?.id;
  const [x2, setX] = useState(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const { data, error } = useLoad('providerPatient', { id });
  if (error) return <ErrorBox error={error} />;
  const p = x2 || data;
  if (!p) return <Loading />;
  const act = async (args, msg) => { try { setX(await call('providerAct', { id: p.id, ...args })); bump(); toast(msg); } catch (e) { toast(e.message); } };
  return (
    <div className="pro-page stack">
      <div className="row rise" style={{ gap: 12 }}><Avatar name={p.name} live={p.live} size={52} /><div><div className="eyebrow">{p.live ? 'Live patient (your member account)' : 'Sample patient'}</div><h1 className="page" style={{ margin: 0 }}>{p.name}</h1><div className="xs muted">{[p.age, p.sex, ...(p.conditions || [])].filter(Boolean).join(' · ')}</div></div></div>
      <NotShared list={p.notShared} />
      <div className="pro-stats">
        <Stat label="Weight" v={p.weightKg ? `${p.weightKg} kg` : '–'} sub={p.weightChange90 != null ? `${p.weightChange90 > 0 ? '+' : ''}${p.weightChange90} kg in 90 days` : ''} />
        <Stat label="Resting heart rate" v={p.rhr ? `${p.rhr} bpm` : '–'} sub={p.rhrTrend != null ? `${p.rhrTrend > 0 ? '+' : ''}${p.rhrTrend} bpm over 30 days` : ''} />
        <Stat label="Sleep" v={p.sleepAvg ? `${p.sleepAvg} h` : '–'} sub="a night, 14 days" />
        <Stat label="Steps" v={p.stepsAvg ? p.stepsAvg.toLocaleString() : '–'} sub="a day, 14 days" />
      </div>
      <div className="pro-cols">
        <div className="card">
          <h3>Labs</h3>
          {p.labs.length === 0 && <div className="small muted">No labs shared.</div>}
          {p.labs.map((l) => <div key={l.key} className="kv"><span>{l.name}</span><b>{l.prev != null && <span className="xs muted" style={{ fontWeight: 400 }}>{l.prev} → </span>}{l.value} {l.unit} <span className={`chip ${l.status === 'Optimal' || l.status === 'In range' ? 'green' : 'amber'}`} style={{ fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{l.status}</span></b></div>)}
          {p.labsMonthsAgo != null && <div className="xs muted" style={{ marginTop: 6 }}>Last results {p.labsMonthsAgo === 0 ? 'this month' : `${p.labsMonthsAgo} month${p.labsMonthsAgo > 1 ? 's' : ''} ago`}</div>}
          {p.alerts.length > 0 && <><div className="divider" /><div className="row wrap" style={{ gap: 5 }}>{p.alerts.map((a) => <AlertChip key={a.key} a={a} />)}</div></>}
          <div className="divider" />
          <h3>Order follow-up labs</h3>
          <div className="row wrap" style={{ gap: 6 }}>{p.labOptions.map((t) => <button key={t} className="chip select" onClick={() => act({ op: 'order', test: t }, `${t} ordered (demo)`)}>{t}</button>)}</div>
          {p.orders.map((o, i) => <div key={i} className="xs muted" style={{ marginTop: 6 }}>{o.test} · {o.status} {stamp(o.at)}</div>)}
        </div>
        <div className="card tint">
          <h3>Refer to a dietitian</h3>
          {p.referred
            ? <div className="small">Referred to {p.dietitian.name}, {p.dietitian.credentials} on {stamp(p.referred.at)}: "{p.referred.reason}"{p.live ? ' The member is asked to accept in their app.' : ''}</div>
            : <>
              <div className="xs muted" style={{ marginBottom: 8 }}>{p.dietitian.name}, {p.dietitian.credentials} sets the member's daily plan in Health Track and reports back.</div>
              <input className="input" placeholder="Reason, e.g. lower LDL with diet first" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Referral reason" />
              <Btn sm style={{ marginTop: 8 }} onClick={() => act({ op: 'refer', text: reason }, 'Referral sent')}>Send referral</Btn>
            </>}
          <div className="divider" />
          <h3>Care-plan notes</h3>
          {p.notes.map((n, i) => <div key={i} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--line)' }}><div className="xs muted">{stamp(n.at)}</div>{n.text}</div>)}
          <textarea className="input" rows={2} style={{ marginTop: 8 }} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New note" />
          <Btn sm style={{ marginTop: 8 }} disabled={!note.trim()} onClick={async () => { await act({ op: 'note', text: note }, 'Note saved'); setNote(''); }}>Save note</Btn>
        </div>
      </div>
    </div>
  );
}

// ---------------- member side: Care team and consent ----------------
export function CareTeam() {
  const { go, call, toast, bump } = useApp();
  const { data: r, error, reload } = useLoad('careTeam', {});
  const [code, setCode] = useState('');
  const [edit, setEdit] = useState(null);
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading />;
  const active = r.roles.filter((x) => x.link?.active);
  const save = async (role, share) => { try { await call('careConnect', { role, share }); await reload(); bump(); toast('Sharing updated'); setEdit(null); } catch (e) { toast(e.message); } };
  const stop = async (role, name) => { try { await call('careStop', { role }); await reload(); bump(); toast(`Stopped sharing with ${name}`); setEdit(null); } catch (e) { toast(e.message); } };
  return (
    <div className="stack">
      <div className="rise"><div className="eyebrow">Your data, your choice</div><h1 className="page">Care team</h1><div className="small muted">People you share with see only what you turn on. You can stop at any time and they lose access straight away.</div></div>
      {r.referrals.map((f, i) => (
        <div key={i} className="notice violet"><Icon name="heart" /><div className="small"><b>Dr. Sam Patel referred you to a dietitian.</b> "{f.reason}"<div className="row" style={{ gap: 8, marginTop: 8 }}><Btn sm onClick={() => go('care-join', { code: 'RD-DANA' })}>Review and accept</Btn><button className="link xs" onClick={async () => { await call('careDecline', { index: i }); reload(); }}>Not now</button></div></div></div>
      ))}
      {active.length === 0 && <div className="card small muted">You are not sharing with anyone.</div>}
      {active.map((x) => (
        <div key={x.id} className="card rise">
          <div className="row" style={{ gap: 10 }}>
            <Avatar name={x.person.name} size={44} live />
            <div style={{ flex: 1, minWidth: 0 }}><b className="small">{x.person.name}</b><div className="xs muted">{x.label} · {x.person.org}</div></div>
            {x.status !== 'live' && <span className="chip teal" style={{ fontSize: 10, padding: '2px 6px' }}>Preview</span>}
          </div>
          {x.id === 'dietitian' && <button className="link xs" style={{ marginTop: 8 }} onClick={() => go('my-dietitian', { back: 'care-team' })}>Messages and plan settings{x.nextVisit ? ` · next visit ${dShort(x.nextVisit)}` : ''}</button>}
          {x.id === 'coach' && x.session && <div className="notice info" style={{ marginTop: 8 }}><Icon name="dumbbell" /><div className="small">Your coach set your next session: <b>{x.session.label}</b></div></div>}
          {(x.announcements || []).slice(-1).map((a, i) => <div key={i} className="xs" style={{ marginTop: 8, background: 'var(--surface2)', borderRadius: 12, padding: '8px 10px' }}>{a.text}<div className="faint">{stamp(a.at)}</div></div>)}
          {x.id === 'provider' && (x.orders || []).map((o, i) => <div key={i} className="xs" style={{ marginTop: 6 }}>Lab order: {o.test} ({o.status})</div>)}
          <div className="divider" />
          {x.groupOnly
            ? <div className="xs muted">Your employer sees group totals only (groups of {x.minGroup} or more), never your own numbers.</div>
            : <div className="xs muted">Sharing: {Object.entries(x.link.share).filter(([, v]) => v).map(([k]) => r.share[k].label.toLowerCase()).join('; ') || 'nothing'}</div>}
          {edit === x.id
            ? <ShareEditor role={x} share={x.link.share} cats={r.share} onSave={(s) => save(x.id, s)} onStop={() => stop(x.id, x.person.name)} />
            : <button className="link xs" style={{ marginTop: 6 }} onClick={() => setEdit(x.id)}>Change what you share</button>}
        </div>
      ))}
      <div className="card">
        <h3>Add someone</h3>
        <div className="xs muted" style={{ marginBottom: 8 }}>Your dietitian, coach, employer or clinic gives you a code.</div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) go('care-join', { code }); }} aria-label="Invite code" />
          <Btn sm disabled={!code.trim()} onClick={() => go('care-join', { code })}>Next</Btn>
        </div>
        <div className="xs muted" style={{ marginTop: 8 }}>Demo codes: {r.codes.map((c, i) => <React.Fragment key={c.code}>{i ? ', ' : ''}<button className="link xs" onClick={() => setCode(c.code)}>{c.code}</button></React.Fragment>)}</div>
      </div>
    </div>
  );
}

function ShareEditor({ role, share, cats, onSave, onStop }) {
  const [s, setS] = useState(share);
  const allowed = role.groupOnly ? ['activity'] : [...role.asks, 'cycle'];
  return (
    <div style={{ marginTop: 8 }}>
      {allowed.map((k) => <div key={k} className="row between" style={{ padding: '6px 0' }}><span className="small">{cats[k].label}</span><Toggle on={!!s[k]} label={cats[k].label} onChange={(v) => setS({ ...s, [k]: v })} /></div>)}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <Btn sm onClick={() => onSave(s)}>Save</Btn>
        <Btn sm kind="secondary" onClick={onStop}>Stop sharing</Btn>
      </div>
    </div>
  );
}

export function CareJoin() {
  const { params, go, call, toast, bump } = useApp();
  const { data: r, error } = useLoad('careLookup', { code: params?.code || '' });
  const [s, setS] = useState(null);
  if (error) return <div className="stack"><Back to="care-team" /><ErrorBox error={error} /><Btn kind="secondary" onClick={() => go('care-team')}>Try another code</Btn></div>;
  if (!r) return <Loading />;
  const share = s || r.suggested;
  const allowed = r.groupOnly ? ['activity'] : [...r.asks, 'cycle'];
  return (
    <div className="stack">
      <div className="rise"><div className="eyebrow">Share with {r.label.toLowerCase()}</div><h1 className="page">{r.person.name}</h1><div className="small muted">{r.person.credentials} · {r.person.org}</div></div>
      <div className="card tint"><div className="small">{r.pitch}</div></div>
      <div className="card">
        <h3>{r.groupOnly ? 'What is counted' : 'What they will see'}</h3>
        {r.groupOnly && <div className="xs muted" style={{ marginBottom: 6 }}>Your sleep and activity are added to group totals of {r.minGroup} or more people. Your employer never sees your own numbers or your name next to them.</div>}
        {allowed.map((k) => <div key={k} className="row between" style={{ padding: '6px 0' }}><span className="small">{r.share[k].label}{!r.asks.includes(k) ? <span className="xs muted"> (optional)</span> : ''}</span><Toggle on={!!share[k]} label={r.share[k].label} onChange={(v) => setS({ ...share, [k]: v })} /></div>)}
        <div className="divider" />
        <h3>They never see</h3>
        {r.never.map((n) => <div key={n} className="row small" style={{ gap: 8, padding: '3px 0' }}><Icon name="lock" size={14} color="var(--muted)" />{n.charAt(0).toUpperCase() + n.slice(1)}</div>)}
        <div className="divider" />
        <h3>What they can do</h3>
        {r.actions.map((n) => <div key={n} className="row small" style={{ gap: 8, padding: '3px 0' }}><Icon name="check" size={14} color="var(--green)" />{n}</div>)}
      </div>
      <Btn block onClick={async () => { try { await call('careConnect', { role: r.id, share }); bump(); toast(`Now sharing with ${r.person.name}`); go('care-team'); } catch (e) { toast(e.message); } }}>{r.link?.active ? 'Update sharing' : 'Agree and share'}</Btn>
      <Btn block kind="secondary" onClick={() => go('care-team')}>Cancel</Btn>
      <p className="xs muted">You can change or stop sharing at any time in Profile, Care team. {r.status !== 'live' ? `This is a preview of ${r.product} (${r.tier}).` : ''}</p>
    </div>
  );
}
