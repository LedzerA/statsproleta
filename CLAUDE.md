# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Football stats + live-match app for the amateur team "Proletariado Alviverde" (Proleta). All UI text is Brazilian Portuguese — keep it that way. Frontend: React 18 + TypeScript + Vite, deployed to GitHub Pages (static). Backend: Supabase (Postgres + Auth + Realtime + Edge Functions). The v1 single-file app lives in `legacy/proleta-esporte.html` (read-only reference; `scripts/gen-seed.mjs` extracts its seed data).

## Commands

- `npm run dev` — dev server (localhost:5173)
- `npm run build` — typecheck (`tsc`, strict) + Vite build to `dist/`. There is no test suite or linter; a passing build is the verification bar.
- `node scripts/gen-seed.mjs` — regenerate `supabase/seed.sql` from the legacy file
- `node scripts/gen-icons.mjs` — regenerate PWA PNG icons (dependency-free PNG encoder)
- Deploy: push to `main` → `.github/workflows/deploy.yml` builds and publishes to GitHub Pages. Vite uses `base: "./"` so the app works at any path; never introduce absolute URLs for assets or the service worker.

## Data-model history (read before schema work)

The user's final v1 app (single-file, iterated beyond `legacy/proleta-esporte.html`) stored per-match `starters`, `positions` (id→text map), `venue`/`kickoff`/`kit`, `archived`, a pausable `clock` `{base,period,running}`, in-row `events` (`start/goal/ga/ht/st/end/sub`, `p`=period, `t`=seconds), and a `squad` column on athletes/matches. Those live on in `athletes_v1`/`matches_v1` (renamed, anon-readable). `supabase/atualizacao-1.sql` copies all of it into the v2 tables and converts legacy events into `match_events` rows (`payload.legacy=true`; display text is derived client-side in `TimelineItem`). Never drop the `*_v1` tables; never remove a field that exists in v1 data. The store probes for the `starters` column on boot (`schemaLegacy`) and, when the DB predates atualizacao-1, strips new fields from writes and hides the related UI.

## Access model (core invariant)

Viewers browse everything **without login**; only admins authenticate. Enforcement is server-side via RLS in `supabase/schema.sql`: public `select` on data tables, writes gated by `is_admin()` (a `security definer` function checking the `admins` table). The client-side `isAdmin` flag in the store only shows/hides UI — never treat it as security. `push_subscriptions` is anon-writable (viewers subscribe without accounts) and deliberately has **no select policy** — which means PostgREST UPSERT fails against it; `subscribePush` must INSERT and fall back to UPDATE on error 23505. The Supabase URL/anon key in `src/config.ts` are intentionally public. `npm run dev:mock` mirrors live DB data and fakes an admin session (`__MOCK_ADMIN__`, dev-only).

## Architecture

- `src/state/store.tsx` is the single global context: loads squads/athletes/matches (all squads at once, filtered client-side by `squadId`), subscribes to Supabase Realtime (any table change → full refetch; `match_events` INSERT → append to per-match event cache + foreground notification), tracks auth session/isAdmin, and exposes all write actions. Writes are optimistic (state updated before the network call).
- Stats (`src/lib/stats.ts`) are derived per squad from matches with `status === 'encerrada'` only — live and scheduled matches never count until finished.
- **Live match flow**: `addEvent(match, type, opts)` in the store is the heart. Each event both mutates the match row (score, scorers/assists jsonb, status transitions `agendada → ao_vivo_1t → intervalo → ao_vivo_2t → encerrada`) and inserts a `match_events` row whose `payload` (title/body, PT-BR) is denormalized at insert time — the Edge Function and foreground notifier just display it, no context lookup needed.
- **Notifications, two paths sharing `tag = event.id` to dedupe**: (1) foreground — realtime INSERT handler in the store shows a toast + local Notification (skipped for events this client created, tracked in `ownEvents`); (2) background — a Database Webhook on `match_events` INSERT calls `supabase/functions/send-push`, which fans out Web Push to `push_subscriptions` (VAPID; public key in `src/config.ts`, private key in function secrets) and prunes 404/410 subscriptions. `public/sw.js` displays pushes and handles clicks.
- Routing is a tiny hash router (`src/lib/router.ts`, `#/partida/:id` etc.) — no react-router. Views live in `src/views/`, shared primitives in `src/components/ui.tsx`.
- Data shapes: DB column names (snake_case) are used directly in TS types (`src/lib/types.ts`) — no mapping layer. `scorers`/`assists` are jsonb arrays `[{a, g}]` / `[{a, n}]` keyed by athlete id; `MatchForm` converts them to/from `{id: count}` maps while editing. IDs are prefixed text (`a…` athletes, `m…` matches, `e…` events, `s…` squads) via `uid()`, not uuids — keeps v1 seed data compatible.
- Multi-squad: every athlete/match belongs to a `squad_id`; the header squad picker switches context and stats recompute per squad.

## Conventions

- Numbers shown to users use comma decimals (`pct()`/`dec()` in `src/lib/format.ts`); dates stored ISO `YYYY-MM-DD`, displayed `DD/MM/YYYY`.
- `lineup_complete: false` marks matches where the lineup only contains scorers/assisters (v1 spreadsheet imports) — appearance stats are approximate and the Atletas view shows a banner.
- `supabase/schema.sql` is idempotent and includes an automatic v1→v2 migration (renames old `athletes`/`matches` to `*_v1`, copies data). `seed.sql` uses `on conflict do nothing` — never make it overwrite existing rows.
- CSS is a single hand-written file (`src/styles.css`), mobile-first: bottom nav ≤720px, top tabs above. Keep the green/cream identity (`--verde-*`/`--creme-*` vars, Zilla Slab for numbers/headings).
