# Deployment Guide

**Scope:** how to actually build, deploy, update, and roll back Math Thinking Coach. Pairs with `archive/Deployment-Readiness-RC1.md` (the architecture recommendation and rationale) and `Developer-Runbook.md` (local development, not covered again here).

## 0. Current production deployment

Split hosting, live as of Release 0.1.2 (2026-08-07):

| | URL | Platform | Deploys on |
|---|---|---|---|
| Frontend | https://math-thinking-coach-zeta.vercel.app/ | Vercel | push to `main` (auto-deploy) |
| Backend | https://math-thinking-coach-api.onrender.com | Render | push to `main` (auto-deploy) |

The Vercel project was renamed from `builder-workspace` to `math-thinking-coach` on 2026-08-07 (old URL `builder-workspace-zeta.vercel.app` — now 404, do not use). **Renaming a Vercel project does not automatically re-alias an existing production deployment to the new default domain** — the new domain returned `DEPLOYMENT_NOT_FOUND` until a manual redeploy (Deployments tab → latest deployment → **⋯ → Redeploy**) was triggered. If this project is ever renamed again, expect the same step. **A rename also requires updating the backend's `ALLOWED_ORIGINS` env var on Render to the new URL** — CORS will otherwise silently break every API call from the new domain while the old one keeps working. Both were done and verified live for this rename.

Two deployment shapes are supported by everything below — pick one:

- **Split, managed hosting** (recommended — see `archive/Deployment-Readiness-RC1.md` §2): frontend on a static host (Vercel/Netlify/Cloudflare Pages), backend on a small always-on host (Render/Fly.io/Railway) with a **persistent disk** for `backend/app/data/`.
- **Self-hosted single box**: both on one machine, fronted by Caddy.

Steps below are marked **[split]** or **[self-hosted]** where they differ; unmarked steps apply to both.

---

## 1. Build commands

**Backend** — no build step. It's Python; deployment is "install dependencies, run uvicorn" (§2).

**Frontend**:

```bash
cd frontend
npm ci --legacy-peer-deps
npm run build
```

`--legacy-peer-deps` is required, not optional — confirmed by validating this guide's steps against a clean clone (`Developer-Runbook.md` §2/§8): a plain `npm ci`/`npm install` fails outright on an unresolvable peer-dependency conflict (`@testing-library/react@^14` vs. this project's React 19). If a CI/deploy platform's build command is configured separately from this file, make sure the flag is set there too.

`npm run build` runs `tsc -b && vite build` (per `package.json`) — type-checks, then produces static output in `frontend/dist/`. Fails the build on a type error, which is the intended gate; don't deploy a build that didn't pass `npm run build` cleanly.

Set `VITE_API_BASE_URL` **before** running `npm run build`, not after — Vite bakes `import.meta.env.VITE_*` values into the built JS at build time, not read at runtime:

```bash
VITE_API_BASE_URL=https://your-backend-host.example.com/api/v1 npm run build
```

## 2. Deployment steps

### **[split]** Frontend (Vercel/Netlify/Cloudflare Pages)

1. Connect the repository; set the project root to `frontend/`.
2. Build command: `npm run build`. Output directory: `dist`. **Override the platform's install command to `npm install --legacy-peer-deps`** — its default auto-detected install step will otherwise fail on the same peer-dependency conflict named in §1 (Vercel/Netlify/Cloudflare Pages all expose an "install command" override in their build settings).
3. Set the `VITE_API_BASE_URL` environment variable in the platform's dashboard to the backend's real URL (§1).
4. **SPA fallback (unmatched routes serving `index.html`) does not happen automatically on Vercel for this project — confirmed by testing the live production URL, not assumed.** A direct load or hard refresh of any client-side route (`/dashboard`, `/session/:id`, `/topic/:id`, ...) returned Vercel's own platform `404: NOT_FOUND` page, not the app — every deep link and every refresh was broken in production despite the app's own React Router catch-all route (Release 0.1.2's `NotFoundPage`) working perfectly once the SPA actually loads. Fixed with `frontend/vercel.json`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
   Re-verify this specifically after any Vercel project rename or a switch to Netlify/Cloudflare Pages — `_redirects` (`/* /index.html 200` in `frontend/public/`) is the equivalent for Netlify; Cloudflare Pages' behavior should likewise be verified against the live URL, not assumed from documentation.

### **[split]** Backend (Render/Fly.io/Railway)

1. Connect the repository; set the service root to `backend/`.
2. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (these platforms inject `$PORT`; don't hardcode `8000`).
3. Set the environment variables from §3 in the platform's dashboard — **`SESSION_SECRET_KEY` and `ALLOWED_ORIGINS` are not optional here**. Because the frontend and backend are on different domains in this shape, this is a **cross-site** deployment for cookie purposes: also set `SESSION_COOKIE_SAMESITE=none` and `SESSION_HTTPS_ONLY=true` (both together — a browser silently drops a `SameSite=None` cookie that isn't also `Secure`). Leaving `SESSION_COOKIE_SAMESITE` at its `lax` default here reproduces a confirmed bug: login succeeds and returns a cookie, but the very next authenticated request comes back 401 because the browser withholds a `Lax` cookie on a cross-site `fetch`/XHR call.
4. **Provision a persistent disk/volume mounted so app data survives a restart or redeploy.** This is the single most important step in this entire guide — most free tiers default to ephemeral storage, which would silently delete every account and every recorded attempt on the next deploy. On Render, mount the disk at `/var/data` and set the environment variable `DATA_DIR=/var/data` so the app writes there instead of the ephemeral `backend/app/data/`. See `archive/Deployment-Readiness-RC1.md` §2 for why this isn't optional.

### **[self-hosted]** Single box

1. `git clone` the repository onto the machine; follow `Developer-Runbook.md` §2 to install backend and frontend dependencies.
2. Build the frontend (§1 above), with `VITE_API_BASE_URL` pointed at wherever Caddy will expose the API (e.g. `https://your-domain.example.com/api/v1`, or `http://<lan-ip>/api/v1` for LAN-only).
3. Run the backend as a long-lived service, not `--reload`. On a Linux box, a systemd unit is the simplest reliable option:

   ```ini
   # /etc/systemd/system/mtc-backend.service
   [Unit]
   Description=Math Thinking Coach backend
   After=network.target

   [Service]
   WorkingDirectory=/path/to/Products/math-thinking-coach/backend
   Environment=PATH=/path/to/Products/math-thinking-coach/backend/.venv/bin
   EnvironmentFile=/path/to/Products/math-thinking-coach/backend/.env
   ExecStart=/path/to/Products/math-thinking-coach/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable --now mtc-backend
   ```

4. Install Caddy and point it at both the built frontend and the backend:

   ```
   # /etc/caddy/Caddyfile
   your-domain.example.com {
       handle /api/* {
           reverse_proxy localhost:8000
       }
       handle {
           root * /path/to/Products/math-thinking-coach/frontend/dist
           try_files {path} /index.html
           file_server
       }
   }
   ```

   `try_files {path} /index.html` is the SPA-fallback rule — without it, the same "404 on a hard refresh at `/dashboard`" problem from the split-hosting note above applies here too. Caddy handles HTTPS automatically once a real domain resolves to the machine; for LAN-only access, replace the site address with `:80` or the machine's local IP and skip HTTPS (and correspondingly leave `SESSION_HTTPS_ONLY=false`).

   ```bash
   sudo systemctl reload caddy
   ```

Because Caddy fronts both under one origin, `ALLOWED_ORIGINS` doesn't need to include anything beyond what's already there for local dev — the browser never makes a cross-origin request in this shape at all.

## 3. Environment variables

| Variable | Default | Deploy-time action |
|---|---|---|
| `SESSION_SECRET_KEY` | `dev-only-insecure-secret-change-me` | **Must change.** Generate a real secret (`python -c "import secrets; print(secrets.token_hex(32))"`) and set it wherever the backend runs. Every deployed session cookie is signed with this — a shared/default value across deployments would let one deployment forge another's sessions. |
| `DATA_DIR` | `backend/app/data` | **[split, Render]**: set to `/var/data` (or wherever the persistent disk from §2 step 4 is mounted) — otherwise app data is silently written to ephemeral storage and lost on redeploy. **[self-hosted]**: no change needed if `backend/app/data/` already lives on durable storage. |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | **[split]**: set to the frontend's real deployed origin (comma-separated if more than one, e.g. a preview + production URL). **[self-hosted with Caddy]**: no change needed — same-origin. |
| `SESSION_HTTPS_ONLY` | `false` | Set `true` once HTTPS is actually terminated in front of the backend (both recommended shapes get this for free — managed platforms and Caddy-with-a-real-domain both provide it). Leave `false` for LAN-only/no-TLS setups. **[split]: must be `true`** — required alongside `SESSION_COOKIE_SAMESITE=none` below. |
| `SESSION_COOKIE_SAMESITE` | `lax` | **[split]**: set to `none` — frontend and backend are on different domains, so the session cookie is cross-site; `Lax` is silently withheld by the browser on cross-site `fetch`/XHR, breaking every authenticated request after login. Must be paired with `SESSION_HTTPS_ONLY=true`. **[self-hosted]**: no change needed — same-origin via Caddy. |
| `SHADOW_MODE_ENABLED` | `true` | Set `false` unless a real Ollama instance (`SHADOW_OLLAMA_URL`) is reachable from wherever the backend runs — almost certainly `false` for both recommended deployment shapes. |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Frontend **build-time** variable — the backend's real, public URL. Not read at runtime; must be set before `npm run build` (§1). |
| `APP_NAME`, `APP_VERSION`, `API_PREFIX` | as in `.env.example` | No change needed. |
| `SHADOW_OLLAMA_URL`, `SHADOW_TIMEOUT_SECONDS`, `SHADOW_MODEL_NAME`, `SHADOW_LOG_PATH` | as in `.env.example` | Irrelevant once `SHADOW_MODE_ENABLED=false`. |

## 4. Updating a deployment

**[split]**: push to the branch each platform is watching (or trigger a manual deploy) — the platform rebuilds and redeploys on its own. No separate steps needed on either side.

**[self-hosted]**:

```bash
cd /path/to/Products/math-thinking-coach
git pull
cd frontend && VITE_API_BASE_URL=<real-url> npm ci --legacy-peer-deps && npm run build
sudo systemctl restart mtc-backend
```

The backend restart is enough to pick up any Python change; the frontend rebuild replaces the static files Caddy serves (no Caddy restart needed, it reads from disk on each request).

**Back up `backend/app/data/` before any update that touches backend code** — a `cp -r app/data app/data.backup-$(date +%Y%m%d)` before `git pull` is enough at this scale. There's no migration tooling in this project (deliberately, per `Developer-Runbook.md` §8) — if a future change alters the SQLite schema, the safe path is documented there (delete and let it recreate), which loses data unless a backup was taken first.

## 5. Rolling back

Both shapes: check out the previous tag and redeploy exactly as in §4/the platform's own rollback feature.

```bash
git checkout v1.0.0-rc1   # or whatever the last-known-good tag is
```

**[split]**: most platforms keep a deploy history with a one-click rollback to a previous build — prefer that over re-triggering a build from an old tag, since it's faster and doesn't depend on the build still succeeding today.

**[self-hosted]**: `git checkout <tag>`, rebuild the frontend, restart the backend service — same as an update, just to an older commit.

There is no database migration to reverse in either case, since this project has none yet — a rollback only ever affects code, never touches `runtime.db`'s schema. If a restored backup is ever needed (§4), stop the backend first, replace `app/data/`, then restart.

## 6. Release checklist

Before tagging and deploying any Release Candidate or final release:

1. `python -m pytest` (backend), `npx vitest run` + `npx tsc -b` + `npx oxlint` (frontend) — all clean, re-run fresh, not trusted from an earlier session.
2. A live walkthrough of the full loop this RC actually claims to support (`archive/Deployment-Readiness-RC1.md` §1's "what works" list) against a real running server — not just unit tests.
3. `git status` clean; the commit being tagged is the one actually reviewed.
4. Environment variables for the target deployment reviewed against §3 — `SESSION_SECRET_KEY` in particular, every time, for every new deployment target (never reuse one across environments).
5. Persistent storage confirmed for `backend/app/data/` on whatever host is being deployed to (§2) — verify this by checking the platform's own volume/disk configuration, not by assuming a previous deploy's settings carried over.
6. Tag cut: `git tag -a v1.0.0-rc1 -m "..."` (or the next `rcN`), pushed with `git push origin v1.0.0-rc1`.
7. Deploy, then re-verify the same live walkthrough from step 2 against the actual deployed URL, not just locally.
8. A backup of `backend/app/data/` taken immediately after the first successful deploy, so there's a known-good restore point from day one.
