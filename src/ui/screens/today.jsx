import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Sheet, Back, Loading, ErrorBox, SimBadge, PILLAR, bandColor, confColor, dayName } from '../kit.jsx';
import { Ring, CountUp, MiniRing, CapsuleBars } from '../viz.jsx';
import { CheckinFields } from './onboarding.jsx';
import { ENERGY_COLOR } from './energy.jsx';

export function Today() {
  const { go, openSheet, act, toast, call, bump, boot } = useApp();
  const { data: t, error, loading } = useLoad('getToday');
  const [why, setWhy] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!t) return <Loading label="Building today" />;
  const pillars = ['sleep', 'recovery', 'activity', 'nutrition', 'hydration'];
  const rec = t.oneThingRecord;
  const ot = t.oneThing;
  const sim = t.devices?.some((d) => d.provider === 'simulated');

  return (
    <TodayPager>
    <div className="stack">
      <h1 className="page rise" style={{ fontSize: 24 }}>{t.greeting}, {t.name}</h1>

      {/* Wellness Status */}
      <div className="card rise" style={{ animationDelay: '.05s' }}>
        <h2 style={{ margin: 0, fontSize: 19, letterSpacing: '-.01em' }}>Your Wellness Status for {longDate(t.date)}</h2>
        <span className="row wrap" style={{ gap: 6, marginTop: 8 }}><SimBadge show={sim} /><span className={`chip ${confColor(t.confidence)}`} style={{ padding: '3px 10px', fontSize: 12 }}>{t.confidence} confidence</span>
          {t.energy && <button className={`chip ${t.energy.band.color}`} style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => go('energy')} aria-label={`Energy ${t.energy.now}, ${t.energy.band.name}. See energy and stress`}><Icon name="bolt" size={13} />Energy {t.energy.now} · {t.energy.band.name}</button>}</span>
        <div className="row" style={{ gap: 18, marginTop: 10 }}>
          <button onClick={() => go('status')} aria-label="How your status is made">
            <Ring value={t.status} size={150} stroke={15} dashed={!t.eligible}>
              <div className="num" style={{ fontSize: 46, fontWeight: 800, lineHeight: 1 }}>{t.status != null ? <CountUp to={t.status} /> : '--'}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: bandColor(t.band?.name) }}>{t.band?.name || 'Building'}</div>
            </Ring>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.01em' }}>{t.band?.advice || 'Getting to know you'}</div>
            <p className="small" style={{ margin: '6px 0' }}>{t.reason}</p>
            {t.vsAvg != null && <div className="xs muted">{t.vsAvg === 0 ? 'Same as your 7-day average' : `${t.vsAvg > 0 ? '+' : ''}${t.vsAvg} vs your 7-day average`}</div>}
            {t.capped && <div className="xs" style={{ color: 'var(--coral)', marginTop: 4 }}>Capped at {t.cap}: {t.capReason}</div>}
          </div>
        </div>
        <div style={{ marginTop: 16, background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 10px 10px' }}>
          <div style={{ padding: '0 4px 10px' }}>
            <b className="small">Your trackers</b>
            <div className="xs muted">Based on yesterday, {new Date(t.basedOn + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          </div>
          <div className="row between">
          {pillars.map((k, i) => <MiniRing key={k} value={t.pillars[k] != null ? Math.round(t.pillars[k]) : null} color={PILLAR[k].color} icon={PILLAR[k].icon} label={PILLAR[k].name} delay={0.1 + i * 0.05} onClick={() => go(k === 'sleep' ? 'sleep' : k === 'recovery' ? 'recovery' : k === 'nutrition' || k === 'hydration' ? 'nutrition' : 'insights')} />)}
          </div>
          <div className="xs faint" style={{ padding: '8px 4px 0' }}>Sleep and recovery come from last night, activity from yesterday and this week. Nutrition and hydration add up what you log today.</div>
        </div>
        {!t.baselineActive && t.hasWearable && (
          <button className="notice info" style={{ marginTop: 14, width: '100%', textAlign: 'left' }} onClick={() => go('baseline')}>
            <Icon name="info" /><div>Learning your normal: {Math.min(14, t.baselineNights)} of 14 nights. Recovery uses your check-in until then.</div>
          </button>
        )}
      </div>

      {/* One Thing */}
      {ot && (
        <div className="card rise" style={{ animationDelay: '.1s', background: 'linear-gradient(150deg, var(--tint-violet), transparent 65%), var(--glass)' }}>
          <div className="row between">
            <span className="row" style={{ gap: 6 }}><Icon name="sparkle" size={18} color="var(--violet)" /><b style={{ color: 'var(--violet)' }}>Your One Thing</b></span>
            {ot.isFocus && <span className="chip violet" style={{ fontSize: 12, padding: '3px 10px' }}>Habit day {ot.focusDay} of 21</span>}
          </div>
          <h2 style={{ fontSize: 22, margin: '10px 0 6px', letterSpacing: '-.01em' }}>{rec?.smaller ? ot.twoMin : ot.title}</h2>
          <p className="small muted" style={{ margin: 0 }}>{ot.why}</p>
          {why && (
            <div className="card flat small rise" style={{ marginTop: 10 }}>
              <b>Why this, today</b>
              <div className="kv"><span>Gap it closes</span><b>{PILLAR[ot.pillar]?.name}</b></div>
              <div className="kv"><span>Evidence grade</span><b>{ot.evidence}</b></div>
              <div className="kv"><span>Your success rate with it</span><b>{Math.round(ot.math.p * 100)}%</b></div>
              <div className="kv"><span>Score (gap × fit × chance × freshness)</span><b className="num">{ot.math.U}</b></div>
            </div>
          )}
          {!rec?.accepted && !rec?.outcome && (
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <Btn sm onClick={() => act('oneThingRespond', { actionId: ot.id, choice: 'accept' }, 'Added to your plan')}>I'll do it</Btn>
              <Btn sm kind="secondary" onClick={() => act('oneThingRespond', { actionId: ot.id, choice: 'smaller' }, 'Smaller version it is')}>Make it smaller</Btn>
              <button className="link small" style={{ marginLeft: 'auto' }} onClick={() => setWhy(!why)}>{why ? 'Hide' : 'Why?'}</button>
            </div>
          )}
          {rec?.accepted && !rec?.outcome && (
            <div style={{ marginTop: 14 }}>
              <div className="small muted" style={{ marginBottom: 8 }}>How did it go?</div>
              <div className="row" style={{ gap: 8 }}>
                {[['done', 'Done'], ['partly', 'Partly'], ['skipped', 'Skipped']].map(([o, l]) => (
                  <Btn key={o} sm kind={o === 'done' ? 'primary' : 'plain'} onClick={async () => { await act('oneThingOutcome', { actionId: ot.id, outcome: o }); toast(o === 'done' ? 'Nice. That counts.' : o === 'partly' ? 'Partly still counts.' : 'Noted. Tomorrow is a new day.'); }}>{l}</Btn>
                ))}
              </div>
            </div>
          )}
          {rec?.outcome && (
            <div className="row" style={{ marginTop: 12 }}>
              <span className={`chip ${rec.outcome === 'done' ? 'green' : rec.outcome === 'partly' ? 'teal' : 'amber'}`}><Icon name="check" size={14} />{rec.outcome === 'done' ? 'Done today' : rec.outcome === 'partly' ? 'Partly done' : 'Skipped today'}</span>
            </div>
          )}
          {ot.backOff && <p className="xs muted" style={{ marginTop: 8 }}>You skipped this a few times, so we made it easier. It is fine to go slow.</p>}
        </div>
      )}

      <Checkins items={t.checkins} checkinDone={t.checkinDone} />

      <button className="card flat row" style={{ textAlign: 'left' }} onClick={() => go('genie')}>
        <span className="genie-orb" style={{ width: 40, height: 40, margin: 0 }}><img src={(window.__HT_ASSETS__?.['genie.png']) || '/assets/genie.png'} alt="" /></span>
        <span style={{ flex: 1 }}><b className="small">Ask Health Genie</b><div className="xs muted">"Should I train today?" · "Why is my status {t.band?.name?.toLowerCase() || 'like this'}?"</div></span>
        <Icon name="chev" />
      </button>
    </div>
    <div className="stack">
      <div className="rise">
        <div className="eyebrow">More for today</div>
        <h1 className="page" style={{ fontSize: 24 }}>Your plan and progress</h1>
      </div>

      {t.keepDoing && (
        <div className="card flat row rise" style={{ animationDelay: '.15s' }}>
          <span className="ico" style={{ background: 'var(--tint-green)', color: 'var(--green)' }}><Icon name="check" /></span>
          <div style={{ flex: 1 }}><div className="xs muted">Keep doing</div><b className="small">{t.keepDoing.title}</b></div>
        </div>
      )}

      <TodaysPlan cats={t.planCategories} />

      {t.energy && (
        <button className="card tap rise" style={{ textAlign: 'left', animationDelay: '.2s' }} onClick={() => go('energy')}>
          <div className="row between">
            <span className="row" style={{ gap: 6 }}><Icon name="bolt" size={18} color="var(--amber)" /><b>Energy and stress</b></span>
            <span className="xs muted">See the day <Icon name="chev" size={14} /></span>
          </div>
          <div className="row" style={{ gap: 14, marginTop: 8 }}>
            <div><div className="xs muted">Energy now</div><b className="num" style={{ fontSize: 26, color: ENERGY_COLOR[t.energy.band.color] }}>{t.energy.now}</b></div>
            <div><div className="xs muted">Stress, 9 AM</div><b className="num" style={{ fontSize: 26 }}>{t.energy.stressAm ?? '--'}</b></div>
            <div><div className="xs muted">Stress, 3 PM</div><b className="num" style={{ fontSize: 26 }}>{t.energy.stressPm ?? '--'}</b></div>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>{t.energy.goodUntilMin != null ? `Best window for a hard session: before ${(() => { const h = Math.floor(t.energy.goodUntilMin / 60); return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`; })()}.` : 'Energy is under 50 now: keep training easy and get to bed on time.'}</p>
        </button>
      )}

      {/* Training */}
      {t.session && t.entitlements?.train && (
        <button className="card tap rise" style={{ textAlign: 'left', animationDelay: '.25s' }} onClick={() => go('train')}>
          <div className="row between">
            <span className="row" style={{ gap: 6 }}><Icon name="dumbbell" size={18} color="var(--teal)" /><b>Training</b></span>
            {!t.session.rest && <span className={`chip ${t.session.verdict.code === 'push' ? 'green' : t.session.verdict.code === 'rest' ? 'coral' : t.session.verdict.code === 'lighter' ? 'amber' : 'teal'}`}>{t.session.verdict.verdict}</span>}
          </div>
          {t.session.rest ? <p className="small muted" style={{ margin: '8px 0 0' }}>{t.session.subtitle || 'Rest day. A walk counts.'}</p> : (
            <>
              <h3 style={{ marginTop: 8 }}>{t.session.title} · {t.session.minutes} min</h3>
              <p className="small muted" style={{ margin: 0 }}>{t.session.verdict.note}</p>
              <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>{t.session.exercises.map((e) => <span key={e.id} className="chip">{e.name}{e.load ? ` · ${e.load} kg` : ''}</span>)}</div>
            </>
          )}
        </button>
      )}

      {/* Steps */}
      <div className="card rise" style={{ animationDelay: '.3s' }}>
        <div className="row between"><h3>Steps</h3><span className="xs muted">Target {t.stepTarget.toLocaleString()}</span></div>
        {t.burned && <div className="xs muted" style={{ marginTop: -4, marginBottom: 6 }}>About <b style={{ color: 'var(--text)' }}>{t.burned.total.toLocaleString()} kcal</b> burned so far today, {t.burned.active.toLocaleString()} of it from moving and workouts.</div>}
        <CapsuleBars items={t.steps7.map((s) => ({ label: dayName(s.date).slice(0, 1), v: s.steps }))} target={t.stepTarget} fmt={(v) => (v == null ? '--' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
      </div>

      {/* Meal idea + water */}
      <div className="grid2 rise" style={{ animationDelay: '.35s' }}>
        <button className="tile" onClick={() => go('nutrition')}>
          <span className="ico" style={{ background: 'var(--tint-amber)', color: 'var(--amber)', width: 34, height: 34 }}><Icon name="leaf" size={18} /></span>
          <span className="xs muted">Meal idea</span>
          <b className="small">{t.mealIdea?.name || 'Log a meal to get ideas'}</b>
          {t.mealIdea && <span className="xs muted">{t.mealIdea.kcalLow}–{t.mealIdea.kcalHigh} kcal · {Math.round(t.mealIdea.protein)} g protein</span>}
        </button>
        <button className="tile" onClick={() => go('water')}>
          <span className="ico" style={{ background: 'var(--tint-blue)', color: 'var(--blue)', width: 34, height: 34 }}><Icon name="drop" size={18} /></span>
          <span className="xs muted">Hydration</span>
          <b className="num" style={{ fontSize: 20 }}>{(t.fluid / 1000).toFixed(1)}<span className="small muted"> / {(t.waterTarget / 1000).toFixed(1)} L</span></b>
          <div className="progressbar"><i style={{ width: `${Math.min(100, (t.fluid / t.waterTarget) * 100)}%`, background: 'var(--blue)' }} /></div>
        </button>
      </div>

      {t.cycle && (
        <button className="card flat row rise" style={{ textAlign: 'left', animationDelay: '.4s' }} onClick={() => go('cycle')}>
          <span className="ico" style={{ background: 'var(--tint-coral)', color: 'var(--coral)' }}><Icon name="calendar" /></span>
          <span style={{ flex: 1 }}><b className="small">Cycle day {t.cycle.day} · {t.cycle.phase}</b><div className="xs muted">Next period {t.cycle.label === 'estimated' ? 'expected' : ''} around {new Date(t.cycle.next + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></span>
          <Icon name="chev" />
        </button>
      )}

      {t.evening && <EveningCard />}

      {boot?.profile?.setupSkipped?.length > 0 && (
        <button className="card flat row" style={{ textAlign: 'left' }} onClick={() => go('setup', { only: boot.profile.setupSkipped, back: 'today' })}>
          <span className="ico" style={{ background: 'var(--tint-violet)', color: 'var(--violet)' }}><Icon name="user" /></span>
          <span style={{ flex: 1 }}><b className="small">Finish setting up</b><div className="xs muted">{boot.profile.setupSkipped.length} step{boot.profile.setupSkipped.length > 1 ? 's' : ''} skipped. A couple of minutes makes your numbers more personal.</div></span>
          <Icon name="chev" />
        </button>
      )}

      <div className="xs faint center" style={{ paddingBottom: 8 }}>Engine {t.engineVersion} · wellness guidance, not medical advice</div>
    </div>
    </TodayPager>
  );
}

// Today is two pages side by side. Page 1 holds the essentials; page 2 holds the rest.
// Swipe sideways (scroll-snap) or tap the dots / hint to move between them.
function TodayPager({ children }) {
  const ref = React.useRef(null);
  const [page, setPage] = useState(0);
  const pages = React.Children.toArray(children);
  const [h, setH] = useState(null);
  // The track takes the height of the page in view, so page 1 doesn't inherit page 2's length.
  React.useEffect(() => {
    const el = ref.current?.children[page];
    if (!el) return undefined;
    const fit = () => setH(el.offsetHeight);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [page]);
  const goTo = (i) => { const el = ref.current; if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); el?.closest('.scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); };
  const onScroll = () => { const el = ref.current; if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); };
  return (
    <div className="today-pager">
      <div className="pager-dots" role="tablist" aria-label="Today pages">
        {['Today', 'More for today'].map((l, i) => <button key={l} role="tab" aria-selected={page === i} className={page === i ? 'on' : ''} onClick={() => goTo(i)}>{l}</button>)}
      </div>
      <div className="pager-track" ref={ref} onScroll={onScroll} style={h ? { height: h } : undefined}>
        {pages.map((p, i) => <section key={i} className="pager-page" aria-hidden={page !== i}>{p}</section>)}
      </div>
      {page === 0 && (
        <button className="swipe-hint" onClick={() => goTo(1)}>
          <span>Your plan, training, steps and more</span><Icon name="chev" size={16} />
        </button>
      )}
      {page === 1 && (
        <button className="swipe-hint left" onClick={() => goTo(0)}>
          <Icon name="back" size={16} /><span>Back to your status</span>
        </button>
      )}
    </div>
  );
}

const longDate = (d) => new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

// Today's plan, one category at a time (radio-style picker), AM and PM instead of exact times.
function TodaysPlan({ cats }) {
  const { go, act } = useApp();
  const [sel, setSel] = useState(() => (cats.find((c) => c.done < c.total) || cats[0])?.id);
  const cat = cats.find((c) => c.id === sel) || cats[0];
  if (!cat) return null;
  const run = (a) => {
    if (!a) return;
    if (a.kind === 'water') act('logWater', { ml: 250 }, '250 ml logged');
    else if (a.kind === 'photo') go('food', { meal: a.meal, back: 'today' });
    else if (a.kind === 'go') go(a.to);
  };
  return (
    <div className="card rise" style={{ animationDelay: '.2s' }}>
      <h3>Today's plan</h3>
      <div role="radiogroup" aria-label="Plan category" className="plan-cats">
        {cats.map((c) => (
          <button key={c.id} role="radio" aria-checked={c.id === cat.id} className={c.id === cat.id ? 'on' : ''} onClick={() => setSel(c.id)} style={{ '--c': c.color, '--t': c.tint }}>
            <span className="radio" aria-hidden="true" />
            <span className="ico"><Icon name={c.icon} size={18} /></span>
            <span className="xs" style={{ fontWeight: 700 }}>{c.name}</span>
            <span className="xs faint num">{c.done}/{c.total}</span>
          </button>
        ))}
      </div>
      <div className="row between" style={{ margin: '12px 0 4px', gap: 8 }}><span className="xs muted">{cat.name} plan · {cat.goal}</span>{cat.link && <button className="link xs" style={{ flex: 'none' }} onClick={() => go(cat.link.to, { back: 'today' })}>{cat.link.label}</button>}</div>
      <div className="col" style={{ gap: 0 }}>
        {cat.items.map((p, i) => (
          <div key={i} className="row" style={{ padding: '10px 0', borderBottom: i < cat.items.length - 1 ? '1px dashed var(--line)' : 0, alignItems: 'flex-start' }}>
            <span className={`chip ${p.when === 'AM' ? 'amber' : 'violet'}`} style={{ fontSize: 11, padding: '2px 8px', minWidth: 34, justifyContent: 'center' }}>{p.when}</span>
            <span style={{ flex: 1, minWidth: 0, opacity: p.done ? 0.6 : 1 }}>
              <span className="small" style={{ textDecoration: p.done ? 'line-through' : 'none', fontWeight: p.oneThing ? 700 : 400 }}>{p.text}</span>
              {p.sub && <div className="xs muted">{p.sub}</div>}
            </span>
            {p.done ? <span className="chip green" style={{ fontSize: 11, padding: '2px 8px' }}><Icon name="check" size={12} />Done</span>
              : p.action?.kind === 'water' ? <button className="chip blue" onClick={() => run(p.action)}>+250 ml</button>
              : p.action?.kind === 'photo' ? <button className="chip amber" onClick={() => run(p.action)} aria-label={`Log ${p.action.meal}`}><Icon name="camera" size={14} />Log</button>
              : p.action?.kind === 'go' ? <button className="chip teal" onClick={() => run(p.action)}>Open</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Four check-ins a day (6 AM, 12 PM, 5 PM, 9 PM). Each one reads what was logged since the last
// and adjusts the next meal, water and training advice. In the phone app these arrive as notifications.
function Checkins({ items, checkinDone }) {
  const { go, openSheet } = useApp();
  const [sel, setSel] = useState(() => (items.find((x) => x.state === 'now') || items.find((x) => x.state === 'upcoming') || items[0])?.id);
  const cur = items.find((x) => x.id === sel) || items[0];
  if (!cur) return null;
  return (
    <div className="card rise" style={{ animationDelay: '.18s' }}>
      <h3 style={{ margin: 0 }}>Today's check-ins</h3><div className="xs muted">Four alerts a day. Each one adjusts to what you logged since the last.</div>
      {!checkinDone && (
        <button className="row tap" style={{ width: '100%', textAlign: 'left', marginTop: 10, background: 'var(--tint-violet)', borderRadius: 14, padding: '10px 12px', gap: 10 }} onClick={() => openSheet('checkin')}>
          <span className="ico" style={{ background: 'var(--violet)', color: '#fff', width: 30, height: 30 }}><Icon name="check" size={16} /></span>
          <span style={{ flex: 1 }}><b className="small">Morning check-in</b><div className="xs muted">20 seconds. Sharpens today's status.</div></span>
          <Icon name="chev" />
        </button>
      )}
      <div role="tablist" aria-label="Check-in time" className="checkin-times">
        {items.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === cur.id} className={`${x.id === cur.id ? 'on' : ''} ${x.state}`} onClick={() => setSel(x.id)}>
            <b className="small">{x.label}</b>
            <span className="xs">{x.state === 'now' ? 'Now' : x.state === 'past' ? 'Earlier' : 'Coming up'}</span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}><Icon name="bell" size={18} color="var(--violet)" /><b>{cur.name}</b></div>
        <div className="small" style={{ marginTop: 4 }}>{cur.headline}</div>
        {cur.state === 'upcoming' && <div className="xs muted" style={{ marginTop: 4 }}>Preview. This updates with whatever you log before {cur.label}.</div>}
        {cur.since.length > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px', marginTop: 10 }}>
            <div className="xs muted" style={{ fontWeight: 700, marginBottom: 4 }}>{cur.sinceTitle}</div>
            {cur.since.map((s, i) => <div key={i} className="row xs" style={{ gap: 8, padding: '3px 0' }}><Icon name={s.icon} size={14} color="var(--muted)" /><span>{s.text}</span></div>)}
          </div>
        )}
        {cur.since.length === 0 && cur.state !== 'upcoming' && cur.id !== 'morning' && <div className="xs muted" style={{ background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px', marginTop: 10 }}>{cur.sinceTitle}: nothing logged. Log meals and water and the next check-in adjusts to them.</div>}
        <div className="col" style={{ gap: 10, marginTop: 12 }}>
          {cur.advice.map((a, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className="ico" style={{ width: 30, height: 30, background: 'var(--tint-violet)', color: 'var(--violet)', flex: 'none' }}><Icon name={a.icon} size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div className="xs muted" style={{ fontWeight: 700 }}>{a.kind}</div><div className="small">{a.text}</div></div>
            </div>
          ))}
        </div>
        {cur.ask && (cur.ask.done
          ? <div className="chip green" style={{ marginTop: 12 }}><Icon name="check" size={14} />{cur.meal} logged</div>
          : <Btn block kind="secondary" style={{ marginTop: 12 }} onClick={() => go('food', { meal: cur.ask.meal, back: 'today' })}><Icon name="camera" size={18} />{cur.ask.text}</Btn>)}
      </div>
    </div>
  );
}

function EveningCard() {
  const { openSheet } = useApp();
  return (
    <div className="card rise" style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--sleep) 25%, transparent), transparent 70%), var(--glass)' }}>
      <div className="row" style={{ gap: 8 }}><Icon name="moon" color="var(--sleep)" /><b>Evening wind-down</b></div>
      <p className="small muted">Dim the lights, park the phone, and keep the room cool. A short check-in on your One Thing closes the day.</p>
      <Btn sm kind="secondary" onClick={() => openSheet('checkin', { evening: true })}>Close the day</Btn>
    </div>
  );
}

export function CheckinSheet({ evening }) {
  const { closeSheet, act, boot } = useApp();
  const [v, setV] = useState({ energy: 3, soreness: 2, stress: 3, mood: 3, sleepQuality: 3, sleepHours: 7 });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={evening ? 'Close the day' : 'Morning check-in'} onClose={closeSheet}>
      <p className="small muted" style={{ marginTop: 0 }}>{evening ? 'How are you feeling tonight?' : 'Quick and honest. There are no wrong answers.'}</p>
      <CheckinFields value={v} onChange={setV} phoneOnly={boot?.phoneOnly} showSleep={!evening} />
      <Btn block style={{ marginTop: 18 }} disabled={busy} onClick={async () => { setBusy(true); await act('checkin', v, 'Check-in saved'); closeSheet(); }}>Save check-in</Btn>
    </Sheet>
  );
}

export function Baseline() {
  const { data: b } = useLoad('baseline');
  return (
    <div className="stack">
      <Back to="today" />
      <h1 className="page">Learning your normal</h1>
      {!b ? <Loading /> : (
        <>
          <div className="card center">
            <Ring value={(b.nights / b.of) * 100} size={170} stroke={14} label={`${b.nights} of ${b.of} nights`}>
              <div className="num" style={{ fontSize: 40, fontWeight: 800 }}>{b.nights}<span className="muted" style={{ fontSize: 18 }}>/{b.of}</span></div>
              <div className="xs muted">nights</div>
            </Ring>
            <p className="small" style={{ marginTop: 12 }}>{b.active ? 'Your baseline is ready. Recovery compares each night with your own 30-day normal.' : `Recovery switches to your personal baseline around ${new Date(b.unlock + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}</p>
          </div>
          <div className="card">
            <h3>Why 14 nights?</h3>
            <p className="small muted">HRV and resting heart rate vary a lot between people. Comparing you with yourself is fairer than comparing you with an average. Until then, Recovery uses your morning check-in, and confidence is shown as Low or Medium.</p>
          </div>
        </>
      )}
    </div>
  );
}
