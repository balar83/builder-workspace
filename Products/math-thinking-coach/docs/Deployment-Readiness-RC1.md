# Deployment Readiness — RC1

**Milestone:** RC1 — Deployment Readiness and Sprint C Planning
**Status:** Planning artifact, plus two small config changes (see §4). No architectural changes.
**Date:** 2026-07-29

---

## 1. Is the application suitable for `v1.0.0-rc1`?

**Yes, with the two config gaps in §4 fixed — which this milestone does.** Grounded in what's actually shipped and verified, not aspiration:

**What works, live-verified across Sprint A and Sprint B, not just green tests:**
- Full daily-use loop: student login → Dashboard → Start Practice → configuration → session creation → question → answer → coaching (TRY_AGAIN/SHOW_HINT/SHOW_SOLUTION/NEXT_QUESTION, all four branches) → next question → repeated through a real 5-question session → terminal transition.
- 198/198 backend tests, 75/75 frontend tests, `tsc -b` and `oxlint` clean, as of commit `695fff6`.
- The pre-existing anonymous flow (no login required) is unaffected and still works, giving a fallback path if anything session-specific ever needs debugging.
- Every session-backed route is guarded (`RequireStudent`); duplicate-submission prevention, invalid-session handling, and the 409 terminal-response path have all been exercised against a real running server, not assumed.

**What's genuinely missing — Sprint C's scope, not this milestone's:**
- Session Completion is a bare placeholder ("You've completed this session" + Back to Dashboard) — functional, not broken, but not the real mode-aware summary `Session-Frontend-Implementation-Plan.md` designed.
- No resume support yet — closing the tab mid-session doesn't strand the student (the session itself is still there server-side, at the same URL), but nothing on the Dashboard tells them to go back to it.
- No final UX polish pass.

**Why this is still RC1-appropriate**: an RC is explicitly a *release candidate*, not the finished v1.0. The core value — a student can sit down, practice a real session, get coached, and finish — works today, verified against real content and a real server. The gaps above are known, named, and don't block daily use; they degrade gracefully (a plain finish screen, a manual trip back to Dashboard) rather than breaking anything.

**What was NOT RC-ready before this milestone, now fixed (§4):**
- CORS was hardcoded to `http://localhost:5173` — any deployment to a real URL would have failed outright with CORS errors on every request.
- The session cookie's `https_only` flag was hardcoded `False` — harmless over plain HTTP, but not configurable if the deployment terminates HTTPS in front.

**What remains a deployment-time responsibility, not a code gap:**
- `SESSION_SECRET_KEY` still defaults to an insecure placeholder (`dev-only-insecure-secret-change-me`) — this is correct for local dev and must be overridden with a real secret at deploy time (§2, §3 of `Deployment-Guide.md`), not something to bake a "real" default into source control.
- Shadow Mode (ADR-002) will fail its background Ollama call on every submission if deployed without a local Ollama instance — harmless to the response (that's the entire point of ADR-002's execution model), but pointless and log-noisy. `SHADOW_MODE_ENABLED=false` in production is a config choice, not a code fix.

## 2. Recommended deployment architecture

Single-family, one student, daily use — this does not need CI/CD, containers, or a managed database. `ProductArchitecture.md`'s own scale assumptions (SQLite, "classroom scale, not multi-server") already undershoot what a single household needs; nothing here should exceed that.

### Frontend hosting
Static build (`npm run build` → `frontend/dist/`) — no server-side rendering, no Node process needed at runtime.

### Backend hosting
FastAPI/uvicorn, unchanged from how it already runs — one process, one port.

### Two viable shapes, genuinely both reasonable

**Recommended: split, managed hosting.** Frontend on a static host with a generous free tier (Vercel, Netlify, or Cloudflare Pages — connect the repo, build command `npm run build` in `frontend/`, publish directory `dist/`). Backend on a small always-on host (Render, Fly.io, or Railway — run `uvicorn app.main:app --host 0.0.0.0 --port $PORT`). Zero servers to patch, automatic HTTPS on both sides, push-to-deploy on both — the lowest ongoing maintenance burden for a parent who isn't trying to run a homelab, and it directly matches this milestone's "optimize for fast iteration" principle. Costs: usually $0 for the frontend, a few dollars a month for the backend once a persistent disk is added (see the data-loss warning below — this is not optional).

**Alternative: single self-hosted box.** One machine (a spare mini-PC, a Raspberry Pi, or a small VPS) running both the built frontend and the FastAPI backend, fronted by [Caddy](https://caddyserver.com/) as a lightweight reverse proxy — a single static binary, a ~10-line `Caddyfile` gets you static file serving (with the SPA-fallback rule React Router needs — see `Deployment-Guide.md`), a reverse proxy to the backend on `localhost:8000`, and automatic HTTPS via Let's Encrypt if a real domain points at it. Same-origin serving means CORS is a non-issue by construction. If the goal is LAN-only access (no need to reach it outside the house), skip the domain/HTTPS entirely and just use the machine's local IP; for reaching it from outside the home network without exposing a public port, [Tailscale](https://tailscale.com/) (free for personal use) is the simplest option — it puts the family's devices on a private network without any port-forwarding or public exposure. Worth choosing this shape if there's already spare hardware sitting around, or if avoiding third-party accounts matters more than avoiding server maintenance.

Neither shape requires Docker, Kubernetes, a CI/CD pipeline, or a managed database service — all of that would be exactly the "speculative infrastructure" this milestone explicitly rules out for a one-student product.

### Database
No change. SQLite files (`runtime.db`) plus the JSON account stores (`teachers.json`, `classes.json`, `students.json`), exactly as ADR-004/ADR-005 already established — this is not a new decision, just confirming nothing about deployment requires revisiting it.

**The one hard requirement, not optional**: whichever host runs the backend, `backend/app/data/` **must sit on a persistent disk**, not ephemeral container storage. Several free/hobby tiers (Render's free web service, for example) wipe the filesystem on every restart or redeploy by default — for most apps that's fine, but here it would silently delete every student account, every recorded attempt, and every session on the next deploy. If a managed host is chosen, explicitly provision its persistent-disk/volume feature (Render's persistent disks, Fly.io's volumes, Railway's volumes) for that directory — usually a small added cost, and worth it, since the entire point of Milestone B/ADR-005 was to stop losing progress on every reset.

### Environment variables
Full table in `Deployment-Guide.md` §3. Summary: `SESSION_SECRET_KEY` must be changed from its dev default; `ALLOWED_ORIGINS` must list the real frontend origin(s) if split-hosted (same-origin self-hosting doesn't need this at all); `SHADOW_MODE_ENABLED` should be `false` unless a real Ollama instance is reachable from the deployment; `VITE_API_BASE_URL` is a frontend *build-time* variable pointing at the backend's real URL.

## 3. Branching strategy

Consistent with, and now made concrete beyond, `Release-Plan-v1.0.md` §10 — that document already established `main` as the integration branch and named `release/v1.0` as the eventual stabilization branch; this section is the RC-tagging detail that document didn't need yet.

- **`main`** — always the latest reviewed, tested state, exactly as today. Every Sprint (A, B, and RC1's own two config lines) has landed here directly, matching this project's small-slice-at-a-time, mostly-linear history.
- **`feature/*`** — one branch per unit of work when something needs to be isolated before merging (a Sprint C slice, an experiment). Optional for solo, sequential work the way this project has run so far — nothing here mandates it retroactively.
- **`release/v1.0`** — cut from `main` once Sprint C is functionally complete and this RC's remaining checklist items (`Deployment-Guide.md` §6) are satisfied. Exists to allow stabilization (bug fixes found during RC testing, doc polish) without blocking new work from starting against `main`.
- **Release Candidates** are tags on `release/v1.0`, not separate branches: `v1.0.0-rc1`, `v1.0.0-rc2`, and so on, each one a real, deployable checkpoint used to validate the app in its actual deployment environment before committing to a final release. **`v1.0.0-rc1` should be tagged now**, on `main`, at the commit that includes this milestone's two config fixes — there is no need to wait for `release/v1.0` to exist first; the branch gets created when stabilization work actually starts, not preemptively.
- **Production release**: once an RC has run for a real stretch of daily use with no issues, merge `release/v1.0` back into `main` and tag the annotated `v1.0.0` on that merge commit — exactly as `Release-Plan-v1.0.md` §10 already specified. From there, semantic versioning applies: `v1.0.x` for fixes, `v1.x.0` for additive milestones (Sprint C's own eventual completion, or later work like Data Handling's export).
- **Rollback** is "redeploy the previous tag" (`Deployment-Guide.md` §5) — there is no blue/green or canary infrastructure here, deliberately; at this scale, a few minutes of downtime while redeploying an older tag is an acceptable, honest tradeoff against building anything more elaborate.

---

See `Developer-Runbook.md` for local setup, `Deployment-Guide.md` for the actual deploy/update/rollback mechanics, and `Sprint-C-Implementation-Plan.md` for what comes after this RC.
