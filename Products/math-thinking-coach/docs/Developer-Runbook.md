# Developer Runbook

**Purpose:** get a working local copy of Math Thinking Coach running from a clean checkout — backend, frontend, a real teacher/class/student, and the test suites. For deploying this application somewhere, see `Deployment-Guide.md` instead; this file is for local development only.

---

## 1. Prerequisites

Verified against what this repository actually runs on, including a full re-validation from a clean clone during Sprint C/RC1:

| Tool | Version used | Notes |
|---|---|---|
| Python | 3.13.5 | `backend/.venv` already targets 3.13; any 3.13.x should work. On Windows, use `py` if plain `python` doesn't resolve to a real install (§2, §8) |
| Node.js | 22.16.0 | |
| npm | 10.9.2 | ships with Node |
| Git | any recent version | |

No database server, no Docker, no other system dependency — persistence is SQLite (stdlib `sqlite3`) and plain JSON files, both created automatically on first run.

## 2. Installing dependencies

From the repository root, `Products/math-thinking-coach/`:

```bash
cd backend
python -m venv .venv
```

**Windows note, confirmed by re-validating this runbook against a clean clone:** on a machine where the Microsoft Store's Python app-execution alias is enabled (a common default), `python` resolves to a non-functional stub that just prints an install prompt, even with a real Python already installed. If `python -m venv .venv` fails that way, use the Python Launcher instead: `py -m venv .venv`.

Activate it — Windows: `.venv\Scripts\activate`; macOS/Linux: `source .venv/bin/activate`. Then:

```bash
pip install -r requirements.txt
cp .env.example .env
```

The defaults in `.env.example` are correct for local development as-is — no values need to change to run locally.

```bash
cd ../frontend
npm install --legacy-peer-deps
```

**`--legacy-peer-deps` is required, not optional, confirmed by re-validating this runbook against a clean clone:** a plain `npm install` fails outright with an unresolvable peer-dependency conflict (`@testing-library/react@^14` expects React 18; this project is on React 19). This isn't a transient npm quirk — it reproduces every time on a fresh `node_modules`, so `npm ci`/`npm install` elsewhere in this file and in `Deployment-Guide.md` mean the `--legacy-peer-deps` form.

## 3. Running the backend

From `backend/`, with the virtual environment active:

```bash
uvicorn app.main:app --reload
```

Starts at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`; health check at `http://localhost:8000/api/v1/health`.

`--reload` watches for file changes — the standard way to run this during development. Omit it for anything long-running (see `Deployment-Guide.md`).

## 4. Running the frontend

From `frontend/`:

```bash
npm run dev
```

Starts at `http://localhost:5173`, already configured (`src/config/api.ts`) to call the backend at `http://localhost:8000/api/v1` by default. Both servers need to be running simultaneously for the app to actually work end to end.

## 5. Initializing the database

There is no separate init command — none is needed. `session_store.py` and `attempt_service.py` both run `CREATE TABLE IF NOT EXISTS` against `backend/app/data/runtime.db` on first connection; the file and its two tables (`attempts`, `sessions`) are created automatically the first time anything touches them (e.g., the first answer submission or session creation). Same for the JSON account stores (`teachers.json`, `classes.json`, `students.json`) — `auth_service.py` creates them on first write. All four files are gitignored and start out absent on a clean checkout; that's the expected, correct state, not something to fix.

To start completely fresh (wipe all accounts, attempts, and sessions, keep all content), delete these four files from `backend/app/data/` while the server is stopped:

```
teachers.json
classes.json
students.json
runtime.db
```

They'll be recreated empty on the next write.

## 6. Creating a teacher, a class, and a student

Two ways to do this — through the UI (what a real user does), or via `curl` (faster for scripting a test scenario, and what this project's own live-verification passes have used throughout).

### Via the UI

1. With both servers running, open `http://localhost:5173`.
2. Click **Teacher login** → switch to **Register** → fill in email/password/name → **Register**.
3. On the welcome screen, fill in a class name → **Create Class** — the join code is shown on screen.
4. Open `http://localhost:5173/student/join` (or click **Join a class** from Home) → enter the class code, a display name, and a 4-digit PIN → **Join Class**.
5. You land on the Dashboard as that student.

### Via `curl`

```bash
# Register a teacher (this call also logs the teacher in - cookies saved to teacher_cookies.txt)
curl -s -c teacher_cookies.txt -X POST http://localhost:8000/api/v1/auth/teacher/register \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"testpass123","name":"A Teacher"}'

# Create a class (uses the teacher's session cookie) - the response includes the join code
curl -s -b teacher_cookies.txt -X POST http://localhost:8000/api/v1/auth/teacher/classes \
  -H "Content-Type: application/json" \
  -d '{"name":"My Class"}'
# => {"id":"...","name":"My Class","code":"ABC123"}

# Join as a student using that code (also logs the student in - cookies saved separately)
curl -s -c student_cookies.txt -X POST http://localhost:8000/api/v1/auth/student/join \
  -H "Content-Type: application/json" \
  -d '{"classCode":"ABC123","displayName":"A Student","pin":"1234"}'
```

From here, `student_cookies.txt` can drive the rest of the API as that student — e.g. `curl -s -b student_cookies.txt -X POST http://localhost:8000/api/v1/sessions -H "Content-Type: application/json" -d '{"chapterId":"linear-equations","mode":"practice","questionCount":3}'`.

Password/PIN requirements: teacher passwords go through `auth_service`'s normal validation (not just "non-empty" — see `test_auth.py` for the exact rules); student PINs are 4+ digits.

## 7. Running tests

**Backend** (from `backend/`, venv active):

```bash
python -m pytest
```

198 tests. One file per module under `backend/tests/`.

**Frontend** (from `frontend/`):

```bash
npm test              # vitest, watch mode
npx vitest run         # vitest, single run - what CI/verification should use
npx tsc -b              # type-check
npx oxlint               # lint
```

96 tests. Before calling anything done, this project's own convention is to run all four fresh, plus a live browser walkthrough for anything UI-observable — page-level behavior has no automated test coverage anywhere in this codebase, by established convention (see `ProductArchitecture.md` §9/`Session-Frontend-Implementation-Plan.md` §6.2).

## 8. Troubleshooting

**`python -m venv .venv` prints a Microsoft Store install prompt instead of creating a venv.** The Windows App Execution Alias for `python`/`python3` is shadowing your real install (Settings → Apps → Advanced app settings → App execution aliases). Use `py -m venv .venv` instead (the standard Python Launcher for Windows), or disable the alias.

**`npm install` fails with an `ERESOLVE`/peer-dependency error mentioning `react-router` or `@testing-library/react`.** Expected on a clean install — `@testing-library/react@^14` peer-depends on React 18, this project is on React 19. Use `npm install --legacy-peer-deps` (and the same flag for `npm ci` anywhere it's used, including in CI/deployment). Not something to "fix" by silently forcing a resolution; a real version mismatch worth revisiting if this dependency is ever upgraded on purpose.

**CORS errors in the browser console.** The backend's `ALLOWED_ORIGINS` (default `http://localhost:5173`) must include whatever origin the frontend is actually served from. If you've changed the frontend's dev port or are testing against a built/deployed frontend, update `.env`'s `ALLOWED_ORIGINS` to match and restart the backend.

**`401 Unauthorized` on `/dashboard` or any `/sessions/*` call immediately after what looked like a successful login.** Confirm the frontend is actually calling the backend with `credentials: 'include'` (every existing service already does this) and that `ALLOWED_ORIGINS`/cookie settings aren't mismatched (see above) — a session cookie silently rejected by the browser looks identical to "never logged in."

**Shadow Mode logs a connection error or times out on every answer submission.** Expected and harmless if no local Ollama server is running — Shadow Mode (ADR-002) is a background, out-of-band evaluator; a failure there never affects the actual API response (verified by this project's own adversarial tests). Either start Ollama locally (`ollama run qwen2.5:7b-instruct`, matching `SHADOW_MODEL_NAME`) or set `SHADOW_MODE_ENABLED=false` in `.env` to silence it entirely.

**`sqlite3.OperationalError: database is locked`.** Rare at this scale (single `threading.Lock()` per module already serializes writes within one process), but can happen if two backend processes are pointed at the same `runtime.db` at once (e.g., you started `uvicorn` twice). Stop the extra process.

**A page shows stale or missing data after a schema-affecting pull.** The SQLite tables use `CREATE TABLE IF NOT EXISTS` — they will *not* pick up a column added in a newer commit automatically. If pulling a change that alters `session_store.py`'s or `attempt_service.py`'s schema, delete `runtime.db` (see §5) and let it recreate; there is no migration tooling in this project by design (small scale, no need yet).

**Frontend build succeeds but a route 404s when reloaded directly (e.g. hitting `/dashboard` via a hard refresh against a built/served bundle, not `npm run dev`).** This is a single-page-app static-hosting gotcha, not a dev-server issue — `npm run dev` handles it for you, but a plain static file server won't. See `Deployment-Guide.md` §2's SPA-fallback note before deploying.

**Tests pass locally but a live walkthrough shows different behavior.** This has happened for real reasons in this project's history, not hypothetically — `BackgroundTasks` timing (Milestone B's own ordering bug) and page-transition races are both documented, real examples in `Development-Journal.md`. Trust a live walkthrough over a green suite for anything involving background tasks, timing, or page navigation.
