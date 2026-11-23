import React, { useState } from 'react';
import { useApp, useLoad, Icon, Btn, Toggle, Seg, Back, Loading, SimBadge, asset } from '../kit.jsx';

export function Profile() {
  const { go, signOut, themePref, setTheme, info, auth, refreshBoot, restart, toast, call, bump } = useApp();
  const { data: h } = useLoad('profileHub');
  if (!h) return <Loading />;
  const p = h.profile;
  const sub = p.subscription || {};
  const planLine = sub.plan === 'trial' ? `Free trial · ${h.trialDaysLeft} day${h.trialDaysLeft === 1 ? '' : 's'} left` : sub.plan === 'plus' ? `Health Track Plus · ${sub.billing}` : sub.plan === 'essentials' ? `Essentials · ${sub.billing}` : sub.plan === 'canceled' ? 'Canceled' : 'No plan';
  const Item = ({ icon, color = 'var(--violet)', tint = 'var(--tint-violet)', title, sub: s, to, onClick, right }) => (
    <button className="item" onClick={onClick || (() => go(to))}>
      <span className="ico" style={{ background: tint, color }}><Icon name={icon} size={20} /></span>
      <span style={{ flex: 1, minWidth: 0 }}><b className="small">{title}</b>{s && <div className="xs muted">{s}</div>}</span>
      {right ?? <Icon name="chev" size={18} color="var(--faint)" />}
    </button>
  );
  return (
    <div className="stack">
      <div className="card row rise" style={{ gap: 14 }}>
        <span style={{ width: 62, height: 62, borderRadius: 99, background: 'var(--grad)', color: '#fff', fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.name[0]}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{p.name}</h2>
          <div className="xs muted">Member since {new Date(h.memberSince + 'T12:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}{p.demo ? ' · demo account' : ''}</div>
        </div>
      </div>
      <button className="card tap tint row" style={{ textAlign: 'left' }} onClick={() => go('plans')}>
        <span className="ico" style={{ background: 'var(--violet)', color: '#fff' }}><Icon name="sparkle" /></span>
        <span style={{ flex: 1 }}><b>{planLine}</b><div className="xs muted">{sub.plan === 'trial' ? `Then ${sub.billing === 'monthly' ? '$12.99 a month' : '$99.99 a year'}. Cancel any time.` : 'Manage your plan'}</div></span>
        <Icon name="chev" />
      </button>
      <div className="card">
        <div className="list">
          <Item icon="user" color="var(--violet)" tint="var(--tint-violet)" title="Profile and preferences" sub={p.setupSkipped?.length ? `${p.setupSkipped.length} setup step${p.setupSkipped.length > 1 ? 's' : ''} left to finish` : 'About you, sleep rhythm, food and routine'} onClick={() => go('setup')} />
          <Item icon="watch" title="Devices and data sources" sub={h.devices.filter((d) => d.connected).map((d) => d.name).join(', ') || 'Phone only'} to="devices" />
          <Item icon="file" color="var(--navy)" tint="var(--tint-blue)" title="Biomarkers" sub={h.labsCount ? `${h.labsCount} values from your lab reports` : 'Upload a lab PDF'} to="labs" />
          {p.sex !== 'male' && <Item icon="calendar" color="var(--coral)" tint="var(--tint-coral)" title="Cycle" sub={h.cycleEnabled ? 'Tracking on' : 'Off'} to="cycle" />}
          <Item icon="target" color="var(--green)" tint="var(--tint-green)" title="Goals" sub={p.goals.join(', ')} to="goals" />
          <Item icon="brain" title="What Genie remembers" to="memory" />
          <Item icon="dumbbell" color="var(--teal)" tint="var(--tint-teal)" title="Training plan" to="train-setup" />
          <Item icon="users" color="var(--green)" tint="var(--tint-green)" title="Care team" sub="Your dietitian, coach, employer or clinic, and what each one sees" to="care-team" />
        </div>
      </div>
      <div className="card">
        <div className="list">
          <Item icon="users" color="var(--navy)" tint="var(--tint-blue)" title="Health Track Pro (demo)" sub="The web dashboard for dietitians, coaches, employers and clinics" to="pro-signin" />
        </div>
      </div>
      <div className="card">
        <h3>Appearance</h3>
        <Seg value={themePref} onChange={setTheme} options={[['system', 'Automatic'], ['day', 'Day'], ['night', 'Night']]} />
        <div className="divider" />
        <h3>Units</h3>
        <Seg value={p.units} onChange={async (v) => { await call('saveProfile', { units: v }); bump(); }} options={[['metric', 'Metric'], ['imperial', 'Imperial']]} />
        {h.reminders.length > 0 && <><div className="divider" /><h3>Reminders</h3>{h.reminders.map((r) => <div key={r.id} className="kv"><span>{r.text}</span><b>{r.time}</b></div>)}</>}
      </div>
      <div className="card">
        <div className="list">
          <Item icon="shield" title="Privacy and data" to="privacy" />
          <Item icon="info" title="About Health Track" to="about" />
          {p.demo && <Item icon="refresh" color="var(--amber)" tint="var(--tint-amber)" title="Reset the demo" sub="Reload a fresh month of sample data" onClick={async () => { await auth.demo({ reset: true }); await refreshBoot(); bump(); go('today'); toast('Demo data reset'); }} />}
          <Item icon="logout" color="var(--coral)" tint="var(--tint-coral)" title="Sign out" onClick={signOut} right={<span />} />
        </div>
      </div>
      <div className="center xs faint"><img src={asset('logo.png')} alt="Health Track" style={{ height: 28, background: '#fff', borderRadius: 8, padding: 3 }} /><div>Engine v4.2-draft · {info?.mode === 'artifact' ? 'Browser demo' : 'Server build'}</div></div>
    </div>
  );
}

export function Devices() {
  const { act, call, toast } = useApp();
  const { data: d, reload } = useLoad('devices');
  const [adding, setAdding] = useState(false);
  if (!d) return <Loading />;
  const connected = d.devices.filter((x) => x.connected);
  const providers = d.providers || [];
  async function connect(id) {
    const provider = providers.find((p) => p.ready && p.id !== 'simulated')?.id || 'simulated';
    const r = await call('connectDevice', { id, provider });
    if (r?.redirectUrl) { window.open(r.redirectUrl, '_blank', 'noopener'); toast('Finish connecting in the new tab'); return; }
    toast('Connected. Pulling the last 30 days…'); setAdding(false); reload();
  }
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <h1 className="page">Devices</h1>
      <div className="card">
        {connected.length === 0 && <p className="small muted">No wearable yet. Health Track works on your phone alone; a wearable adds HRV, resting heart rate and sleep stages.</p>}
        <div className="list">
          {connected.map((x) => (
            <div key={x.id} className="item">
              <span className="ico" style={{ background: 'var(--tint-green)', color: 'var(--green)' }}><Icon name="watch" size={20} /></span>
              <span style={{ flex: 1 }}><b className="small">{x.name}</b><div className="xs muted">Connected {x.connectedAt} · via {providers.find((p) => p.id === x.provider)?.name || x.provider}</div></span>
              {x.provider === 'simulated' && <SimBadge />}
              <button className="link xs" style={{ color: 'var(--coral)' }} onClick={async () => { await act('disconnectDevice', { id: x.id }, `${x.name} disconnected`); reload(); }}>Remove</button>
            </div>
          ))}
        </div>
      </div>
      {!adding ? <Btn block kind="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={18} />Connect a device</Btn> : (
        <div className="card rise">
          <h3>Choose a device</h3>
          <div className="list">
            {d.catalog.filter((c) => c.id !== 'phone' && !connected.find((x) => x.id === c.id)).map((c) => (
              <button key={c.id} className="item" onClick={() => connect(c.id)}>
                <span className="ico" style={{ background: 'var(--surface2)' }}><Icon name="watch" size={20} /></span>
                <span style={{ flex: 1 }}><b className="small">{c.name}</b><div className="xs muted">{[c.stages && 'sleep stages', c.hrv && 'HRV', c.temp && 'temperature', c.vo2 && 'VO2 max'].filter(Boolean).join(' · ') || 'activity'}</div></span>
                <Icon name="plus" size={18} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card flat small">
        <b>Data connections</b>
        {providers.map((p) => <div key={p.id} className="kv"><span>{p.name}</span><b style={{ color: p.ready ? 'var(--green)' : 'var(--muted)' }}>{p.ready ? 'Ready' : 'Not set up'}</b></div>)}
        <p className="xs muted" style={{ marginBottom: 0 }}>Open Wearables (self-hosted) and Junction plug in here. Until one is set up, devices use simulated data.</p>
      </div>
      <p className="xs muted">When two sources record the same thing, we pick by quality: a ring for sleep and HRV, a watch for workouts and heart rate.</p>
    </div>
  );
}

export function Privacy() {
  const { call, go, info, toast, bump } = useApp();
  const { data: h, reload } = useLoad('profileHub');
  if (!h) return <Loading />;
  const c = h.profile.consents || {};
  async function exportIt() {
    const data = await call('exportData');
    const text = JSON.stringify(data, null, 2);
    const filename = `health-track-export-${data.exportedAt.slice(0, 10)}.json`;
    try {
      if (info?.download) await info.download({ filename, text });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = filename; a.click(); }
      toast('Export ready');
    } catch (e) { toast('Export was not saved'); }
  }
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <h1 className="page">Privacy and data</h1>
      <div className="card">
        <h3>What Health Track may read</h3>
        <div className="list">
          {[['sleep', 'Sleep'], ['heart', 'Heart rate and HRV'], ['activity', 'Activity and workouts'], ['nutrition', 'Food and water logs']].map(([k, l]) => (
            <div key={k} className="item"><span style={{ flex: 1 }} className="small">{l}</span><Toggle on={c[k] !== false} label={l} onChange={async (v) => { await call('saveProfile', { consents: { ...c, [k]: v } }); reload(); bump(); }} /></div>
          ))}
        </div>
      </div>
      <div className="card small">
        <div className="kv"><span>Health data sold or used for ads</span><b>Never</b></div>
        <div className="kv"><span>What Health Genie sees</span><b>A summary of today's numbers</b></div>
        <div className="kv"><span>Cycle data</span><b>{h.cycleEnabled ? 'On, deletable any time' : 'Off'}</b></div>
        <div className="kv"><span>Where it is stored</span><b>{info?.mode === 'artifact' ? 'This browser (demo)' : 'Encrypted database'}</b></div>
      </div>
      <Btn block kind="secondary" onClick={exportIt}><Icon name="download" size={18} />Download my data</Btn>
      <Btn block kind="plain" style={{ color: 'var(--coral)' }} onClick={() => go('delete-account')}><Icon name="trash" size={18} />Delete my account</Btn>
    </div>
  );
}

export function DeleteAccount() {
  const { call, signOut, go } = useApp();
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <Back to="privacy" label="Privacy" />
      <h1 className="page">Delete your account</h1>
      <div className="notice"><Icon name="info" /><div>This permanently removes your profile, logs, check-ins, cycle data, lab results and Genie memory. It can't be undone. Download your data first if you want a copy.</div></div>
      <div className="field"><label htmlFor="del-c">Type DELETE to confirm</label><input id="del-c" className="input" value={txt} onChange={(e) => setTxt(e.target.value)} autoComplete="off" /></div>
      <Btn block kind="danger" disabled={txt !== 'DELETE' || busy} onClick={async () => { setBusy(true); await call('deleteAccount'); await signOut(); }}>Delete everything</Btn>
      <Btn block kind="plain" onClick={() => go('privacy')}>Keep my account</Btn>
    </div>
  );
}

export function Plans() {
  const { act, go, boot, refreshBoot, toast } = useApp();
  const { data: h, reload } = useLoad('profileHub');
  const [billing, setBilling] = useState('yearly');
  if (!h) return <Loading />;
  const sub = h.profile.subscription || {};
  const pr = h.pricing;
  const choose = async (plan) => { await act('subscription', { op: 'choose', plan, billing }); await refreshBoot(); reload(); toast(`You are on ${plan === 'plus' ? 'Health Track Plus' : 'Essentials'} (demo, no charge)`); };
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <h1 className="page">Your plan</h1>
      {sub.plan === 'trial' && <div className="card tint"><b>Free trial: {h.trialDaysLeft} days left</b><div className="small muted">Ends {sub.trialEnd}. We remind you 2 days before anything is charged.</div></div>}
      {sub.plan === 'canceled' && <div className="notice"><Icon name="info" /><div>Your plan is canceled. Your data is kept for 90 days; pick a plan to pick up where you left off.</div></div>}
      <Seg value={billing} onChange={setBilling} options={[['yearly', 'Yearly'], ['monthly', 'Monthly']]} />
      <div className={`pill-opt ${sub.plan === 'plus' ? 'on' : ''}`}>
        <div className="row between"><b>Health Track Plus</b>{billing === 'yearly' && <span className="chip green">Save 36%</span>}</div>
        <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>${billing === 'yearly' ? pr.plus.yearly : pr.plus.monthly}<span className="small muted" style={{ fontWeight: 500 }}> / {billing === 'yearly' ? 'year' : 'month'}</span></div>
        <div className="xs muted">Everything: status, One Thing, Genie, food photos, Train, cycle-aware recovery, lab reports.</div>
        {sub.plan !== 'plus' && <Btn sm style={{ marginTop: 10 }} onClick={() => choose('plus')}>Choose Plus</Btn>}
      </div>
      {sub.plan === 'essentials' && (
        <div className="pill-opt on">
          <b>Essentials</b>
          <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>${sub.billing === 'yearly' ? pr.essentials.yearly : pr.essentials.monthly}<span className="small muted"> / {sub.billing === 'yearly' ? 'year' : 'month'}</span></div>
          <div className="xs muted">Health Genie and nutrition.</div>
        </div>
      )}
      <p className="xs muted">Demo only: no payment is taken. The real app bills through the App Store or Google Play.</p>
      {['trial', 'plus', 'essentials'].includes(sub.plan) && <button className="link small" style={{ color: 'var(--coral)' }} onClick={() => go('cancel')}>Cancel plan</button>}
      {sub.plan === 'trial' && <button className="link xs" onClick={async () => { await act('subscription', { op: 'trialEndingDemo' }); await refreshBoot(); reload(); toast('Trial now ends in 2 days (demo)'); }}>Demo: show the trial-ending reminder</button>}
    </div>
  );
}

export function CancelOffer() {
  const { act, go, refreshBoot, toast } = useApp();
  const [step, setStep] = useState('reason');
  const [billing, setBilling] = useState('monthly');
  const [reason, setReason] = useState(null);
  return (
    <div className="stack">
      <Back to="plans" label="Plan" />
      {step === 'reason' && (
        <>
          <h1 className="page">Before you go</h1>
          <p className="muted">What's the main reason? It helps us improve.</p>
          <div className="col">{['Too expensive', 'Not using it enough', 'Missing a feature', 'Data did not feel accurate', 'Something else'].map((r) => <button key={r} className={`pill-opt ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
          <Btn block disabled={!reason} onClick={async () => { await act('subscription', { op: 'startCancel' }); setStep('offer'); }}>Continue</Btn>
        </>
      )}
      {step === 'offer' && (
        <>
          <span className="chip violet" style={{ alignSelf: 'flex-start' }}>A lighter option</span>
          <h1 className="page">Keep Genie and nutrition for less</h1>
          <p className="muted">Essentials keeps Health Genie and food logging. Your history stays, and you can upgrade back any time.</p>
          <Seg value={billing} onChange={setBilling} options={[['monthly', 'Monthly'], ['yearly', 'Yearly']]} />
          <div className="pill-opt on">
            <b>Essentials</b>
            <div className="num" style={{ fontSize: 28, fontWeight: 800 }}>{billing === 'monthly' ? '$9.99' : '$89.99'}<span className="small muted" style={{ fontWeight: 500 }}> / {billing === 'monthly' ? 'month' : 'year'}</span></div>
          </div>
          <Btn block onClick={async () => { await act('subscription', { op: 'acceptSave', billing }); await refreshBoot(); toast('Switched to Essentials (demo, no charge)'); go('profile'); }}>Switch to Essentials</Btn>
          <Btn block kind="plain" onClick={async () => { await act('subscription', { op: 'cancel' }); await refreshBoot(); toast('Plan canceled'); go('profile'); }}>Cancel anyway</Btn>
        </>
      )}
    </div>
  );
}

export function About() {
  const { info, boot } = useApp();
  return (
    <div className="stack">
      <Back to="profile" label="Profile" />
      <div className="center"><img src={asset('logo.png')} alt="Health Track. Transforming Wellness into Wellbeing!" style={{ width: 220, background: '#fff', borderRadius: 16, padding: 10 }} /></div>
      <div className="card small">
        <div className="kv"><span>Scoring engine</span><b>{boot?.engineVersion}</b></div>
        <div className="kv"><span>Build</span><b>{info?.mode === 'artifact' ? 'Browser demo (Claude Artifact)' : 'Server (Next.js)'}</b></div>
        <div className="kv"><span>Health Genie</span><b>{info?.aiLabel || 'Built-in answers'}</b></div>
        <div className="kv"><span>Wearable data</span><b>{info?.wearablesLabel || 'Simulated'}</b></div>
        <div className="kv"><span>Food data</span><b>USDA FoodData Central (rounded)</b></div>
      </div>
      <div className="card small">
        <b>Not medical advice</b>
        <p className="muted" style={{ marginBottom: 0 }}>Health Track is a wellness app. It doesn't diagnose, treat or prevent any condition. If something feels wrong, talk to a clinician. In an emergency, call 911.</p>
      </div>
    </div>
  );
}
