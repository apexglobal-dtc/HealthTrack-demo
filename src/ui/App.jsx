import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppCtx, Icon, asset, useHold, Sheet } from './kit.jsx';
import { Splash, Welcome, Trial, Auth, WelcomeBack } from './screens/welcome.jsx';
import { Onboarding, SetupEdit } from './screens/onboarding.jsx';
import { MealPlan } from './screens/mealplan.jsx';
import { Today, CheckinSheet, Baseline } from './screens/today.jsx';
import { Insights, StatusExplained, SleepDetail, RecoveryDetail, Nutrition, Deficit } from './screens/insights.jsx';
import { LogSheet, FoodPhoto, WaterCaffeine, VoiceLog } from './screens/log.jsx';
import { Genie, Memory, VoiceGenie } from './screens/genie.jsx';
import { Progress, Goals, WeeklyReview } from './screens/progress.jsx';
import { Train, SetLogger, LiveActivity, WorkoutHistory, ManualWorkout, FitnessScore, LoadBalance, TrainingSetup } from './screens/train.jsx';
import { Labs, LabUpload, MarkerDetail } from './screens/labs.jsx';
import { Cycle, CycleLog } from './screens/cycle.jsx';
import { Profile, Devices, Privacy, DeleteAccount, Plans, CancelOffer, About } from './screens/profile.jsx';

const ROUTES = {
  today: Today, insights: Insights, genie: Genie, progress: Progress, profile: Profile,
  status: StatusExplained, deficit: Deficit, mealplan: MealPlan, sleep: SleepDetail, recovery: RecoveryDetail, nutrition: Nutrition,
  food: FoodPhoto, water: WaterCaffeine, voice: VoiceLog, baseline: Baseline,
  memory: Memory, 'genie-voice': VoiceGenie, goals: Goals, review: WeeklyReview,
  train: Train, logger: SetLogger, live: LiveActivity, history: WorkoutHistory, 'workout-new': ManualWorkout,
  fitness: FitnessScore, load: LoadBalance, 'train-setup': TrainingSetup,
  labs: Labs, 'lab-upload': LabUpload, marker: MarkerDetail, cycle: Cycle, 'cycle-log': CycleLog,
  setup: SetupEdit, devices: Devices, privacy: Privacy, 'delete-account': DeleteAccount, plans: Plans, cancel: CancelOffer, about: About,
};
const TAB_OF = { today: 'today', baseline: 'today', insights: 'insights', status: 'insights', sleep: 'insights', recovery: 'insights', nutrition: 'insights', deficit: 'insights', mealplan: 'insights', food: 'insights', water: 'insights', voice: 'insights', genie: 'genie', memory: 'genie', 'genie-voice': 'genie', progress: 'progress', goals: 'progress', review: 'progress', train: 'progress', logger: 'progress', live: 'progress', history: 'progress', 'workout-new': 'progress', fitness: 'progress', load: 'progress', 'train-setup': 'progress' };
const TAB_ROOTS = new Set(['today', 'insights', 'genie', 'progress', 'profile']);
const NO_NAV = new Set(['logger', 'live', 'genie-voice', 'food', 'setup']);

// Keeps one broken screen from blanking the whole app.
class ScreenBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { try { console.error('[screen]', err); } catch (e) {} }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card center" style={{ marginTop: 20 }}>
        <h3>This screen hit a problem</h3>
        <p className="small muted">The rest of the app still works. Please tell us what you tapped.</p>
        <button className="btn primary" onClick={this.props.onHome}>Back to Today</button>
      </div>
    );
  }
}

function systemMode() {
  if (typeof document === 'undefined') return 'day';
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark') return 'night';
  if (host === 'light') return 'day';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

export default function App({ platform }) {
  const { call, auth, info } = platform;
  const [phase, setPhase] = useState('splash'); // splash | welcome | trial | auth | onboarding | app
  const [authMode, setAuthMode] = useState('signup');
  const [boot, setBoot] = useState(null);
  const [route, setRoute] = useState(() => (typeof location !== 'undefined' && ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'today'));
  const [params, setParams] = useState({});
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToast] = useState(null);
  const [radial, setRadial] = useState(false);
  const [themePref, setThemePref] = useState('system');
  const [sysMode, setSysMode] = useState(systemMode());
  const [pendingTrial, setPendingTrial] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const upd = () => setSysMode(systemMode());
    mq?.addEventListener?.('change', upd);
    const mo = new MutationObserver(upd);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq?.removeEventListener?.('change', upd); mo.disconnect(); };
  }, []);
  const mode = themePref === 'system' ? sysMode : themePref === 'night' ? 'night' : 'day';

  const refreshBoot = useCallback(async () => {
    const s = await auth.session();
    if (!s) { setBoot(null); return null; }
    const b = await call('bootstrap');
    setBoot(b);
    if (b.profile?.theme) setThemePref(b.profile.theme);
    return b;
  }, [call, auth]);

  useEffect(() => {
    const t0 = Date.now();
    refreshBoot().then((b) => {
      const wait = Math.max(0, 1500 - (Date.now() - t0));
      setTimeout(() => setPhase(b ? (b.profile ? 'app' : 'onboarding') : 'welcome'), wait);
    }).catch(() => setTimeout(() => setPhase('welcome'), 1200));
  }, []);

  useEffect(() => {
    const onHash = () => { const r = location.hash.slice(1); if (ROUTES[r] && r !== route) { setRoute(r); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [route]);

  const trail = useRef([]);
  const routeNow = useRef(route);
  routeNow.current = route;
  const paramsNow = useRef(params);
  paramsNow.current = params;
  const go = useCallback((r, p = {}, { replace } = {}) => {
    const prev = routeNow.current;
    if (prev !== r && !replace) trail.current = TAB_ROOTS.has(r) ? [] : [...trail.current.slice(-20), { r: prev, p: paramsNow.current }];
    routeNow.current = r;
    setRoute(r);
    setParams(p);
    setSheet(null);
    try { if (location.hash.slice(1) !== r) location.hash = r; } catch (e) { /* hash routing optional */ }
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, []);
  // Swipe in from the left edge to go back a step (there are no back buttons).
  const edge = useRef(null);
  const edgeStart = (e) => { const x = e.touches[0].clientX - (e.currentTarget.getBoundingClientRect?.().left || 0); edge.current = x < 28 && !TAB_ROOTS.has(routeNow.current) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; };
  const edgeEnd = (e) => {
    const s0 = edge.current; edge.current = null;
    if (!s0) return;
    const t = e.changedTouches[0];
    if (t.clientX - s0.x > 70 && Math.abs(t.clientY - s0.y) < 60) {
      const back = trail.current.pop();
      go(back?.r || TAB_OF[routeNow.current] || 'today', back?.p || {}, { replace: true });
    }
  };
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const toast = useCallback((msg, undo) => { setToast({ msg, undo, id: Date.now() }); }, []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toastMsg]);

  const act = useCallback(async (method, args, okMsg) => {
    const r = await call(method, args);
    bump();
    if (okMsg) toast(okMsg);
    return r;
  }, [call, bump, toast]);

  const ctx = useMemo(() => ({
    call, act, auth, info, go, route, params, bump, version, toast, mode, themePref,
    setTheme: async (t) => { setThemePref(t); try { await call('saveProfile', { theme: t }); } catch (e) {} },
    openSheet: (name, props = {}) => setSheet({ name, props }), closeSheet: () => setSheet(null),
    boot, refreshBoot, ent: boot?.entitlements || {},
    signOut: async () => { await auth.signOut(); setBoot(null); setPhase('welcome'); go('today'); },
    restart: async () => { await refreshBoot(); setPhase('welcome'); },
  }), [call, act, auth, info, go, route, params, bump, version, toast, mode, themePref, boot, refreshBoot]);

  const hold = useHold(() => setRadial(true), () => go('genie'));
  const Screen = ROUTES[route] || Today;
  const tab = TAB_OF[route] || (['profile', 'setup', 'devices', 'privacy', 'delete-account', 'plans', 'cancel', 'labs', 'lab-upload', 'marker', 'cycle', 'cycle-log', 'about'].includes(route) ? 'profile' : 'today');

  let body;
  if (phase === 'splash') body = <Splash />;
  else if (phase === 'welcome') body = <Welcome onSignUp={() => { setPhase('trial'); }} onSignIn={() => { setAuthMode('signin'); setPhase('auth'); }} onDemo={async () => { await auth.demo(); await refreshBoot(); go('today'); setPhase('app'); }} />;
  else if (phase === 'trial') body = <Trial onContinue={(billing) => { setPendingTrial(billing); setAuthMode('signup'); setPhase('auth'); }} onBack={() => setPhase('welcome')} />;
  else if (phase === 'auth') body = <Auth mode={authMode} setMode={setAuthMode} onBack={() => setPhase('welcome')} onDone={async () => { const b = await refreshBoot(); setPhase(b?.profile ? (authMode === 'signin' ? 'welcomeBack' : 'app') : 'onboarding'); }} />;
  else if (phase === 'welcomeBack') body = <WelcomeBack name={boot?.profile?.name} onYes={() => { go('profile'); setPhase('app'); }} onNo={() => { go('today'); setPhase('app'); }} />;
  else if (phase === 'onboarding') body = <Onboarding trialBilling={pendingTrial} onDone={async () => { await refreshBoot(); go('today'); setPhase('app'); }} />;
  else {
    body = (
      <>
        <div ref={scrollRef} className={`scroll ${NO_NAV.has(route) ? 'noNav' : ''}`} key={route} onTouchStart={edgeStart} onTouchEnd={edgeEnd}>
          <StatusBar />
          {!NO_NAV.has(route) && <TopBar />}
          <ScreenBoundary key={route + JSON.stringify(params)} onHome={() => go('today')}><Screen /></ScreenBoundary>
        </div>
        {!NO_NAV.has(route) && (
          <nav className="nav" aria-label="Main">
            <button className={tab === 'today' ? 'on' : ''} onClick={() => go('today')}><Icon name="home" />Today</button>
            <button className={tab === 'insights' ? 'on' : ''} onClick={() => go('insights')}><Icon name="insights" />Insights</button>
            <button className={`genie-tab ${tab === 'genie' ? 'on' : ''}`} {...hold} aria-label="Health Genie. Press and hold for quick actions">
              <span className="genie-orb"><img src={asset('genie.png')} alt="" /></span>Health Genie
            </button>
            <button className={tab === 'progress' ? 'on' : ''} onClick={() => go('progress')}><Icon name="progress" />Progress</button>
            <button className={tab === 'profile' ? 'on' : ''} onClick={() => go('profile')}><Icon name="user" />Profile</button>
          </nav>
        )}
        {radial && <Radial onClose={() => setRadial(false)} />}
        {sheet?.name === 'log' && <LogSheet {...sheet.props} />}
        {sheet?.name === 'checkin' && <CheckinSheet {...sheet.props} />}
        {sheet?.name === 'custom' && <Sheet onClose={() => setSheet(null)} title={sheet.props.title}>{sheet.props.render()}</Sheet>}
      </>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="stage">
        <aside className="stage-side">
          <img src={asset('logo.png')} alt="Health Track" style={{ height: 44, background: '#fff', borderRadius: 10, padding: 4 }} />
          <h1>Health Track demo</h1>
          <p>A working prototype of the mobile app. Scores come from the real engine (v4.2-draft); wearable data is simulated until Open Wearables or Junction is connected.</p>
          <ul>
            <li>Tap <b>Explore the demo</b> on the welcome screen to see a full month of data.</li>
            <li>Press and hold <b>Health Genie</b> for quick actions.</li>
            <li>Health Genie {info?.aiLabel || 'uses built-in answers until an AI key is connected'}.</li>
          </ul>
          {phase === 'app' && <button className="badge" onClick={() => setThemePref(mode === 'night' ? 'day' : 'night')}>Switch to {mode === 'night' ? 'day' : 'night'} theme</button>}
        </aside>
        <div className="device">
          <div className="ht" data-mode={mode}>
            {body}
            {toastMsg && <div className="toast" role="status"><span>{toastMsg.msg}</span>{toastMsg.undo && <button onClick={() => { toastMsg.undo(); setToast(null); }} style={{ color: 'inherit', textDecoration: 'underline' }}>Undo</button>}</div>}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  );
}

function StatusBar() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 30000); return () => clearInterval(i); }, []);
  return (
    <div className="statusbar" aria-hidden="true">
      <span>{t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ (AM|PM)/, '')}</span>
      <span className="icons"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor" /><rect x="10" y="2" width="3" height="10" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" /><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" /><rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" /></svg></span>
    </div>
  );
}

function TopBar() {
  const { openSheet } = React.useContext(AppCtx);
  return (
    <div className="topbar">
      <span className="logo-chip"><img src={asset('logo.png')} alt="Health Track" /></span>
      <button className="log-btn" onClick={() => openSheet('log')}><Icon name="plus" size={18} />Log</button>
    </div>
  );
}

function Radial({ onClose }) {
  const { go, openSheet } = React.useContext(AppCtx);
  const h = new Date().getHours();
  let items = [
    ['Check-in', 'check', () => openSheet('checkin')],
    ['Log food', 'camera', () => go('food')],
    ['Ask Genie', 'sparkle', () => go('genie')],
    ['Goals', 'target', () => go('goals')],
    ['Workout', 'dumbbell', () => go('live')],
  ];
  if (h >= 11 && h < 14 || h >= 18 && h < 21) items = [items[1], items[0], items[2], items[3], items[4]]; // food first at meal times
  const pos = [[-130, -40], [-80, -120], [0, -150], [80, -120], [130, -40]];
  return (
    <div className="radial" onClick={onClose}>
      <div className="scrim" style={{ zIndex: 0 }} />
      {items.map(([label, icon, fn], i) => (
        <button key={label} className="r-item" style={{ transform: `translate(${pos[i][0]}px, ${pos[i][1]}px)`, animationDelay: `${i * 40}ms` }} onClick={(e) => { e.stopPropagation(); onClose(); fn(); }}>
          <span className="ico"><Icon name={icon} /></span>{label}
        </button>
      ))}
    </div>
  );
}
