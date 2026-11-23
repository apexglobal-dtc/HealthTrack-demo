import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, ErrorBox, Seg } from '../kit.jsx';
import { DietitianCard } from './dietitian.jsx';

const fmtDay = (d, today) => (d === today ? 'Today' : new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function MealPlanCard() {
  const { go } = useApp();
  const { data: d } = useLoad('mealPlan', {});
  if (!d) return null;
  const main = d.day.meals.filter((m) => m.slot !== 'snack');
  return (
    <button className="card tap" style={{ textAlign: 'left', background: 'linear-gradient(150deg, var(--tint-amber), transparent 70%), var(--glass)' }} onClick={() => go('mealplan')}>
      <div className="row between"><b>Today's meal plan</b><Icon name="chev" /></div>
      <div className="xs muted" style={{ marginTop: 2 }}>{d.showCalories ? `${d.goal.kcal.toLocaleString()} kcal · ` : ''}{d.goal.protein} g protein, planned for {d.masterGoal}</div>
      <div className="col" style={{ gap: 4, marginTop: 8 }}>
        {main.map((m) => <div key={m.slot} className="small row" style={{ gap: 8 }}><span className="xs muted" style={{ width: 64 }}>{m.label}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.out ? 'Eating out' : m.name}</span>{m.logged && <Icon name="check" size={14} color="var(--green)" />}</div>)}
      </div>
    </button>
  );
}

export function MealPlan() {
  const { params, go } = useApp();
  const [tab, setTab] = useState(params?.tab || 'day');
  const [date, setDate] = useState(null);
  const { data: d, error } = useLoad('mealPlan', { date });
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading label="Planning your meals" />;
  return (
    <div className="stack">
      <Back to={params?.back || 'nutrition'} label={params?.back === 'today' ? 'Today' : 'Food'} />
      <div className="rise"><div className="eyebrow">Nutrition</div><h1 className="page">Meal plan</h1></div>
      <Seg value={tab} onChange={setTab} options={[['day', 'Day'], ['week', 'Week'], ['grocery', 'Groceries']]} />
      {d.needsSetup && <PlanSetup />}
      {tab === 'day' && <DayView d={d} setDate={setDate} />}
      {tab === 'week' && <WeekView d={d} onPick={(x) => { setDate(x); setTab('day'); }} />}
      {tab === 'grocery' && <GroceryView d={d} />}
      <p className="xs muted">{d.provenance} Tips based on labs, cycle or trends are general wellness education, not medical nutrition therapy.</p>
    </div>
  );
}

function PlanSetup() {
  const { act } = useApp();
  const [skill, setSkill] = useState('confident');
  const [prep, setPrep] = useState(30);
  return (
    <div className="card tint rise">
      <b>Your plan in two taps</b>
      <div className="xs muted" style={{ marginBottom: 10 }}>Your goal, diet and allergies come from your profile already.</div>
      <div className="field"><label>Cooking</label><Seg value={skill} onChange={setSkill} options={[['beginner', 'Keep it simple'], ['confident', 'I can cook']]} /></div>
      <div className="field"><label>Time for a meal</label><Seg value={prep} onChange={setPrep} options={[[15, '15 min'], [30, '30 min'], [45, '45 min']]} /></div>
      <Btn block onClick={() => act('mealPlanAction', { op: 'prefs', value: { skill, prepMax: prep } }, 'Plan updated')}>Save</Btn>
    </div>
  );
}

function DayView({ d, setDate }) {
  const { act, toast, call, bump } = useApp();
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const g = d.goal;
  const isToday = d.date === d.today;
  const pct = (v, t) => Math.min(100, Math.round((v / Math.max(1, t)) * 100));
  async function adjust(text) {
    if (!text.trim()) return;
    setBusy(true);
    try { const r = await call('adjustMealPlan', { date: d.date, text }); setAsk(''); bump(); toast(r.explanation?.slice(0, 120) || 'Plan updated'); } catch (e) { toast(e.message || 'Could not adjust the plan'); }
    setBusy(false);
  }
  return (
    <>
      <div className="row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {d.week.map((w) => <button key={w.date} className={`chip select ${w.date === d.date ? 'on' : ''}`} style={{ flex: 'none', padding: '8px 12px' }} onClick={() => setDate(w.date)}>{fmtDay(w.date, d.today)}</button>)}
      </div>

      <div className="card rise">
        <div className="xs muted">{isToday ? "Today's" : `${fmtDay(d.date, d.today)}'s`} nutrition goal</div>
        <h3 style={{ margin: '2px 0 8px' }}>Planned for {d.masterGoal}</h3>
        <div className="grid2" style={{ gap: 8 }}>
          {d.showCalories && <GoalTile label="Energy" v={d.day.totals.kcal} t={g.kcal} unit="kcal" color="var(--amber)" />}
          <GoalTile label="Protein" v={d.day.totals.protein} t={g.protein} unit="g" color="var(--violet)" />
          <GoalTile label="Carbs" v={d.day.totals.carbs} t={g.carbs} unit="g" color="var(--teal)" />
          <GoalTile label="Fat" v={d.day.totals.fat} t={g.fat} unit="g" color="var(--coral)" />
          <GoalTile label="Fiber" v={d.day.totals.fiber} t={g.fiber} unit="g" color="var(--green)" />
          {g.water && <div className="tile" style={{ padding: 10 }}><span className="xs muted">Water</span><b className="num">{(g.water / 1000).toFixed(1)} L</b><span className="xs faint">across the day</span></div>}
        </div>
        <div className="xs muted" style={{ marginTop: 8 }}>Bars show how much of each goal the planned meals cover.</div>
        {g.focus.length > 0 && (
          <div style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px' }}>
            <div className="xs muted" style={{ fontWeight: 700, marginBottom: 4 }}>Why today looks like this</div>
            {g.focus.map((f, i) => <div key={i} className="xs" style={{ padding: '3px 0' }}>• {f.why}{f.byRd && <span className="chip violet" style={{ fontSize: 10, padding: '1px 6px', marginLeft: 6 }}>Set by your dietitian</span>}</div>)}
          </div>
        )}
      </div>

      {d.note && (
        <div className="notice info"><Icon name="sparkle" /><div><b className="small">You asked: "{d.note.text}"</b><div className="small">{d.note.explanation}</div><div className="xs muted">{d.note.by === 'claude' ? 'Adjusted by Claude' : 'Adjusted by the app'} · <button className="link xs" onClick={() => act('mealPlanAction', { date: d.date, op: 'reset' }, 'Plan reset')}>Undo all changes</button></div></div></div>
      )}

      {d.day.meals.map((m) => <MealCard key={m.slot} m={m} d={d} isToday={isToday} />)}

      <DietitianCard />

      <div className="card rise">
        <div className="row" style={{ gap: 8 }}><span className="genie-orb" style={{ width: 30, height: 30, margin: 0 }}><img src={(window.__HT_ASSETS__?.['genie.png']) || '/assets/genie.png'} alt="" /></span><b>Change the plan in your own words</b></div>
        <div className="row wrap" style={{ gap: 6, margin: '10px 0' }}>
          {["I'm eating out tonight", 'Use the spinach in my fridge', 'Swap lunch', 'Make dinner lighter'].map((s) => <button key={s} className="chip select" disabled={busy} onClick={() => adjust(s)}>{s}</button>)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" placeholder='e.g. "Lunch meeting, adjust my dinner"' value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') adjust(ask); }} aria-label="Ask to change the plan" />
          <Btn sm disabled={busy || !ask.trim()} onClick={() => adjust(ask)}>{busy ? '...' : 'Ask'}</Btn>
        </div>
        <div className="xs muted" style={{ marginTop: 6 }}>{d.aiAvailable ? 'Claude picks from the recipe library; the numbers are always calculated by the app.' : 'Understands eating out, ingredients you have, swaps and portion size.'}</div>
      </div>
    </>
  );
}

function GoalTile({ label, v, t, unit, color }) {
  return (
    <div className="tile" style={{ padding: 10 }}>
      <span className="xs muted">{label}</span>
      <b className="num">{Math.round(t).toLocaleString()} <span className="xs muted">{unit}</span></b>
      <div className="progressbar"><i style={{ width: `${Math.min(100, (v / Math.max(1, t)) * 100)}%`, background: color }} /></div>
      <span className="xs faint">Planned {Math.round(v).toLocaleString()}</span>
    </div>
  );
}

function MealCard({ m, d, isToday }) {
  const { act } = useApp();
  const [open, setOpen] = useState(false);
  const allergies = d.allergies || [];
  if (m.empty) return null;
  const head = (
    <div className="row between">
      <span className="eyebrow" style={{ margin: 0 }}>{m.label}{m.slot === 'snack' ? ' (optional)' : ''}</span>
      {m.logged ? <span className="chip green" style={{ fontSize: 11, padding: '2px 8px' }}><Icon name="check" size={12} />Eaten</span> : null}
    </div>
  );
  if (m.out) {
    return (
      <div className="card rise">
        {head}
        <h3 style={{ margin: '6px 0' }}>Eating out</h3>
        {d.showCalories && <div className="small muted">Room for about {m.budget.toLocaleString()} kcal. The rest of the day is a little lighter to make space.</div>}
        <div className="col" style={{ gap: 4, marginTop: 8 }}>{m.tips.map((t, i) => <div key={i} className="xs">• {t}</div>)}</div>
        <Btn sm kind="plain" style={{ marginTop: 10 }} onClick={() => act('mealPlanAction', { date: d.date, op: 'out', slot: m.slot }, 'Back to the plan')}>I'm eating in after all</Btn>
      </div>
    );
  }
  return (
    <div className="card rise" style={{ opacity: m.logged ? 0.75 : 1 }}>
      {head}
      <h3 style={{ margin: '6px 0 4px' }}>{m.name}</h3>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}><Icon name="clock" size={12} />{m.prep} min</span>
        {m.why.map((w) => <span key={w} className="chip violet" style={{ fontSize: 11, padding: '2px 8px' }}>{w}</span>)}
        {m.byClaude && <span className="chip teal" style={{ fontSize: 11, padding: '2px 8px' }}>Adjusted by Claude</span>}
      </div>
      <div className="small" style={{ marginTop: 8 }}>
        {d.showCalories && <b className="num">{Math.round(m.totals.kcal)} kcal · </b>}
        <span className="num">{Math.round(m.totals.protein)} g protein · {Math.round(m.totals.carbs)} g carbs · {Math.round(m.totals.fat)} g fat · {Math.round(m.totals.fiber)} g fiber</span>
      </div>
      <div className="xs" style={{ marginTop: 4, color: m.allergens.length ? 'var(--amber)' : 'var(--muted)' }}>
        {m.allergens.length ? `Contains: ${m.allergens.join(', ')}` : 'No common allergens'}
        {allergies.length > 0 && <span style={{ color: 'var(--green)' }}> · Free from your {allergies.map((a) => a.toLowerCase()).join(', ')}</span>}
      </div>
      {open && (
        <div style={{ marginTop: 10, background: 'var(--surface2)', borderRadius: 14, padding: '10px 12px' }}>
          <div className="xs muted" style={{ fontWeight: 700 }}>Ingredients {m.portion !== 1 && `(portion ×${m.portion}, sized to your goal)`}</div>
          {m.items.map((i) => <div key={i.foodId} className="kv xs" style={{ padding: '4px 0' }}><span>{i.name}</span><b className="num">{i.grams} g</b></div>)}
          <div className="xs muted" style={{ fontWeight: 700, marginTop: 8 }}>Steps</div>
          {m.steps.map((s, i) => <div key={i} className="xs" style={{ padding: '2px 0' }}>{i + 1}. {s}</div>)}
          <div className="xs faint" style={{ marginTop: 6 }}>{m.source}. Nutrition from USDA FoodData Central.</div>
        </div>
      )}
      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
        {isToday && !m.logged && <Btn sm onClick={() => act('mealPlanAction', { date: d.date, op: 'log', slot: m.slot }, `${m.label} logged`)}><Icon name="check" size={16} />Log as eaten</Btn>}
        <Btn sm kind="secondary" onClick={() => act('mealPlanAction', { date: d.date, op: 'swap', slot: m.slot }, 'Swapped')}><Icon name="refresh" size={16} />Swap</Btn>
        <button className="link small" onClick={() => setOpen(!open)}>{open ? 'Hide recipe' : 'Recipe'}</button>
        {m.slot !== 'snack' && <button className="link small" style={{ marginLeft: 'auto' }} onClick={() => act('mealPlanAction', { date: d.date, op: 'out', slot: m.slot }, 'Set as eating out')}>Eating out?</button>}
      </div>
    </div>
  );
}

function WeekView({ d, onPick }) {
  return (
    <div className="card rise">
      <h3>Next 7 days</h3>
      <div className="list">
        {d.week.map((w) => (
          <button key={w.date} className="item" style={{ alignItems: 'flex-start', textAlign: 'left' }} onClick={() => onPick(w.date)}>
            <div style={{ width: 56 }}><b className="small">{fmtDay(w.date, d.today)}</b>{d.showCalories && <div className="xs muted num">{w.kcal.toLocaleString()}</div>}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {w.meals.map((m) => <div key={m.slot} className="xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span className="muted">{cap(m.slot)}:</span> {m.name}{m.prep ? <span className="faint"> · {m.prep} min</span> : ''}</div>)}
            </div>
            <Icon name="chev" size={16} color="var(--faint)" />
          </button>
        ))}
      </div>
    </div>
  );
}

function GroceryView({ d }) {
  const { act } = useApp();
  const all = d.grocery.flatMap((g) => g.items);
  const done = all.filter((i) => i.checked).length;
  return (
    <div className="card rise">
      <div className="row between"><h3 style={{ margin: 0 }}>Groceries for the week</h3><span className="xs muted">{done} of {all.length} ticked</span></div>
      <div className="xs muted" style={{ margin: '4px 0 8px' }}>Everything in the next 7 days of meals, added up. Tick what you already have.</div>
      {d.grocery.map((g) => (
        <div key={g.aisle} style={{ marginTop: 10 }}>
          <div className="xs muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{g.aisle}</div>
          {g.items.map((i) => (
            <label key={i.foodId} className="row" style={{ gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--line)', cursor: 'pointer' }}>
              <input type="checkbox" checked={i.checked} onChange={() => act('mealPlanAction', { op: 'grocery', value: i.foodId })} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} />
              <span className="small" style={{ flex: 1, textDecoration: i.checked ? 'line-through' : 'none', opacity: i.checked ? 0.6 : 1 }}>{i.name}{i.staple && <span className="xs faint"> · pantry staple</span>}</span>
              <span className="xs muted num">{i.count ? `${i.count} eggs` : i.grams >= 1000 ? `${(i.grams / 1000).toFixed(1)} kg` : `${i.grams} g`}{i.cooked ? ' cooked' : ''}</span>
            </label>
          ))}
        </div>
      ))}
      {done > 0 && <Btn sm kind="plain" style={{ marginTop: 10 }} onClick={() => act('mealPlanAction', { op: 'groceryClear' }, 'Ticks cleared')}>Clear ticks</Btn>}
    </div>
  );
}
