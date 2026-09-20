# SonicRoom — Agent Instructions

## CRITICAL: Session Continuation

This project uses a **persistent session system**. Every time you (the agent) start work in this directory, you MUST follow these steps:

1. **Read `.opencode/session.md`** — this is the human-readable session manifest. It contains the current focus, pending todos, known issues, and decisions.
2. **Read `.opencode/session.json`** — the structured machine-readable state (todos, issues, decisions).
3. Continue work from where the previous session left off (see "Current Focus" in the manifest).

### When concluding work / ending a session
Update both files so the next session can continue seamlessly:
- Update **`session.md`**: current focus/where we left off, check off completed todos, add new todos/issues/decisions as needed.
- Update **`session.json`**: bump `lastUpdatedAt`, move items between `todos.inProgress/pending/completed`, update `knownIssues`/`decisions`.
- Keep the two files in sync.

## Project Overview

**SonicRoom** — social music app for synchronized group listening. Users join "Rooms" and listen to the same song together in real-time.

- **Frontend:** `client/` (React 19, TypeScript, Vite, Tailwind v4, Zustand, Socket.io)
- **Backend:** `server/` (Node.js, Express 5, MongoDB/Mongoose, Socket.io)
- **Docs:** `docs/` (PRD, system arch, DB design, realtime arch, UI ideology)
- **Deployed:** https://minisavan-webapp.vercel.app/

## Commands

- Client dev: `npm run dev` (in `client/`)
- Client build: `npm run build`
- Client lint: `npm run lint` (OxLint)
- Server: `npm start` (in `server/`)

## High-Priority Known Issues
- `.env` committed to git with secrets (SEC-1) — remove from history
- Hardcoded JWT secret fallback (SEC-2)
- Wildcard CORS (SEC-3)
- See `.opencode/session.md` for full prioritized list.
