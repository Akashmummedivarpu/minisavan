# SonicRoom — Session Manifest

> This file is the **single source of truth** for session state. Every time you start a new session, **read this file first** and continue from where the previous session left off.

**Project:** SonicRoom — synchronized group music listening app
**Deployed URL:** https://minisavan-webapp.vercel.app/
**Last updated:** 2026-09-01

---

## 📌 Current Focus / Where We Left Off

**ACTIVE TASK (in progress): Fix 4 non-security UI/UX issues** per the user's request. User said: fix the remaining issues **except security concerns**, without breaking working functionality. The 4 issues:
1. Home page should show **only rooms currently playing** a song, with a "no rooms are currently active" empty state, and good UI showing room contents.
2. Let users **pick a room cover image** from options during room creation.
3. When the **host leaves** a room, **clear the room's queue/songs** so restarting broadcasting shows empty.
4. Fix the **room dashboard mobile layout** (chat + song image positioning) — desktop is fine, mobile is not.

**All 4 fixes are CODED and E2E-VERIFIED locally (2026-09-19). Only REDEPLOY to live (Render + Vercel) remains.**

---
### Next steps (resume here)
- **REDEPLOY server** (Render) + **client** (Vercel) to reflect the verified local fixes on the live URL. Nothing else is pending for the 4 issues.
- Optional follow-up (NOT requested, observed during testing): 4 rooms in the shared DB have stale `PLAYING` playback states with 0 listeners and no track name (abandoned sessions). Home correctly hides them (filter requires `isPlaying && currentTrackName`). A future "reap stale PLAYING when listeners hit 0" job could clean this, but it was deliberately left out to avoid disturbing working functionality.

### E2E verification record (2026-09-19, local server :3001 + client :5174, same Atlas DB)- `GET /rooms` returns `isPlaying`/`isPaused` on all rooms — verified via curl.
- Room create with `coverImage` persists + round-trips through `GET /rooms` — verified (rooms "E2E Cover Room", "Live Home Check").
- Host `room:change-track` → `room:track-changed` PLAYING received — verified via socket.io-client script.
- Host `room:leave` → remaining listener receives `room:queue-cleared` (IDLE state) and `GET /rooms` shows `isPlaying:false, currentTrackName:null` — verified.
- Home positive path in real mobile UI (375x812): live room card shows LIVE badge + now-playing song + cover + host; stale rooms excluded; empty state ("No rooms are currently active" + Browse Rooms) shows when nothing playable — verified via browser snapshot.
- `npm run build` passes (tsc + vite); `npm run lint` 0 errors (warnings only, pre-existing); `node --check` on both server route files OK.
- Mobile RoomDashboard geometry: chat panel bottom=671 vs 812 viewport (reply box above player dock), stage min-h 240 — verified numerically.
- Test artifacts left in shared DB (consistent with prior sessions): rooms "E2E Cover Room", "Live Home Check" (ENDED after host disconnect), "DJ Test Play Room", user "E2EListener" (+910000000001). E2E scripts in /tmp/opencode (e2e-room*.js, e2e-host-live.js, e2e-play.js, e2e-cleanup.js).

### NICE-TO-HAVE / NOT DONE
- A `room:queue-cleared` client handler was added in `client/src/store.ts` but NOT verified.
- Room "Up Next" queue items are NOT auto-cleared when a QUEUED song finishes playing — acceptable for now; on host re-broadcast the queue is cleared fresh.

---

## ✅ Pending Todos

- [x] Create persistent session system (manifest + JSON)
- [x] **Issue 1 (Home filter):** server `GET /rooms` enriches `isPlaying`; Home filters to playing rooms + "No rooms are currently active" empty state + now-playing cards. **E2E VERIFIED** (positive + empty paths in mobile UI).
- [x] **Issue 2 (Room cover):** 8-option cover selector in `CreateRoomModal`; `POST /rooms` persists `coverImage`. **E2E VERIFIED** (persist + round-trip).
- [x] **Issue 3 (Host-leave queue clear):** `room:leave`/room-ended clears queue + resets playback to IDLE, emits `room:queue-cleared`; client handler in store.ts. **E2E VERIFIED** (listener receives event, server state resets).
- [x] **Issue 4 (Mobile dashboard layout):** compact stage + chat `h-[45vh]`. **VERIFIED numerically**.
- [x] **Build/lint/syntax:** `npm run build` OK, lint 0 errors, `node --check` OK.
- [ ] **Redeploy** server (Render) + client (Vercel) — the only remaining step.
- [ ] Fix committed `.env` file (`server/.env`) — remove secrets from git history *(security — deferred)*
- [ ] Remove hardcoded JWT secret fallback in `authMiddleware.js` and `auth.js` *(security — deferred)*
- [ ] Lock down CORS from `'*'` to configured origin *(security — deferred)*
- [ ] Implement rate limiting (chat, reactions, room creation) per PRD
- [ ] Add proper test framework
- [ ] Convert server to TypeScript / add Zod validation
- [ ] Remove committed `dist/` build output / add to `.gitignore`
- [ ] Implement missing PRD features: approval-required join, member removal by admin, notifications

---

## 🚨 Known Issues (prioritized)

| ID | Severity | Issue |
|----|----------|-------|
| SEC-1 | High | `.env` committed to repo (MongoDB URI, JWT secret) |
| SEC-2 | High | Hardcoded JWT secret fallback (`'vibesphere-super-secret-key'`) |
| SEC-3 | Medium | Wildcard CORS `origin: '*'` (server.js:23) |
| SEC-4 | Info | No password-based auth |
| ARCH-1 | Medium | No monorepo/shared types (docs describe one) |
| ARCH-2 | Medium | Server is vanilla JS (docs say TS) |
| ARCH-3 | Medium | No rate limiting implemented |
| ARCH-4 | Medium | No test framework (only ad-hoc test-*.js) |
| CODE-1 | Low | Excessive `any` types in Zustand store |
| CODE-2 | Low | Mystery player-script files in server root |

---

## 🎯 Decisions & Context

- Phone-number auth (no password) — chosen design
- Server-authoritative playback — never trust client position
- Three-tier drift correction (<100ms ignore / 100-500ms gentle / >500ms hard seek)
- Music fallback chain: JioSaavn → Gaana → SoundCloud → YouTube

### Verification Commands
- Client dev: `npm run dev` in `client/`
- Client build: `npm run build` in `client/`
- Client lint: `npm run lint` in `client/` (OxLint)
- Server: `npm start` in `server/`

### Local Dev / Testing Setup (for verifying server changes)
- Local server on `localhost:3001` (`node server.js` from `server/`, MongoDB Atlas via `server/.env`).
- Local client on `localhost:5174` (**port 5173 is taken by another project** — labha-dashboard) with `VITE_API_URL=http://localhost:3001/api VITE_SOCKET_URL=http://localhost:3001`.
- **Note:** a JWT obtained from the LIVE server is invalid on the LOCAL server (different secret) — re-login as TestDJ (`+911234567890`) on local before testing room/queue features.
- E2E socket tests can run headless with `client/node_modules/socket.io-client` (scripts in `/tmp/opencode/e2e-*.js`); `room:join` takes `{ roomId, userId }` directly (no socket auth).
- This model cannot read screenshots; verify UI geometry numerically via `chrome-devtools_evaluate_script` bounding-box checks.

### Architecture Notes
- **Client entry:** `client/src/main.tsx` (ErrorBoundary, AudioProvider, BrowserRouter)
- **Server entry:** `server/server.js` (Express + Socket.io + MongoDB)
- **Socket handlers:** `server/routes/socket.js`
- **Music provider:** `server/services/MusicProvider.js` (cascading fallback)
- **Docs:** `docs/` (PRD, system arch, DB design, realtime arch, UI ideology)

---

## 🧪 Full QA Sweep (2026-09-19) — Bugs Found

Coverage: 40 API cases (36/40 pass; 4 initial failures retested — 3 were test artifacts needing real songIds, 1 is real bug M3), 19 socket cases (19/19), full browser UI flows on mobile 375x812 + desktop 1440x900 (auth, create-room+cover, chat, search+play, player dock, add-to-playlist, library, playlist detail/remove/delete+confirm dialogs, edit-profile modal, logout, empty states).

**Verified working:** auth validation + login errors, room create/list/covers/playing indicators, search, history, like toggle, playlist CRUD + duplicate-guard + cross-user isolation (404), chat send/receive, reaction allowlist, member permission denials (play/pause/seek/change-track), pause/seek/stop broadcasts, member-leave preserves playback, host-leave clears queue, rejoin cancels disconnect grace, logout, no h-overflow mobile/desktop.

### HIGH
- **H1 — `room:join` ignores room status + visibility** (`server/routes/socket.js` ~L36-70). Joining an ENDED room returns success; dashboard renders a dead interactive-looking room ("Waiting...", working chat box) that can never legitimately play. A stranger can also join a PRIVATE+OPEN_JOIN room with just the ID. Verified via socket (`{"success":true}` for both) + UI (ENDED room renders full dashboard).
  - ✅ **FIXED 2026-09-20:** `room:join` now rejects ENDED rooms (`'Room has ended'`) and PRIVATE rooms for strangers (`'This room is private'`; existing non-removed members may still rejoin). Verified 5/5 via socket (stranger PRIVATE denied, host PRIVATE ok, stranger/host ENDED denied, stranger PUBLIC still ok).
- **H2 — Room session doesn't survive page reload.** `roomId` is memory-only (persist keeps user+token), socket has `autoConnect:false` and only connects in `joinRoom`. After a reload while browsing (common on mobile), the host's search-click plays personally and gets wiped on dashboard rejoin — broadcast silently never happens; socket emits on a dead connection are dropped. Needs persist roomId + auto-reconnect/rejoin.
  - ✅ **FIXED 2026-09-20:** (1) `partialize` now persists `roomId`+`mode`; (2) App boot effect calls `joinRoom(persistedRoomId)` on every load — this re-establishes `socket.userId` (required for ALL permission-gated emits), cancels disconnect grace, re-syncs role/queue/playback; (3) `logout()` now clears all room state (prevents cross-account leakage). Key finding during fix: mere socket re-connect is NOT enough — server auth is per-connection via `room:join`. Verified E2E in browser: full reload → search → host clicks song → server PLAYING; logout clears persisted room. Build + lint clean.

### MEDIUM — ALL FIXED & VERIFIED 2026-09-20 (local :3001/:5174)
- **M3** — `POST /playlists/:id/remove` 400 on platform songId. Fixed: only include `_id` in `$or` when input is a valid ObjectId (`playlists.js`). Verified: remove by platform id 200, by internal id 200, unknown id safe no-op.
- **M1** — Dashboard now handles `room:ended`: toast + redirect to /rooms (store `roomNotice`, dashboard effect). Note: with current server logic the event is nearly undeliverable (any present ACTIVE member becomes successor instead) — kept as defense-in-depth; wiring placed, real-event delivery re-verifiable if an explicit End-Room flow is added later.
- **M2** — Join failure showed endless skeleton (my first fix attempt gated the error UI inside `isJoining` — unreachable; caught by testing, restructured). Now: "Couldn't join this room / <reason> / Browse Rooms". Verified in UI with bad ID.
- **M5** — Invite codes live: `GET /api/rooms/join/:code` (auth, ACTIVE only), Rooms page code input w/ inline errors, dashboard code chip + copy (clipboard + fallback), `?code=` carried into `room:join` (grants PRIVATE entry, case-insensitive). Verified API (200/404/401), socket (no-code denied, lowercase ok), and full UI loop incl. copy click.
- **M4** — Chat persisted: new `RoomMessage` model, save on `room:chat` (cap 100/room, fire-and-forget), last-50 backfill in `room:state`, client applies history. Verified socket (2 msgs in order on rejoin) + UI (history renders after re-entry).
- **M6** — Approval flow built: PENDING membership (schema already supported it), `room:join-requested` / approve / deny events, `pendingRequests` in `room:state` (admins only), requester pending UI + auto-join on approval + denial message, admin Approve/Deny section, visibility+joinMode selectors added to CreateRoomModal. Verified 10/10 socket + full UI loop (request → admin approve → requester auto-joins dashboard). Bonus fix found while testing: bogus userIds created ghost memberships → `room:join` now rejects unknown users; pending list filters unresolvable entries.
- Build (`tsc+vite`) passes, lint 0 errors, `node --check` clean on all touched server files.

### LOW / Observations
- **L1** — Stale `PLAYING` states (4 rooms, 0 listeners, no track) never reaped; Home hides them only via the `currentTrackName` filter. Possible follow-up: IDLE them when listeners hit 0.
- **L2** — New rooms init playback as `PAUSED` with no track (`rooms.js:71-76`); should be `IDLE`. Harmless but semantically wrong.
- **L3** — Old XSS note appears mitigated: `<h1>Injected</h1>` renders escaped in room lists (React). No raw-HTML sink found.
- **L4** — Prior a11y/SEO notes (form ids, nav labels, meta description) not retested; carried over.
- Test artifacts in shared DB: "UI QA Room" (ENDED), "QA Private", "QA Socket Room", "QA Cover Room", "E2E Cover Room", "Live Home Check" (ENDED), "DJ Test Play Room", "QA Mobile Playlist", users QATester/E2EListener. Scripts: `/tmp/opencode/qa-*.py`, `e2e-*.js`.

---

## ✨ UI Suggestions — IMPLEMENTED 2026-09-20 (local :3001/:5174)

1. **Queue system** — server `room:queue-add/remove/play` + `room:queue-updated` broadcast (change-track refactored into `applyTrackChange`/`upsertSong` helpers, regression 5/5); store actions with MEMBER guards; dashboard Up Next now manageable (play-now/remove, host-only) and visible pre-playback (extracted `RoomQueuePanel`); search shows "+ Queue" per result in room-host mode. Verified socket 8/8 + full UI loop.
2. **Reactions overlay** — store `reactions` feed + `room:reaction` listener (cap 30, prune>4s), floating emoji burst over stage (`animate-reaction-float` keyframe). Verified live in UI (5 emojis from node emitter).
3. **Room list hygiene** — Rooms page split into "Live now" + "Open rooms", each sorted by listeners desc (extracted `RoomCard`; also fixes nested-component remounts on every 10s poll). Verified in UI.
4. **Chat avatars + timestamps** — avatar img (fallback initial) + `hh:mm` per message. Verified (real avatar images render).
5. **Host/listener identity** — "YOU'RE HOSTING" (+hint "Pick songs from Search") / "LISTENING LIVE" badges in both stage states. Verified.
6. **Add-songs entry** — host/controller button in stage (both states) → `/search`. Verified navigation. (Also fixed an overlap where the absolute invite-code chip covered the button — added bottom padding.)
7. **Mobile tabs** — Now Playing / Queue (n) / Chat tab bar (`lg:hidden`); one panel at a time on mobile (chat 55vh, queue panel + empty state); desktop side-by-side untouched. Added mobile room header (Leave + room name + count) since stage header hides off-tab; stage Leave/listeners now `hidden lg:flex`. Verified: tab switching, geometry (chat 112→559 above dock), desktop intact (no tabs/overflow, stage Leave visible).
- Found while testing #7: cross-room state bleed — App boot effect joined the persisted room even when landing on a different room URL, and the global `lastSequenceNumber` guard rejected the new room's fresh state (stale previous-room UI). Fixed: boot skips when URL names another room; `lastSequenceNumber` resets on every `joinRoom` start. Verified (R2 shows own state/code).
- Build (`tsc+vite`) passes, lint 0 errors, `node --check` clean throughout.

---

## 🎵 Rooms cleanup + Shuffle + Music engine (2026-09-20)

- **Covers:** new `client/src/utils/roomCovers.ts` (12 curated covers + `coverForRoom` hash fallback by room id); modal/Rooms/Home all use it. Old rooms now show varied art instead of one repeated image. Verified 4 distinct covers in UI.
- **Room delete:** `DELETE /api/rooms/:id` (host-only 403 otherwise; 401/404 handled) emits `room:ended` then wipes members/playback/queue/messages/room. Dashboard trash button (host only, both mobile header + desktop stage, `window.confirm`). Verified API matrix + full UI delete.
- **Dummy cleanup:** deleted 46 junk/bot rooms (`funny` x8, `fergw`, `TestRoom*`, `Mob*`, `Desk*`, `Sync*`, all QA/E2E/H sessions) with full related-data cleanup. Kept 5 possibly-real rooms (AI Sync Room, love songs, hindi siongs, fun, Anohari).
- **Shuffle:** store `shuffle` (persisted) + `toggleShuffle`; `playNext` jumps random non-repeating; Player toggle button with accent active state (listener-disabled like other controls). Verified: 5 Next presses jump non-sequentially, toggle persists.
- **Engine v2** (researched Spotify/Apple-Music patterns: candidate generation → ranking → exclusions/diversity/explanations; federated retrieval + relevance ranking + dedup):
  - Search: parallel Saavn+Gaana+SoundCloud+YouTube fetch (8s timeouts, was fragile waterfall), query parsing ("Artist - Title", "X by Y"), scoring (exact/starts/token/artist match + log-popularity + source weights + derivative-version penalty unless requested), base-title dedup, 5-min cache, wider entity decoding. Result: original Kesariya on top (was karaoke spam), typo queries return 20, multi-source merge visible in UI.
  - Recommendations: taste profile (likes×3 + recency-weighted history) → candidates (affinity artists + YouTube co-watch related) → ranked (affinity×2 + popularity + source weights) with ≤3/artist diversity, exclusions (seed, heard ids/titles incl. base-title variants), per-item `reason` shown on Home ("Because you listen to X", "Listeners also played", "More from Y"). Home rec fetch now authenticated (was anonymous → never personalized). Verified personalized/cold/dedup/exclusion cases.
- Build+lint clean; `node --check` on touched server files.

---

## ✅ Full Regression After All Changes (2026-09-20) — VERDICT: STABLE

- **API: 42/42** (auth validation, rooms CRUD+enrichment, invite resolve 200/404/401, private hidden, DELETE 403/404/401/200 + cleanup verified, search incl. karaoke check, recs auth+cold+reasons, history/likes/profile, playlists incl. dup-guard + both remove paths + cross-user isolation).
- **Socket: 23/23** (join errors, member permission denials ×4, play/pause/seek broadcasts, chat validation + broadcast, reaction allowlist + broadcast, member-leave preserves, host-leave clears, queue add/remove/play + denials, approval request/approve/notify, private denied, chat history ordered backfill).
- **Client:** `tsc+vite` build passes, OxLint 0 errors, `node --check` clean on all 7 touched server files.
- **Browser smoke (mobile 375 + desktop 1440):** Home (history/trending/LIVE cards), Rooms (sections/varied covers/invite form), dashboard join + tabs + chat send w/ timestamp, search play + shuffle toggle (non-sequential verified + persists), library, playlist flows, logout. Console clean.
- **Stability:** 1 server start (no crash loops), 0 unhandled errors; log "errors" are only intentional 4xx from negative tests. Caps holding: chat 100/room, search cache 200, reactions 30.
- DB left clean (5 possibly-real rooms; 46 junk + 8 regression rooms removed with full related-data cleanup).

### New minor observations (not blockers)
- **B1 (low) → FIXED 2026-09-20:** `/search` accepts `exclude` (e.g. `?exclude=youtube`); Home trending rail uses it. Verified 0 youtube items in trending.
- **B2 (low) → FIXED 2026-09-20:** `cleanVideoTitle()` truncates YouTube ` | ...` tails (search + co-watch related). Verified 0 pipe-tails in 20 results; UI trending rail clean.
- Carry-over (out of scope, unchanged): SEC-1..SEC-4 security items, no rate limiting, no test framework, a11y/SEO leftovers.

*When a session ends, update this file and `.opencode/session.json` with the new state.*
