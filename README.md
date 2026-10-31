# GPBL site prototype (private, not deployed)

A phone-first redesign of gamepigeonbattleleague.com that replaces the embedded Google Sheets with a native schedule, result reporting, standings and bracket. Plain HTML/CSS/JS, no build step.

**All rosters, schedules, results, belt holders and trophy counts are SAMPLE data.** Real names come from the public site; "Sample Player N" are placeholders. Results save only in this browser (localStorage).

## Run
    cd gpbl && python3 -m http.server 8000   # open http://localhost:8000
    node test.js                              # logic tests

## Files
- index.html, styles.css, app.js: the site (hash routes: #/, #/match, #/schedule, #/standings, #/bracket, #/rules, #/belts, #/trophies, #/records, #/archive, #/fit, #/merch, #/about, #/join, #/proposal, #/more)
- core.js: schedule (week windows, round robin), standings (3/1/0, win% with draw = 0.5, head-to-head, best-of-3 flag, streaks), bracket seeding. Shared by browser and node tests.
- data.js: league config and sample data. test.js: node tests.
- manifest.json, icon.svg, icon-180/192/512.png: Home Screen install.

## Demo notes
- The demo clock is fixed at Nov 9 2026 12:00 PM ET (mid-season) so countdowns and results make sense.
- "Executive mode" is a demo toggle with no login.
- The Join form sends and stores nothing.

## Deploying for real (needs exec approval)
1. Static hosting: GitHub Pages, Netlify or Cloudflare Pages.
2. Shared data and logins: a small backend such as Supabase (Postgres + auth). Tables: players, leagues, seasons, matches, results(status: pending/confirmed/disputed/resolved), roles(exec/arbiter).
3. Row-level security so players can only report or confirm their own matches; execs can override.
4. Discord webhook or bot: post confirmed results and deadline reminders (send/start and finish).
5. Import rosters, all-time stats, records and archives from the current sheets once; then retire the public workbook (including the ADMIN tabs).

## Live mode (Supabase)
- `config.js`: `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY`. While the key is `PASTE_PUBLISHABLE_KEY` the site runs the local demo. If the server can't be reached it falls back to an "OFFLINE DEMO" (red banner). Live mode shows a green "LIVE PREVIEW" banner.
- `live.js`: plain `fetch` client (no SDK, nothing vendored): magic-link sign-in, results polling every 20 s, RPC calls.
- `supabase/schema.sql`: tables, RLS, grants and the write functions (RPC). Idempotent.
- `supabase/seed.sql`: SAMPLE roster (60 players) + November 2026 schedule (570 matches). Regenerate with `node supabase/make-seed.js`.
- Dev-only tests (not needed in production): `supabase/rls-test.mjs` (29 attack/permission checks against the real SQL in PGlite), `supabase/mock-server.mjs` + `supabase/e2e-live.mjs` (drives the app in headless Chrome against a fake Supabase backed by the real SQL). Both need `npm i @electric-sql/pglite@0.3` in /tmp/pgl.

### Security model
Everyone can read leagues, seasons, weeks, matches, public player columns (id, league, name, sample flag) and results. Nobody can write any table directly; all writes go through `security definer` functions that check `auth.uid()`:
| Rule | Attack it blocks |
|---|---|
| Column grants hide `players.user_id`, `results.resolved_by`; `player_private` (emails) is exec-only | Scraping account ids or emails |
| No insert/update/delete grants or policies on any table | Writing results/claims/roles straight through the REST API |
| `profiles.role` only changes by SQL in the dashboard | Self-promotion to exec |
| `report_result`: caller must be signed in, linked to a player, and that player must be home or away; winner must be home/away/draw; game 1–40 chars | Reporting other people's matches, fake winners, junk data |
| A report can only be edited by its reporter while pending | Opponent overwriting a pending report; anyone re-reporting a confirmed match |
| `respond_result`: only the other player in the match, only while pending | Reporter confirming own result; third parties confirming/disputing |
| `exec_set_result`, `exec_decide_claim`, `exec_pending_claims` check `is_exec()` | Players overriding results or approving their own claim |
| Claims: one pending per user; player must be unclaimed; approving one auto-rejects competing claims; an account links to at most one player | Two accounts claiming the same player; hijacking a claimed player |
| Function EXECUTE revoked from `anon` | Anonymous writes |

## Going live: checklist
1. Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run. Then a new query with `supabase/seed.sql` → Run (sample data; skip or replace for the real roster).
2. Authentication → URL Configuration: **Site URL** `https://lukedennison14.github.io/gpbl-live/`; **Redirect URLs** add `https://lukedennison14.github.io/gpbl-live/` and `https://lukedennison14.github.io/gpbl-live/index.html` (plus `http://localhost:8000/` for local testing).
3. Authentication → Sign In / Providers → Email: enabled (magic link). Passwords are not used by the app.
4. Project Settings → API Keys: copy the **publishable** key (`sb_publishable_...`, or the legacy `anon` key) into `config.js`. Never the secret/service_role key.
5. Make the first exec: each exec signs in once on the site (creates their profile), then in SQL Editor:
   `update public.profiles set role = 'exec' where user_id = (select id from auth.users where email = 'EXEC_EMAIL_HERE');`
6. Players sign in, pick "Claim your player"; an exec approves on the Exec page (More → Exec: claims).
7. Email: Supabase's built-in email sender is for testing only and has a very low hourly limit. For real use set a custom SMTP provider (Authentication → Emails → SMTP settings, e.g. Resend, Postmark, SES).
8. Host the folder on static hosting (e.g. a new GitHub Pages repo `gpbl-live`). Free tier projects pause after a week of inactivity.
