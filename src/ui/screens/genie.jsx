import React, { useEffect, useRef, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, Locked, asset } from '../kit.jsx';

const STARTERS = ['Should I train today?', 'Why is my status what it is?', 'What should I eat tonight?', 'How can I sleep better?', 'Remind me to wind down tonight'];

export function Genie() {
  const { call, go, ent, info, toast, bump } = useApp();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { call('genieStream').then((c) => setMsgs(c.messages || [])).catch(() => setMsgs([])); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs?.length, busy]);
  if (ent && ent.genie === false) return <Locked what="Health Genie" />;

  async function send(t) {
    const q = (t ?? text).trim();
    if (!q || busy) return;
    setText('');
    setMsgs((m) => [...(m || []), { id: 'tmp', role: 'user', text: q }]);
    setBusy(true);
    try {
      const r = await call('genieChat', { text: q });
      setMsgs(r.messages);
    } catch (e) {
      setMsgs((m) => [...m, { id: 'err' + Date.now(), role: 'assistant', text: 'Sorry, I could not answer just now. Please try again.' }]);
    }
    setBusy(false);
  }
  async function decide(m, decision) {
    const r = await call('genieAction', { messageId: m.id, decision });
    if (r.ok) { setMsgs((ms) => ms.map((x) => (x.id === m.id ? { ...x, action: r.action } : x))); bump(); if (decision === 'confirm') toast(r.action.result); }
  }
  const last = msgs?.filter((m) => m.role === 'assistant').slice(-1)[0];
  const quick = last?.quickReplies?.length ? last.quickReplies : STARTERS.slice(0, 3);

  return (
    <div style={{ paddingBottom: 90 }}>
      <div className="row between rise">
        <div className="row">
          <span className="genie-orb" style={{ width: 46, height: 46, margin: 0 }}><img src={asset('genie.png')} alt="" /></span>
          <div><h1 className="page" style={{ fontSize: 24, margin: 0 }}>Health Genie</h1><div className="xs muted">{info?.aiLabel ? `Powered by ${info.aiLabel}` : 'Built-in coach answers (demo)'}</div></div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {info?.dictate && <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => go('genie-voice')} aria-label="Talk to Genie"><Icon name="mic" size={18} /></button>}
          <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => go('memory')} aria-label="What Genie remembers"><Icon name="brain" size={18} /></button>
        </div>
      </div>
      {!msgs ? <Loading /> : (
        <div className="col" style={{ marginTop: 16, gap: 12 }}>
          {msgs.length === 0 && (
            <div className="card tint rise">
              <h3>Hi, I am your Health Genie</h3>
              <p className="small muted" style={{ marginBottom: 0 }}>I know today's numbers, your goals and what has worked for you. I coach; I don't diagnose. Ask me anything about sleep, training, food or your status.</p>
            </div>
          )}
          {msgs.map((m) => <Bubble key={m.id} m={m} onDecide={decide} onFlag={async () => { await call('flagAnswer', { messageId: m.id }); toast('Thanks. We will review this answer.'); }} />)}
          {busy && <div className="bubble ai"><div className="typing"><span /><span /><span /></div></div>}
          <div className="row wrap" style={{ gap: 6 }}>{quick.map((q) => <button key={q} className="chip select" onClick={() => send(q)}>{q}</button>)}</div>
          <div ref={endRef} />
        </div>
      )}
      <form className="chatbar" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Health Genie" aria-label="Message Health Genie" maxLength={600} />
        <button className="send" type="submit" disabled={busy || !text.trim()} aria-label="Send"><Icon name="send" size={18} /></button>
      </form>
    </div>
  );
}

function Bubble({ m, onDecide, onFlag }) {
  if (m.role === 'user') return <div className="bubble me">{m.text}</div>;
  if (m.safety) {
    return (
      <div className="card rise" style={{ border: '2px solid var(--coral)' }}>
        <div className="row" style={{ gap: 8 }}><Icon name="shield" color="var(--coral)" /><b>{m.safety.title}</b></div>
        <p className="small" style={{ margin: '8px 0' }}>{m.safety.body}</p>
        <div className="row wrap" style={{ gap: 8 }}>{m.safety.actions.map((a) => <a key={a} className="btn sm danger" href={/988/.test(a) ? 'tel:988' : /911/.test(a) ? 'tel:911' : /ANAD/.test(a) ? 'tel:18883757767' : 'https://www.google.com/maps/search/urgent+care'} target="_blank" rel="noreferrer">{a}</a>)}</div>
        <p className="xs muted" style={{ marginBottom: 0 }}>Training is paused for today. Coaching resumes when you are ready.</p>
      </div>
    );
  }
  const a = m.action;
  return (
    <div className="col" style={{ gap: 6, alignItems: 'flex-start' }}>
      <div className="bubble ai">{m.text}</div>
      {m.chips?.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{m.chips.map((c, i) => <span key={i} className="chip violet" style={{ fontSize: 12 }}>{c.label}</span>)}</div>}
      {a && (
        <div className="card" style={{ padding: 14, width: '86%' }}>
          <div className="row" style={{ gap: 8 }}><Icon name={a.type === 'move_workout' ? 'calendar' : a.type === 'log_water' ? 'drop' : 'bell'} color="var(--violet)" /><b className="small">{a.title}</b></div>
          {a.detail && <div className="xs muted" style={{ marginTop: 4 }}>{a.detail}</div>}
          {a.status === 'proposed' ? (
            <div className="row" style={{ gap: 8, marginTop: 10 }}><Btn sm onClick={() => onDecide(m, 'confirm')}>Confirm</Btn><Btn sm kind="plain" onClick={() => onDecide(m, 'dismiss')}>Not now</Btn></div>
          ) : <div className="xs" style={{ marginTop: 8, color: a.status === 'done' ? 'var(--green)' : 'var(--muted)' }}>{a.status === 'done' ? `✓ ${a.result}` : 'Dismissed'}</div>}
        </div>
      )}
      <div className="row xs faint" style={{ gap: 10 }}>
        {m.source === 'stub' && <span>built-in answer</span>}
        {m.source && m.source !== 'stub' && <span>AI answer · checked against your numbers</span>}
        {!m.flagged ? <button className="xs faint" onClick={onFlag} aria-label="Report this answer"><Icon name="flag" size={12} /> Report</button> : <span>Reported</span>}
      </div>
    </div>
  );
}

export function Memory() {
  const { call, toast } = useApp();
  const { data: mem, reload } = useLoad('getMemory');
  const [note, setNote] = useState('');
  if (!mem) return <Loading />;
  const remove = async (k, id) => { await call('updateMemory', { [k]: mem[k].filter((x) => x.id !== id) }); reload(); toast('Forgotten'); };
  const Section = ({ k, title, icon }) => (
    <div className="card">
      <div className="row" style={{ gap: 8 }}><Icon name={icon} size={18} color="var(--violet)" /><h3 style={{ margin: 0 }}>{title}</h3></div>
      {mem[k].length === 0 && <p className="small muted">Nothing yet.</p>}
      <div className="list">
        {mem[k].map((x) => <div key={x.id} className="item"><span style={{ flex: 1 }} className="small">{x.text}</span><button className="link xs" onClick={() => remove(k, x.id)}>Forget</button></div>)}
      </div>
    </div>
  );
  return (
    <div className="stack">
      <Back to="genie" label="Health Genie" />
      <h1 className="page">What Genie remembers</h1>
      <p className="muted" style={{ marginTop: -6 }}>You are in control. Remove anything, any time.</p>
      <Section k="goals" title="Your goals" icon="target" />
      <Section k="constraints" title="Things to respect" icon="shield" />
      <div className="card">
        <div className="row" style={{ gap: 8 }}><Icon name="sparkle" size={18} color="var(--violet)" /><h3 style={{ margin: 0 }}>What works for you</h3></div>
        <p className="xs muted">From your One Thing history. Genie leans on these.</p>
        <div className="list">{mem.worksForMe.map((w) => <div key={w.id} className="item"><span style={{ flex: 1 }} className="small">{w.title}</span><span className="chip green" style={{ fontSize: 12 }}>{w.rate}%</span></div>)}</div>
      </div>
      <Section k="notes" title="Notes" icon="edit" />
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; await call('updateMemory', { notes: [...mem.notes, { id: 'm_' + Date.now(), text: note.trim() }] }); setNote(''); reload(); toast('Saved to memory'); }}>
        <input className="input" placeholder="Tell Genie something to remember" value={note} onChange={(e) => setNote(e.target.value)} aria-label="New memory note" />
        <Btn sm type="submit">Add</Btn>
      </form>
      <div className="card flat small">
        <div className="kv"><span>Coaching tone</span><b style={{ textTransform: 'capitalize' }}>{mem.preferences?.tone}</b></div>
        {mem.preferences?.notes && <div className="kv"><span>Preference</span><b>{mem.preferences.notes}</b></div>}
      </div>
    </div>
  );
}

export function VoiceGenie() {
  const { call, go, info } = useApp();
  const [state, setState] = useState('idle');
  const [heard, setHeard] = useState('');
  const [answer, setAnswer] = useState('');
  const stopRef = useRef(null);
  const textRef = useRef('');
  async function start() {
    if (!info?.dictate) return;
    setHeard(''); setAnswer(''); textRef.current = '';
    setState('listening');
    try {
      stopRef.current = await info.dictate({
        onText: (t) => { textRef.current = (textRef.current ? textRef.current + ' ' : '') + t; setHeard(textRef.current); },
        onEnd: async () => {
          const q = textRef.current.trim();
          if (!q) { setState('idle'); return; }
          setState('thinking');
          const r = await call('genieChat', { text: q });
          setAnswer(r.reply.text);
          setState('speaking');
          try { await info.speak?.(r.reply.text); } catch (e) {}
          setState('idle');
        },
      });
    } catch (e) { setState('idle'); }
  }
  return (
    <div className="story" style={{ position: 'absolute' }}>
      <button onClick={() => { stopRef.current?.(); go('genie'); }} style={{ alignSelf: 'flex-end', color: '#fff' }} aria-label="Close"><Icon name="x" /></button>
      <div className="orb" style={{ animationDuration: state === 'listening' ? '1s' : state === 'thinking' ? '0.6s' : '3s' }} />
      <div className="center" style={{ fontSize: 20, fontWeight: 700 }}>{state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? 'Health Genie' : 'Tap to talk'}</div>
      <p className="center" style={{ opacity: 0.75, minHeight: 40 }}>{heard}</p>
      <p className="center" style={{ fontSize: 17 }}>{answer}</p>
      <div className="spacer" />
      <button className="btn block" style={{ background: '#fff', color: '#2B1A6B' }} onClick={() => (state === 'listening' ? stopRef.current?.() : start())}>{state === 'listening' ? 'Done' : 'Talk'}</button>
    </div>
  );
}
