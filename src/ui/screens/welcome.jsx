import React, { useEffect, useRef, useState } from 'react';
import { useApp, Icon, Btn, asset } from '../kit.jsx';

export function Splash() {
  return (
    <div className="splash" role="img" aria-label="Health Track, your personal AI health coach">
      <div className="zoom" style={{ position: 'absolute', inset: 0, background: `url(${asset('splash.jpg')}) center top / cover no-repeat` }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(246,247,251,0) 35%, rgba(246,247,251,.96) 75%)' }} />
      <div className="card">
        <img src={asset('logo.png')} alt="Health Track. Transforming Wellness into Wellbeing!" style={{ width: 240, maxWidth: '80%' }} />
        <div style={{ fontWeight: 700, marginTop: 14, fontSize: 17 }}>Your personal AI health coach</div>
        <div style={{ fontSize: 13, opacity: .75, marginTop: 4 }}>with Health Genie</div>
      </div>
      <div className="loader"><i /></div>
    </div>
  );
}

export function Welcome({ onSignUp, onSignIn, onDemo }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#F6F7FB', color: '#0E1A33', overflow: 'auto' }}>
      <div style={{ position: 'relative', height: '58%', minHeight: 360 }}>
        <div className="zoom" style={{ position: 'absolute', inset: 0, background: `url(${asset('splash.jpg')}) center 20% / cover no-repeat` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(246,247,251,.1) 50%, #F6F7FB 100%)' }} />
        <svg viewBox="0 0 200 200" style={{ position: 'absolute', left: -40, top: 60, width: 260, opacity: .6 }} aria-hidden="true"><circle cx="100" cy="100" r="80" fill="none" stroke="#B48BFF" strokeWidth="16" strokeDasharray="4 6" className="ring-arc" /></svg>
        <span className="logo-chip" style={{ position: 'absolute', top: 54, left: 20, background: '#fff', padding: '4px 10px' }}><img src={asset('logo.png')} alt="Health Track" /></span>
        <div className="float-chip" style={{ top: 120, right: 16, animationDelay: '0s, 1s' }}><span className="ico" style={{ width: 32, height: 32, background: '#FCEFD9', color: '#D98A1C' }}><Icon name="moon" size={18} /></span><span style={{ color: '#5B6478' }}>Sleep</span><b>8 h 20 m</b></div>
        <div className="float-chip" style={{ top: 210, left: 14, animationDelay: '.12s, 1.4s' }}><span className="ico" style={{ width: 32, height: 32, background: '#FBE3DE', color: '#E0563F' }}><Icon name="heart" size={18} /></span><span style={{ color: '#5B6478' }}>Heart rate</span><b>72 bpm</b></div>
        <div className="float-chip" style={{ bottom: 30, right: 30, animationDelay: '.24s, 1.8s' }}><span className="ico" style={{ width: 32, height: 32, background: '#E1EBFE', color: '#3B7BF6' }}><Icon name="drop" size={18} /></span><span style={{ color: '#5B6478' }}>Hydration</span><b>2.5 L</b></div>
      </div>
      <div style={{ padding: '6px 24px 28px' }} className="rise">
        <h1 style={{ fontSize: 38, lineHeight: 1.05, margin: 0, letterSpacing: '-.03em', fontWeight: 800 }}>Welcome<br />to <span className="gradtext">HealthTrack</span></h1>
        <p style={{ color: '#5B6478', fontSize: 17, margin: '10px 0 18px' }}>Your wellness, in one place.</p>
        <button className="btn primary block" onClick={onSignUp} style={{ height: 56, borderRadius: 99 }}>Sign up</button>
        <button className="btn block" onClick={onSignIn} style={{ marginTop: 10, height: 56, borderRadius: 99, background: '#fff', color: '#0E1A33' }}>Sign in</button>
        <button className="btn block" disabled={busy} onClick={async () => { setBusy(true); try { await onDemo(); } finally { setBusy(false); } }} style={{ marginTop: 10, height: 44, color: '#6B3FD6', fontSize: 15 }}>{busy ? 'Loading a month of demo data...' : 'Explore the demo with sample data'}</button>
      </div>
    </div>
  );
}

export function Trial({ onContinue, onBack }) {
  const [billing, setBilling] = useState('yearly');
  const first = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const benefits = ['Your daily Wellness Status and One Thing', 'Health Genie, your coach in your pocket', 'Photo food logging with honest ranges', 'Training plans that flex with your readiness', 'Cycle-aware recovery (optional)', 'Lab report reading and Foundation score'];
  return (
    <div className="scroll noNav" style={{ paddingTop: 50 }}>
      <button className="back" onClick={onBack}><Icon name="back" size={18} />Back</button>
      <div className="rise">
        <span className="chip violet" style={{ marginTop: 8 }}>30 days free</span>
        <h1 className="page" style={{ marginTop: 12 }}>Start your 30-day free trial</h1>
        <p className="muted">Full access to everything. Nothing is charged until the trial ends, and we remind you 2 days before.</p>
        <div className="col" style={{ margin: '16px 0' }}>
          {benefits.map((b) => <div key={b} className="row"><span className="ico" style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--tint-green)', color: 'var(--green)' }}><Icon name="check" size={16} /></span><span>{b}</span></div>)}
        </div>
        <div className="col">
          <button className={`pill-opt ${billing === 'yearly' ? 'on' : ''}`} onClick={() => setBilling('yearly')} aria-pressed={billing === 'yearly'}>
            <div className="row between"><b>Yearly</b><span className="chip green">Save 36%</span></div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }} className="num">$99.99<span className="muted small" style={{ fontWeight: 500 }}> / year</span></div>
            <div className="muted small">About $8.33 a month. First charge on {first}.</div>
          </button>
          <button className={`pill-opt ${billing === 'monthly' ? 'on' : ''}`} onClick={() => setBilling('monthly')} aria-pressed={billing === 'monthly'}>
            <b>Monthly</b>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }} className="num">$12.99<span className="muted small" style={{ fontWeight: 500 }}> / month</span></div>
            <div className="muted small">First charge on {first}. Cancel in one tap.</div>
          </button>
        </div>
        <Btn block style={{ marginTop: 18 }} onClick={() => onContinue(billing)}>Start free trial</Btn>
        <p className="xs faint center" style={{ marginTop: 10 }}>Demo: no payment is taken. In the app, purchases go through the App Store or Google Play. <button className="link xs">Restore purchases</button></p>
      </div>
    </div>
  );
}

export function Auth({ mode, setMode, onBack, onDone }) {
  const { auth } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '', agree: false, code: '', newPassword: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [show, setShow] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const strength = (p) => [p.length >= 8, /[A-Z]/.test(p) && /[a-z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)];
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const run = async (fn) => { setBusy(true); setErr({}); try { await fn(); } catch (e) { setErr({ form: e.message || String(e) }); } finally { setBusy(false); } };

  const header = (title, sub) => (
    <>
      <button className="back" onClick={() => (mode === 'signup' || mode === 'signin' ? onBack() : setMode('signin'))}><Icon name="back" size={18} />Back</button>
      <span className="logo-chip" style={{ marginTop: 10 }}><img src={asset('logo.png')} alt="Health Track" /></span>
      <h1 className="page" style={{ marginTop: 14 }}>{title}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{sub}</p>
    </>
  );
  const social = (
    <div className="col" style={{ margin: '10px 0 14px' }}>
      <button className="btn plain block" onClick={() => setInfo('Apple, Google and passkey sign-in come with the mobile build. Use email for the demo.')}> Continue with Apple</button>
      <button className="btn plain block" onClick={() => setInfo('Apple, Google and passkey sign-in come with the mobile build. Use email for the demo.')}>Continue with Google</button>
      <button className="btn plain block" onClick={() => setInfo('Apple, Google and passkey sign-in come with the mobile build. Use email for the demo.')}><Icon name="lock" size={18} />Use a passkey</button>
      {info && <div className="notice info small">{info}</div>}
      <div className="row muted small" style={{ gap: 10 }}><span style={{ flex: 1, height: 1, background: 'var(--line)' }} />or with email<span style={{ flex: 1, height: 1, background: 'var(--line)' }} /></div>
    </div>
  );

  if (mode === 'signup') {
    const st = strength(f.password);
    return (
      <div className="scroll noNav" style={{ paddingTop: 50 }}>
        <form className="rise" onSubmit={(e) => { e.preventDefault(); const er = {}; if (!f.name) er.name = 'Add your first name.'; if (!validEmail(f.email)) er.email = 'Enter an email like name@example.com.'; if (st.filter(Boolean).length < 3) er.password = 'Use 8+ characters with a mix of letters, numbers or symbols.'; if (!f.agree) er.agree = 'Please accept the terms to continue.'; setErr(er); if (Object.keys(er).length) return; run(async () => { await auth.signUp({ name: f.name, email: f.email, password: f.password }); await onDone(); }); }}>
          {header('Create account', 'Your account is created before any health data is read.')}
          {social}
          <div className="col">
            <div className="field"><label htmlFor="su-name">First name</label><input id="su-name" className="input" value={f.name} onChange={set('name')} autoComplete="given-name" />{err.name && <span className="err">{err.name}</span>}</div>
            <div className="field"><label htmlFor="su-email">Email</label><input id="su-email" className="input" type="email" value={f.email} onChange={set('email')} onBlur={() => f.email && !validEmail(f.email) && setErr({ ...err, email: 'Enter an email like name@example.com.' })} autoComplete="email" />{err.email && <span className="err">{err.email}</span>}</div>
            <div className="field"><label htmlFor="su-pw">Password</label>
              <div style={{ position: 'relative' }}><input id="su-pw" className="input" type={show ? 'text' : 'password'} value={f.password} onChange={set('password')} autoComplete="new-password" /><button type="button" className="link small" style={{ position: 'absolute', right: 14, top: 15 }} onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
              <div className="row" style={{ gap: 4 }}>{st.map((ok, i) => <i key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: ok ? 'var(--green)' : 'var(--track)' }} />)}</div>
              {err.password && <span className="err">{err.password}</span>}
            </div>
            <label className="row small" style={{ alignItems: 'flex-start' }}><input id="su-agree" type="checkbox" checked={f.agree} onChange={set('agree')} style={{ marginTop: 3 }} /><span>I agree to the Terms of Service and the Consumer Health Data Privacy Policy.</span></label>
            {err.agree && <span className="err">{err.agree}</span>}
            {err.form && <span className="err">{err.form}</span>}
            <Btn block disabled={busy} type="submit">{busy ? 'Creating account...' : 'Create account'}</Btn>
            <p className="center small">Already have an account? <button type="button" className="link" onClick={() => setMode('signin')}>Sign in</button></p>
          </div>
        </form>
      </div>
    );
  }
  if (mode === 'signin') {
    return (
      <div className="scroll noNav" style={{ paddingTop: 50 }}>
        <form className="rise" onSubmit={(e) => { e.preventDefault(); run(async () => { await auth.signIn({ email: f.email, password: f.password }); await onDone(); }); }}>
          {header('Welcome back', 'Sign in to pick up where you left off.')}
          {social}
          <div className="col">
            <div className="field"><label htmlFor="si-email">Email</label><input id="si-email" className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
            <div className="field"><label htmlFor="si-pw">Password</label><input id="si-pw" className="input" type="password" value={f.password} onChange={set('password')} autoComplete="current-password" /></div>
            <div className="row between small"><label className="row"><input type="checkbox" defaultChecked /> Remember me</label><button type="button" className="link" onClick={() => setMode('forgot')}>Forgot password?</button></div>
            {err.form && <span className="err">{err.form}</span>}
            <Btn block disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</Btn>
            <p className="center small">No account yet? <button type="button" className="link" onClick={() => setMode('signup')}>Sign up</button></p>
          </div>
        </form>
      </div>
    );
  }
  if (mode === 'forgot') {
    return (
      <div className="scroll noNav" style={{ paddingTop: 50 }}>
        <form className="rise" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await auth.forgot({ email: f.email }); setInfo(r?.demoCode ? `Demo: your code is ${r.demoCode}` : ''); setMode('verify'); }); }}>
          {header('Forgot password', 'We will email you a 6-digit code. It is valid for 10 minutes.')}
          <div className="col">
            <div className="field"><label htmlFor="fp-email">Email</label><input id="fp-email" className="input" type="email" value={f.email} onChange={set('email')} /></div>
            <Btn block disabled={busy} type="submit">Send code</Btn>
            <p className="xs faint center">If an account exists for this email, a code is on its way.</p>
          </div>
        </form>
      </div>
    );
  }
  if (mode === 'verify') return <VerifyCode email={f.email} info={info} onBack={() => setMode('forgot')} onDone={(code) => { setF({ ...f, code }); setMode('reset'); }} />;
  if (mode === 'reset') {
    const rules = [['8 or more characters', f.newPassword.length >= 8], ['Upper and lower case', /[A-Z]/.test(f.newPassword) && /[a-z]/.test(f.newPassword)], ['A number', /\d/.test(f.newPassword)]];
    return (
      <div className="scroll noNav" style={{ paddingTop: 50 }}>
        <form className="rise" onSubmit={(e) => { e.preventDefault(); if (!rules.every((r) => r[1])) return setErr({ form: 'Meet each rule above.' }); run(async () => { await auth.reset({ email: f.email, code: f.code, password: f.newPassword }); await onDone(); }); }}>
          {header('Reset password', 'Choose a new password. Other devices will be signed out.')}
          <div className="col">
            <div className="field"><label htmlFor="rp-pw">New password</label><input id="rp-pw" className="input" type="password" value={f.newPassword} onChange={set('newPassword')} /></div>
            {rules.map(([l, ok]) => <div key={l} className="row small" style={{ color: ok ? 'var(--green)' : 'var(--muted)' }}><Icon name={ok ? 'check' : 'x'} size={16} />{l}</div>)}
            {err.form && <span className="err">{err.form}</span>}
            <Btn block disabled={busy} type="submit">Save and sign in</Btn>
          </div>
        </form>
      </div>
    );
  }
  return null;
}

function VerifyCode({ email, info, onBack, onDone }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [left, setLeft] = useState(30);
  const refs = useRef([]);
  useEffect(() => { const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, []);
  const masked = email ? email.replace(/^(.).*(@.*)$/, '$1•••$2') : 'your email';
  const setAt = (i, v) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) { const arr = clean.slice(0, 6).split(''); setDigits([...arr, ...Array(6 - arr.length).fill('')]); refs.current[Math.min(5, arr.length)]?.focus(); return; }
    const next = [...digits]; next[i] = clean; setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  };
  const code = digits.join('');
  return (
    <div className="scroll noNav" style={{ paddingTop: 50 }}>
      <div className="rise">
        <button className="back" onClick={onBack}><Icon name="back" size={18} />Back</button>
        <h1 className="page" style={{ marginTop: 14 }}>Enter verification code</h1>
        <p className="muted">We sent a 6-digit code to {masked}.</p>
        {info && <div className="notice info small" style={{ marginBottom: 12 }}>{info}</div>}
        <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
          {digits.map((d, i) => <input key={i} id={`code-${i}`} ref={(el) => (refs.current[i] = el)} className="input num" inputMode="numeric" autoComplete="one-time-code" aria-label={`Digit ${i + 1}`} value={d} onChange={(e) => setAt(i, e.target.value)} onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && refs.current[i - 1]?.focus()} style={{ width: 48, height: 58, textAlign: 'center', fontSize: 22, fontWeight: 700, padding: 0 }} />)}
        </div>
        <Btn block style={{ marginTop: 18 }} disabled={code.length < 6} onClick={() => onDone(code)}>Verify</Btn>
        <p className="center small muted">{left > 0 ? `Resend code in ${left} s` : <button className="link" onClick={() => setLeft(30)}>Resend code</button>}</p>
      </div>
    </div>
  );
}
