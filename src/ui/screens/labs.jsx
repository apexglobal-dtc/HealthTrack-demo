import React, { useRef, useState } from 'react';
import { useApp, useLoad, Icon, Btn, Back, Loading, Locked, Empty } from '../kit.jsx';
import { Ring, CountUp, RangeBullet } from '../viz.jsx';
import { pdfToText } from '../pdf.js';
import { SAMPLE_LAB_TEXT } from '../../engine/foundation.js';

const STATUS_CHIP = { Optimal: 'green', 'In range': 'teal', 'Worth a look': 'amber' };

export function Labs() {
  const { go, ent } = useApp();
  const { data: d } = useLoad('labs');
  if (ent && ent.labs === false) return <><Back to="profile" label="Profile" /><Locked what="Lab reports" /></>;
  if (!d) return <Loading />;
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <h1 className="page">Biomarkers</h1>
      {!d.rows.length ? (
        <Empty icon="file" title="Add your first lab report" body="Upload a PDF from your doctor or lab. We read it, you confirm every value, and you get a Foundation score." action={<Btn onClick={() => go('lab-upload')}>Upload a PDF</Btn>} />
      ) : (
        <>
          <div className="card row" style={{ gap: 18 }}>
            <Ring value={d.score} size={120} stroke={12} color="var(--navy)"><div className="num" style={{ fontSize: 34, fontWeight: 800 }}><CountUp to={d.score ?? 0} /></div></Ring>
            <div style={{ flex: 1 }}>
              <div className="xs muted">Foundation score</div>
              <b>{d.panelCoverage} markers · tested {new Date(d.testDate + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b>
              <div className="xs muted" style={{ marginTop: 4 }}>{d.confidence} confidence. Labs older than 12 months count less.</div>
            </div>
          </div>
          <div className="card">
            <div className="list">
              {d.rows.map((r) => (
                <button key={r.key} className="item" onClick={() => go('marker', { key: r.key })}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b className="small">{r.name}</b>
                    <div className="xs muted">{r.value} {r.unit}</div>
                  </div>
                  <span className={`chip ${STATUS_CHIP[r.status] || ''}`} style={{ fontSize: 12 }}>{r.status}</span>
                  <Icon name="chev" size={18} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <Btn block kind={d.rows.length ? 'secondary' : 'primary'} onClick={() => go('lab-upload')}><Icon name="file" size={18} />Upload a lab PDF</Btn>
      {d.reports.length > 0 && <div className="xs muted">Reports: {d.reports.map((r) => `${r.name} (${r.markers} values)`).join(' · ')}</div>}
      <p className="xs muted">Health Track explains your results in plain words; it does not diagnose. "Worth a look" means it may be worth discussing with your doctor. Optimal ranges are placeholders pending clinical review.</p>
    </div>
  );
}

export function LabUpload() {
  const { call, go, toast, bump } = useApp();
  const [stage, setStage] = useState('pick');
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null);
  const [rows, setRows] = useState([]);
  const fileRef = useRef(null);
  async function read(text, fileName) {
    setStage('reading'); setErr(null);
    try {
      const r = await call('readLabReport', { text, fileName });
      if (!r.markers.length) { setErr('We could not find any markers we track in that file. Is it a blood test report with text (not a photo scan)?'); setStage('pick'); return; }
      setRes(r); setRows(r.markers.map((m) => ({ ...m, confirmed: m.confidence >= 0.8 }))); setStage('review');
    } catch (e) { setErr(e.message || String(e)); setStage('pick'); }
  }
  async function onFile(f) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setErr('Please choose a PDF file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setErr('That PDF is over 10 MB.'); return; }
    setStage('reading');
    try { const text = await pdfToText(f); await read(text, f.name); } catch (e) { setErr(`Could not read that PDF: ${e.message}`); setStage('pick'); }
  }
  return (
    <div className="stack">
      <Back to="labs" label="Biomarkers" />
      <h1 className="page">Upload a lab report</h1>
      {stage === 'pick' && (
        <>
          <button className="card center" style={{ border: '2px dashed var(--line)', padding: 30 }} onClick={() => fileRef.current?.click()}>
            <div className="ico" style={{ background: 'var(--tint-blue)', color: 'var(--blue)', margin: '0 auto 10px', width: 56, height: 56 }}><Icon name="file" size={28} /></div>
            <b>Choose a PDF</b>
            <div className="xs muted">From Quest, Labcorp, your doctor's portal or similar. Max 10 MB.</div>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          {err && <div className="notice"><Icon name="info" /><div>{err}</div></div>}
          <Btn block kind="plain" onClick={() => read(SAMPLE_LAB_TEXT, 'Sample lab report.pdf')}>Try it with a sample report</Btn>
          <div className="notice info"><Icon name="shield" /><div>The PDF is read on your device. Only the text goes to the AI reader, and nothing is saved until you confirm the values.</div></div>
        </>
      )}
      {stage === 'reading' && <div className="center" style={{ padding: 40 }}><div className="orb" style={{ width: 110, height: 110 }} /><b>Reading your report…</b><div className="xs muted">Finding markers, units and the test date</div></div>}
      {stage === 'review' && res && (
        <>
          <div className="row between"><span className="small">Test date</span><input type="date" className="input" style={{ width: 170, height: 40 }} value={res.testDate} onChange={(e) => setRes({ ...res, testDate: e.target.value })} aria-label="Test date" /></div>
          <span className="badge" style={{ alignSelf: 'flex-start' }}>{res.source === 'ai' ? 'Read by Claude, checked by rules' : 'Read by the built-in parser'}</span>
          <p className="small muted" style={{ margin: 0 }}>Check each value against your report. Tick the ones that are right.</p>
          <div className="card">
            {rows.map((m, i) => (
              <div key={m.key} style={{ padding: '10px 0', borderBottom: i < rows.length - 1 ? '1px dashed var(--line)' : 0 }}>
                <div className="row">
                  <input type="checkbox" checked={m.confirmed} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))} style={{ accentColor: 'var(--violet)', width: 20, height: 20 }} aria-label={`Confirm ${m.name}`} />
                  <b className="small" style={{ flex: 1 }}>{m.name}</b>
                  <input className="input num" style={{ width: 80, height: 38, textAlign: 'right' }} inputMode="decimal" value={m.value} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label={`${m.name} value`} />
                  <span className="xs muted" style={{ width: 48 }}>{m.unit}</span>
                </div>
                {m.snippet && <div className="xs faint" style={{ marginLeft: 30, fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', overflow: 'hidden' }}>“{m.snippet.trim().slice(0, 80)}”</div>}
                {m.confidence < 0.8 && <div className="xs" style={{ marginLeft: 30, color: 'var(--amber)' }}>Please double-check this one</div>}
              </div>
            ))}
          </div>
          <Btn block disabled={!rows.some((r) => r.confirmed)} onClick={async () => {
            await call('confirmLabs', { markers: rows.map((r) => ({ ...r, value: Number(r.value) })), testDate: res.testDate, fileName: res.fileName });
            bump(); toast(`${rows.filter((r) => r.confirmed).length} values saved`); go('labs');
          }}>Save {rows.filter((r) => r.confirmed).length} confirmed values</Btn>
        </>
      )}
    </div>
  );
}

export function MarkerDetail() {
  const { params } = useApp();
  const { data: d } = useLoad('labs');
  if (!d) return <Loading />;
  const r = d.rows.find((x) => x.key === params.key);
  const def = d.markers.find((x) => x.key === params.key);
  if (!r) return <><Back to="labs" label="Biomarkers" /><p>Not found.</p></>;
  const hist = d.history[r.key] || [];
  return (
    <div className="stack">
      <Back to="labs" label="Biomarkers" />
      <h1 className="page">{r.name}</h1>
      <div className="card">
        <div className="row between"><div className="num" style={{ fontSize: 34, fontWeight: 800 }}>{r.value}<span className="small muted"> {r.unit}</span></div><span className={`chip ${STATUS_CHIP[r.status] || ''}`}>{r.status}</span></div>
        <div style={{ marginTop: 20 }}><RangeBullet value={r.value} range={r.ref} opt={r.opt} unit={r.unit} /></div>
        <div className="row between xs muted" style={{ marginTop: 26 }}><span>Lab range {r.ref[0]}–{r.ref[1]}</span><span>Optimal {r.opt[0]}–{r.opt[1]}</span></div>
      </div>
      <div className="card">
        <h3>What it is</h3>
        <p className="small" style={{ margin: 0 }}>{r.about}</p>
        {r.status === 'Worth a look' && <p className="small" style={{ marginBottom: 0 }}>This is outside the range we would like to see. It is worth mentioning at your next check-up; your doctor can tell you what it means for you.</p>}
      </div>
      <div className="card flat small">
        <div className="kv"><span>Tested</span><b>{r.date}</b></div>
        <div className="kv"><span>Source</span><b>{r.source}</b></div>
        {def?.loinc && <div className="kv"><span>LOINC code</span><b>{def.loinc}</b></div>}
        {hist.length > 1 && <div className="kv"><span>History</span><b>{hist.map((h) => `${h.value} (${h.date})`).join(', ')}</b></div>}
      </div>
    </div>
  );
}
