import React, { useEffect, useRef, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Sheet, Back, Loading, Locked, clock } from '../kit.jsx';
import { Vessel, CutoffTimeline } from '../viz.jsx';

export function LogSheet() {
  const { closeSheet, go, openSheet, act, call, toast } = useApp();
  const [menu, setMenu] = useState(null);
  useEffect(() => { call('logMenu').then(setMenu).catch(() => {}); }, []);
  const items = [
    ['Snap a meal', 'camera', 'var(--amber)', 'var(--tint-amber)', () => go('food')],
    ['Say it', 'mic', 'var(--violet)', 'var(--tint-violet)', () => go('voice')],
    ['Water', 'drop', 'var(--blue)', 'var(--tint-blue)', async () => { closeSheet(); await act('logWater', { ml: 250 }); toast('250 ml of water logged', () => act('undoLast', { kind: 'water' })); }],
    ['Coffee', 'coffee', 'var(--amber)', 'var(--tint-amber)', async () => { closeSheet(); await act('logCaffeine', { mg: 95 }); toast('Coffee logged (95 mg)', () => act('undoLast', { kind: 'caffeine' })); }],
    ['Workout', 'dumbbell', 'var(--teal)', 'var(--tint-teal)', () => go('workout-new')],
    ['Check-in', 'check', 'var(--green)', 'var(--tint-green)', () => openSheet('checkin')],
    ['Period', 'calendar', 'var(--coral)', 'var(--tint-coral)', () => go('cycle-log')],
    ['Lab report', 'file', 'var(--navy)', 'var(--tint-blue)', () => go('lab-upload')],
  ];
  return (
    <Sheet title="Log" onClose={closeSheet}>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {items.map(([label, icon, c, tint, fn]) => (
          <button key={label} className="col" style={{ alignItems: 'center', gap: 6 }} onClick={fn}>
            <span className="ico" style={{ width: 54, height: 54, borderRadius: 18, background: tint, color: c }}><Icon name={icon} size={24} /></span>
            <span className="xs" style={{ fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </div>
      {menu?.sameAsYesterday?.length > 0 && (
        <>
          <div className="divider" />
          <div className="xs muted" style={{ marginBottom: 8 }}>Same as yesterday</div>
          <div className="col">
            {menu.sameAsYesterday.concat(menu.saved || []).slice(0, 3).map((m, i) => (
              <button key={i} className="card flat row" style={{ padding: 12, textAlign: 'left' }} onClick={async () => { closeSheet(); await act('logMeal', { items: m.items, name: m.name.replace(' (usual)', ''), confirmed: true, source: 'repeat' }); toast(`${m.name} logged`); }}>
                <Icon name="refresh" size={18} color="var(--violet)" />
                <span style={{ flex: 1, minWidth: 0 }}><b className="small">{m.name}</b><div className="xs muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.items.map((x) => x.name || x.foodId).join(', ')}</div></span>
                <span className="xs num muted">{Math.round(m.kcal)} kcal</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

// Downscale a photo to keep uploads small (long edge 768 px, JPEG).
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 768 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function FoodReview({ result, source, image, onDone, onRetry, meal }) {
  const { act, toast, call } = useApp();
  const [items, setItems] = useState(() => result.items.map((i) => ({ ...i, size: 'M' })));
  const [usual, setUsual] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  useEffect(() => { if (q.length < 2) { setHits([]); return; } const t = setTimeout(() => call('searchFood', { q }).then(setHits), 200); return () => clearTimeout(t); }, [q]);
  const grams = (i) => (i.size === 'S' ? i.gramsLow : i.size === 'L' ? i.gramsHigh : i.grams);
  const kcal = (i) => Math.round(((i.kcal100 ?? null) != null ? i.kcal100 : (result.totals.kcal && i.kcalPerG ? i.kcalPerG * 100 : null)) || 0);
  return (
    <div className="stack">
      {image && <div className="camera" style={{ height: 180, backgroundImage: `url(${image})` }} />}
      <div className="row between">
        <h2 style={{ margin: 0 }}>Here is what I see</h2>
        {result.stub ? <span className="badge sim">Demo estimate</span> : <span className="badge" style={{ background: 'var(--tint-violet)', color: 'var(--violet)' }}>Claude vision</span>}
      </div>
      {result.stub && <p className="xs muted" style={{ margin: 0 }}>No AI key is connected, so this is a sample estimate. Adjust it to match your plate.</p>}
      <div className="card">
        {items.length === 0 && <p className="small muted">I could not match anything. Add items below.</p>}
        <div className="list">
          {items.map((it, idx) => (
            <div key={idx} className="item" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">{it.foodName || it.name}</b>
                <div className="xs muted">{grams(it)} g · {it.confidence >= 0.8 ? 'clear' : it.confidence >= 0.6 ? 'fairly sure' : 'a guess'}</div>
              </div>
              <div className="seg" style={{ padding: 3 }}>
                {['S', 'M', 'L'].map((s) => <button key={s} className={it.size === s ? 'on' : ''} style={{ width: 34, height: 30 }} onClick={() => setItems(items.map((x, j) => (j === idx ? { ...x, size: s } : x)))} aria-label={`Portion ${s}`}>{s}</button>)}
              </div>
              <button className="icon-btn" style={{ width: 32, height: 32, boxShadow: 'none' }} aria-label={`Remove ${it.foodName}`} onClick={() => setItems(items.filter((_, j) => j !== idx))}><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
        {result.unmatched?.length > 0 && <p className="xs muted">Not in our food list yet: {result.unmatched.join(', ')}</p>}
        <div style={{ position: 'relative', marginTop: 8 }}>
          <input className="input" placeholder="Add a food" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods to add" />
          {hits.length > 0 && (
            <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 54, zIndex: 5, padding: 6, maxHeight: 220, overflow: 'auto' }}>
              {hits.map((h) => <button key={h.id} className="row" style={{ width: '100%', padding: 10, textAlign: 'left' }} onClick={() => { setItems([...items, { foodId: h.id, foodName: h.name, grams: h.portions.M, gramsLow: h.portions.S, gramsHigh: h.portions.L, confidence: 1, size: 'M' }]); setQ(''); }}><span style={{ flex: 1 }} className="small">{h.name}</span><span className="xs muted">{h.kcal} kcal/100 g</span></button>)}
            </div>
          )}
        </div>
      </div>
      <label className="row small"><input type="checkbox" checked={usual} onChange={(e) => setUsual(e.target.checked)} style={{ accentColor: 'var(--violet)', width: 18, height: 18 }} />Save as a usual meal</label>
      <Btn block disabled={!items.length} onClick={async () => {
        const r = await act('logMeal', { items: items.map((i) => ({ foodId: i.foodId, grams: grams(i), gramsLow: i.gramsLow, gramsHigh: i.gramsHigh, confidence: i.confidence })), confirmed: true, source, saveAsUsual: usual, ...(meal ? { name: meal } : {}) });
        toast(`Logged ${r.kcalLow !== r.kcalHigh ? `${r.kcalLow}–${r.kcalHigh}` : Math.round(r.kcal)} kcal, ${Math.round(r.protein)} g protein`);
        onDone();
      }}>Log this meal</Btn>
      <Btn block kind="plain" onClick={onRetry}>Start over</Btn>
    </div>
  );
}

export function FoodPhoto() {
  const { go, call, ent, params } = useApp();
  const meal = params?.meal || null;
  const backTo = params?.back || 'nutrition';
  const [stage, setStage] = useState('pick');
  const [image, setImage] = useState(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  if (ent && ent.nutrition === false) return <div className="scroll noNav"><Back to="today" /><Locked what="Food logging" /></div>;
  async function analyze(img) {
    setStage('scan');
    const t0 = Date.now();
    const r = await call('analyzeFood', { image: img, note });
    await new Promise((res) => setTimeout(res, Math.max(0, 1400 - (Date.now() - t0))));
    setResult(r); setStage('review');
  }
  return (
    <div style={{ padding: '50px 20px 30px' }}>
      <div className="row between"><span className="small muted">{meal ? `${meal} photo` : 'Photo log'}</span><button className="close-x" style={{ margin: 0 }} aria-label="Close" onClick={() => go(backTo)}><Icon name="x" size={18} /></button></div>
      {stage === 'pick' && (
        <div className="stack rise" style={{ marginTop: 12 }}>
          <div className="camera" style={{ background: 'linear-gradient(160deg,#1b1b2e,#2c2a44)' }}>
            <div className="frame" />
            <div className="center" style={{ zIndex: 1 }}>
              <Icon name="camera" size={40} color="#fff" />
              <p style={{ margin: '10px 20px', opacity: 0.85 }}>Fit the whole plate in the frame. Shoot from above if you can.</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const img = await shrink(f); setImage(img); analyze(img); }} />
          <Btn block onClick={() => fileRef.current?.click()}><Icon name="camera" size={20} />Take or choose a photo</Btn>
          <div className="field"><label htmlFor="food-note">Add a note (optional)</label><input id="food-note" className="input" placeholder="e.g. chicken caesar salad, half eaten" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <Btn block kind="secondary" onClick={() => analyze(null)}>No photo? Estimate from the note</Btn>
        </div>
      )}
      {stage === 'scan' && (
        <div className="stack" style={{ marginTop: 12 }}>
          <div className="camera" style={{ backgroundImage: image ? `url(${image})` : 'linear-gradient(160deg,#1b1b2e,#2c2a44)' }}>
            <div className="frame" />
            <div style={{ position: 'absolute', left: 30, right: 30, height: 3, background: 'linear-gradient(90deg, transparent, #B48BFF, transparent)', animation: 'scan 1.4s ease-in-out infinite', top: '30%' }} />
            <span className="chip" style={{ position: 'absolute', bottom: 18, background: 'rgba(0,0,0,.55)', color: '#fff' }}>Reading your plate…</span>
          </div>
        </div>
      )}
      {stage === 'review' && result && <div style={{ marginTop: 12 }}><FoodReview result={result} source="photo" image={image} meal={meal} onDone={() => go(backTo)} onRetry={() => { setStage('pick'); setImage(null); setResult(null); }} /></div>}
    </div>
  );
}

export function VoiceLog() {
  const { call, info } = useApp();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(null);
  const { go } = useApp();
  async function mic() {
    if (listening) { stopRef.current?.(); setListening(false); return; }
    if (!info?.dictate) return;
    try {
      setListening(true);
      stopRef.current = await info.dictate({ onText: (t) => setText((x) => (x ? x + ' ' : '') + t), onEnd: () => setListening(false) });
    } catch (e) { setListening(false); }
  }
  if (result) return <div className="stack"><Back to="nutrition" label="Food" /><FoodReview result={result} source="voice" onDone={() => go('nutrition')} onRetry={() => setResult(null)} /></div>;
  return (
    <div className="stack">
      <Back to="nutrition" label="Food" />
      <h1 className="page">Say what you ate</h1>
      <p className="muted">Speak or type it the way you would tell a friend.</p>
      {info?.dictate && (
        <button onClick={mic} className="center" style={{ margin: '10px auto' }} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Start dictation'}>
          <div className="orb" style={{ width: 130, height: 130, margin: '0 auto', animationDuration: listening ? '1.2s' : '3s', opacity: listening ? 1 : 0.85 }} />
          <div className="small" style={{ marginTop: 10, fontWeight: 600 }}>{listening ? 'Listening… tap to stop' : 'Tap to talk'}</div>
        </button>
      )}
      <textarea className="input" style={{ height: 110, paddingTop: 12, resize: 'none' }} placeholder="Two eggs on toast and a flat white" value={text} onChange={(e) => setText(e.target.value)} aria-label="What you ate" />
      <div className="row wrap" style={{ gap: 6 }}>{['Oatmeal with banana and almonds', 'Chicken, rice and broccoli', 'A burger and fries'].map((s) => <button key={s} className="chip select" onClick={() => setText(s)}>{s}</button>)}</div>
      <Btn block disabled={!text.trim() || busy} onClick={async () => { setBusy(true); setResult(await call('analyzeFood', { note: text })); setBusy(false); }}>{busy ? 'Working it out…' : 'Continue'}</Btn>
    </div>
  );
}

export function WaterCaffeine() {
  const { act, toast } = useApp();
  const { data: d } = useLoad('nutritionDay', {});
  if (!d) return <Loading />;
  const w = d.water;
  const add = async (ml) => { await act('logWater', { ml }); toast(`${ml} ml logged`, () => act('undoLast', { kind: 'water' })); };
  const caf = async (mg, label) => { await act('logCaffeine', { mg }); toast(`${label} logged`, () => act('undoLast', { kind: 'caffeine' })); };
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const late = nowM >= d.caffeine.cutoffMin;
  return (
    <div className="stack">
      <Back to="nutrition" label="Food" />
      <h1 className="page">Water and caffeine</h1>
      <div className="card row" style={{ gap: 18 }}>
        <Vessel value={w.fluid} target={w.target} label={`${w.fluid} of ${w.target} ml`} />
        <div style={{ flex: 1 }}>
          <div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{(w.fluid / 1000).toFixed(2)} L</div>
          <div className="small muted">of {(w.target / 1000).toFixed(1)} L today</div>
          <div className="col" style={{ marginTop: 12, gap: 8 }}>
            <Btn sm onClick={() => add(250)}>+ Glass 250 ml</Btn>
            <Btn sm kind="secondary" onClick={() => add(500)}>+ Bottle 500 ml</Btn>
          </div>
        </div>
      </div>
      <p className="xs muted" style={{ marginTop: -4 }}>Your target scales with body weight and today's activity. Food water counts too, so this is a guide, not a rule.</p>
      <div className="card">
        <div className="row between"><h3>Caffeine</h3>{late && <span className="chip coral">Past your cut-off</span>}</div>
        <CutoffTimeline logs={d.caffeine.logs} cutoffMin={d.caffeine.cutoffMin} bed={d.caffeine.bed} />
        <div className="grid2" style={{ marginTop: 14 }}>
          {[['Coffee', 95], ['Espresso', 63], ['Tea', 47], ['Energy drink', 80]].map(([l, mg]) => <button key={l} className="chip select" style={{ justifyContent: 'space-between' }} onClick={() => caf(mg, l)}><span>{l}</span><span className="xs muted">{mg} mg</span></button>)}
        </div>
        {late && <p className="small" style={{ marginBottom: 0 }}>Tip: decaf or herbal tea now keeps tonight's sleep safe.</p>}
      </div>
      <div className="card">
        <h3>Other</h3>
        <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
          <button className="chip select" onClick={async () => { await act('logAlcohol'); toast('Drink logged'); }}>🍷 Alcoholic drink</button>
          {['Vitamin D', 'Magnesium', 'Creatine', 'Omega-3'].map((s) => <button key={s} className="chip select" onClick={async () => { await act('logSupplement', { name: s }); toast(`${s} logged`); }}>💊 {s}</button>)}
        </div>
      </div>
      {w.logs.length > 0 && <div className="xs muted">Today: {w.logs.map((l) => `${l.ml} ml at ${clock(l.minute)}`).join(' · ')}</div>}
    </div>
  );
}
