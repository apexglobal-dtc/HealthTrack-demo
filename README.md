# Health Track demo app

A working prototype of the Health Track mobile app, built from PRD v4, the Formulas and Algorithms doc, the Model Workbook and storyboard v2. It looks and behaves like the phone app, and the numbers come from the real scoring engine (v4.2-draft), not mock screens.

There are two ways to run the same code:

| | Browser demo (Claude Artifact) | Server build (Next.js) |
|---|---|---|
| Where | A claude.ai link | Your own Vercel project |
| Accounts | Stored in the viewer's browser (demo only) | Supabase Auth (email + password) |
| Database | The viewer's private Artifact storage, else browser storage | Supabase Postgres (`user_docs` table) |
| Health Genie, food photos, lab reading | Claude through the Artifact (asks the viewer once) | Claude API with your key |
| Wearables | Simulated | Open Wearables or Junction when configured, else simulated |

## What is in it

- Splash, welcome, 30-day trial ($12.99 a month or $99.99 a year), sign up, sign in, password reset.
- Onboarding: goals, about you, data sources (14 devices or phone only), consent, rhythm, routine and food, cycle opt-in, first check-in, first status reveal.
- Today: two pages side by side. Page 1 has the Wellness Status with band, confidence and the five trackers (based on yesterday), Your One Thing, today's four check-ins (6 AM, 12 PM, 5 PM, 9 PM) and Ask Health Genie. Page 2 (More for today) has keep doing, today's plan by category, training verdict, steps, meal idea, hydration and cycle day.
- Nutrition: calories in and out (consumed against burned, with a breakdown), calorie deficit planner and a daily meal plan (day, week and grocery views, swap, log as eaten, eating out, plain-language changes).
- Energy (F10): one 5 to 100 gauge from the two-process sleep model (charged by last night's sleep and morning recovery, drained by time awake, stress and workouts). A chip on the Wellness Status card, a card on Today page 2, and a full page with the day's curve and the best window for a hard session.
- Stress (F9): two readings a day, at 9 AM and 3 PM, from still 5-minute stretches of heart rate (plus HRV when the watch sends it) against your own 30-day normal; the check-in answer when there is no wearable. Readings, 14-day bars and a 3-high-days alert on the Energy and stress page, a link from Recovery, and in Health Genie answers.
- Weight loss v2 (F5 v2): trend weight that smooths water swings, maintenance learned from fully logged days and the weight trend (blended with the formula, at most 150 kcal a week of change), a curved goal projection shown as a date range, protein 1.6 g per kg in a deficit, and a plateau explainer. The meal plan and the dietitian view use the learned maintenance.
- Navigation: no back buttons. Use the tab bar, or swipe in from the left edge to go back a step; full-screen flows have a close button.
- Insights: tiles for 7 pillars, "how your status is made", sleep, recovery (HRV and resting HR against your own normal band), food and water with calorie ranges, caffeine cut-off.
- Health Genie (centre tab, press and hold for quick actions): chat grounded in today's numbers, safety router (chest pain, breathing, fainting, self-harm, eating disorder, pregnancy) with fixed copy, proposed actions you confirm (move workout, reminder, log water), memory you can edit, voice.
- Log: food photo with S/M/L portions, say-it logging, water, coffee, workout, check-in, period, lab PDF.
- Progress: momentum, focus habit streak, 12-week calendar, goals, fitness ladder, weekly review story.
- Train: plan from goal/days/minutes, daily verdict (Push / As planned / Lighter / Rest) from Readiness, set logger with 2-for-2 progression and rest timer, live workout, history, Fitness Score, load balance (ACWR) and deload check, safety screen.
- Labs: PDF upload (read in the browser with pdf.js), rule parser plus Claude, confirm each value, Foundation score, marker detail with range bar.
- Cycle: dial, prediction window with confidence, phase notes, symptoms and flow, life stage, on-device or cloud storage, delete all.
- Health Track Pro (web dashboard for professionals): sign in from the welcome screen ("Health Track Pro") or Profile. Four demo accounts on one shared core (consent, member list with alerts, member detail, plan settings, notes, messages):
  - Dietitian, Dana Lee (HT 1.0, live): member alerts, 7-day consumed against burned, weight trend, labs, today's plan, settings the member's meal plan follows ("Set by your dietitian"), notes, messages.
  - Sports coach, Alex Rivera (HT 2.0 preview): team readiness table, ACWR load alerts, sleep, check-ins, next session per athlete (Push, As planned, Lighter, Rest), team announcements.
  - Corporate wellness, Morgan Chen (HT 2.0 preview): group totals only, departments under 10 people hidden, challenges, announcements.
  - Healthcare provider, Dr. Sam Patel (HT 3.0 preview): patients between visits, worsening labs, overdue follow-up labs, resting heart rate trend, lab orders, referral to the dietitian.
- Care team (member side, Profile): connect with an invite code (RD-DANA, COACH-2048, NORTHWIND, CLINIC-7731), see what each professional will and will never see, choose what to share, stop sharing at once, accept a doctor's referral to a dietitian. Your own account is the "Live" member in every professional view it shares with.
- Profile: devices, plans and the cancel-save offer ($9.99 a month or $89.99 a year Essentials), privacy and consent toggles, export, delete account, day/night theme.

## Look and feel: Sea Mist

The app uses the **Sea Mist** palette with the **Manrope** typeface (Google Fonts), chosen in November 2026 for a younger audience. Day mode is a single flat sea-mist page with white tiles; night mode is midnight blue with aqua accents. All colors are tokens at the top of `src/ui/styles.css`, mirrored in `ui/storyboard_v2/design_tokens.css`.

| Token | Day | Night | Used for |
|---|---|---|---|
| Page (`--bg`) | #E3F2F4 sea mist | #06142A midnight | Screen background |
| Tile (`--surface`) | #FFFFFF | #0D2140 | Cards and tiles |
| Text (`--text`) | #163C82 midnight blue | #EAF6FA | Body and headings |
| Muted (`--muted`) | #4A6175 | #A3B9CC | Secondary text |
| Primary (`--violet`, kept as the token name) | #0A7FA6 sea blue | #5CCFE0 aqua | Links, active tabs, highlights |
| Button (`--grad`) | #0A6C99 to #14B3C4 | #8FE3EC to #3FB0D9 | Primary buttons, status ring |
| Sleep / Recovery / Activity / Fuel / Hydration | #5563D9 / #E0563F / #1E9E66 / #D98A1C / #1BA7C9 | #9AA6FF / #FF7A66 / #3DD68C / #F5B851 / #6CC6F0 | Tracker rings |

The Health Genie icon is shifted to sea blue in CSS. The Health Track logo uses midnight blue (#163C82) and sea blue (#0A7FA6), with the aqua dumbbell plates kept. The original purple version is kept as `ui/storyboard_v2/brand_assets/ht_logo_t_original_purple.png`.

## Project layout

```
src/engine/      scoring engine (pure functions, unit tested)
src/service/     the app's backend logic; one implementation used by both builds
src/ui/          React screens (one codebase for both builds)
src/platform/    adapters: browser storage, simulated wearables, AI prompts, server client
server/          server-only adapters: Supabase store, Claude API, Open Wearables, Junction
app/             Next.js pages and API routes (/api/rpc/[method], /api/ai/[kind])
supabase/        database migration
scripts/         build-artifact.mjs (single-file browser demo)
tests/           node --test suites
```

## Commands

```
npm install
npm test                 # engine and service tests
npm run build:artifact   # dist/healthtrack-demo.html (the Claude Artifact)
npm run dev              # local Next.js at http://localhost:3000
npm run build && npm start
```

Without any environment variables, the Next.js build still works: data stays in the browser and Genie uses built-in answers. Add the keys below to switch on each part.

## Deploying the server build (about 30 minutes)

1. **GitHub.** Create an empty private repo (for example `healthtrack-demo`) and push this folder to it:
   `git remote add origin git@github.com:<you>/healthtrack-demo.git && git push -u origin main`
2. **Supabase.** Create a project (free tier is fine). In SQL Editor, run `supabase/migrations/001_user_docs.sql`.
   In Authentication > Providers, keep Email on and turn on **Anonymous sign-ins** (used by "Explore the demo").
   For a small test group you can turn off "Confirm email" so people can sign in straight away.
   Copy the Project URL, the anon key and the service-role key from Project Settings > API.
3. **Anthropic.** Create an API key at console.anthropic.com and set a monthly spend limit (a few test users cost very little).
4. **Vercel.** Import the GitHub repo (framework: Next.js, no build changes). Add the variables from `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. Deploy.
5. **Wearables (later).**
   - *Junction sandbox:* put the sandbox key in `JUNCTION_API_KEY` (and `JUNCTION_REGION`). Devices then connect through Junction's link page.
   - *Open Wearables:* it is self-hosted, so it needs its own small server (Docker on Railway, Render, Fly.io or a $6 VPS) next to its Postgres. Put its URL and API key in `OPEN_WEARABLES_URL` and `OPEN_WEARABLES_API_KEY`.
   - The adapters in `server/wearables.js` follow each vendor's public docs but have not been run against a live account. Check the TODO lines with the sandbox before real users connect.

## Honest limits of this prototype

- Wearable data is simulated until a provider is configured. Simulated values are labelled "Simulated" in the app.
- The real wearable adapters do not pass daytime heart rate stretches yet, so with a real provider Stress falls back to the check-in until that mapping is added. Stress and Energy constants (other than the sleep-model time constants) are starting values to tune on beta data.
- Payments are not real: plan changes are stored, nothing is charged. The real app bills through the App Store and Google Play (RevenueCat in the PRD).
- The browser demo's accounts are local to that browser. Use the server build for real sign-ups.
- Cardio percentiles use an approximation until the FRIEND tables are licensed. Optimal lab ranges are placeholders pending clinical review.
- Health Track is a wellness app and does not diagnose.
