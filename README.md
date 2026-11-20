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
- Today: Wellness Status with band and confidence, 5 pillar rings, One Thing (accept, make smaller, done/partly/skipped, habit day x of 21), today's plan, training verdict, steps, meal idea, water, cycle day.
- Insights: tiles for 7 pillars, "how your status is made", sleep, recovery (HRV and resting HR against your own normal band), food and water with calorie ranges, caffeine cut-off.
- Health Genie (centre tab, press and hold for quick actions): chat grounded in today's numbers, safety router (chest pain, breathing, fainting, self-harm, eating disorder, pregnancy) with fixed copy, proposed actions you confirm (move workout, reminder, log water), memory you can edit, voice.
- Log: food photo with S/M/L portions, say-it logging, water, coffee, workout, check-in, period, lab PDF.
- Progress: momentum, focus habit streak, 12-week calendar, goals, fitness ladder, weekly review story.
- Train: plan from goal/days/minutes, daily verdict (Push / As planned / Lighter / Rest) from Readiness, set logger with 2-for-2 progression and rest timer, live workout, history, Fitness Score, load balance (ACWR) and deload check, safety screen.
- Labs: PDF upload (read in the browser with pdf.js), rule parser plus Claude, confirm each value, Foundation score, marker detail with range bar.
- Cycle: dial, prediction window with confidence, phase notes, symptoms and flow, life stage, on-device or cloud storage, delete all.
- Profile: devices, plans and the cancel-save offer ($9.99 a month or $89.99 a year Essentials), privacy and consent toggles, export, delete account, day/night theme.

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
- Payments are not real: plan changes are stored, nothing is charged. The real app bills through the App Store and Google Play (RevenueCat in the PRD).
- The browser demo's accounts are local to that browser. Use the server build for real sign-ups.
- Cardio percentiles use an approximation until the FRIEND tables are licensed. Optimal lab ranges are placeholders pending clinical review.
- Health Track is a wellness app and does not diagnose.
