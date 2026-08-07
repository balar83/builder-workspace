# ADR-003: Content Authoring and Export Pipeline

**Status:** Accepted
**Date:** 2026-07-27 (Features 018–021, Linear Equations end-to-end migration)

---

## Problem

`LearningExperienceArchitecture.md` defined the `Topic` model and the Learn/Worked-Examples stages, but nothing existed to actually produce a `Topic`, safely add it to `backend/app/data/topics.json`, or grow a chapter's question bank at the volume those stages need (the original 5 seed questions per chapter, hand-written directly into `questions.json`, don't scale to real content depth). Two problems needed solving together: how new questions get authored — by hand and/or generated — at volume without duplicating existing ones or drifting from the runtime `Question`/`Topic` Pydantic schemas; and how reviewed, approved content gets from a human-editable authoring area into the live runtime data files without a manual, error-prone JSON edit that risks corrupting chapters nobody touched in that pass.

---

## Options Considered

**Where content is authored**
1. Directly in `backend/app/data/*.json` — no separate authoring area.
2. A separate `docs/content-source/<chapter>/` staging area, human/AI-authored and reviewed there, with an explicit review-status gate before anything reaches runtime data.

**How question volume is produced**
1. Hand-author every question individually.
2. A template-based procedural generator: a template describes a parametrized problem family; a seeded RNG produces candidate parameter sets; each candidate is independently validated and solved, not just pattern-filled.

**How approved content reaches runtime data**
1. Manual copy-paste/edit of the target JSON files.
2. A scripted merge that overwrites the whole file per chapter.
3. A scripted, multi-phase export pipeline: approval gate → referential/duplicate validation → whitelist transform → schema validation → merge-by-chapter-partition atomic write → post-write re-validation.

**How schema validity is checked before/after writing runtime data**
1. Reimplement the `Question`/`Topic` shape as a JS validator, kept in sync by hand.
2. Shell out to the real backend Python venv and run the actual Pydantic models.

---

## Decision

**Authoring — Option 2.** `docs/content-source/<chapter>/` holds a per-chapter authoring trail: stage2 (topic detection) → stage3 (concept extraction) → stage4 (learning objectives) → stage5 (worked examples) → stage6 (questions, hand-authored and/or generated), plus a `canonical-topic.json` that consolidates stages 2–5 into one candidate `Topic` record. Every file that can reach runtime data carries a `reviewStatus` field; only `"approved"` is eligible for export (`docs/content-pipeline/export/approvalGate.js`) — `"ai-generated"` (the default for anything freshly authored or generated) is not, with no partial credit. A question's own `reviewStatus`, if set, overrides its file's; hand-authored files only ever set the file-level status, template-generated batches set both.

**Generation — Option 2 ("Template Engine v1", `docs/content-pipeline/template-engine/`).** A template JSON (`templates/<name>.json`) describes a parametrized problem family. `generator.js` produces candidate parameter sets from a seeded RNG (`prng.js` — the seed is always recorded, explicit or generated, so a batch is reproducible). Each candidate is independently solved and constraint-checked by `validator.js` (not templated text substitution passed through unchecked), deduplicated against both the existing question bank and the current batch by `duplicateDetector.js` (exact-id and normalized-prompt-text matching — the same Level-1 strategy the export pipeline's `duplicateCheck.js` reuses rather than re-deriving), formatted into the canonical authoring shape by `canonicalFormatter.js`, and written with generation metadata (template id/version, seed) by `batchExporter.js`. `run.js` is thin CLI glue with no business logic beyond a retry-until-count loop, since not every candidate survives validation/dedup.

**Export — Option 3 ("Stage 10 Export Pipeline", `docs/content-pipeline/export/`), invoked as `node run.js --chapter=<slug> [--dry-run]`.** Seven phases: [1] load canonical content for the chapter, [2] approval gate, [3] referential validation (topic/question `chapterId` resolves against `chapters.json`; a question bank's `topicId` must resolve to a topic being exported in the same run or one already in runtime `topics.json`) plus duplicate detection, [4] whitelist transformation from the authoring shape to the exact runtime `Question`/`Topic` shape, [5] real Pydantic validation, [6] merge-by-chapter-partition atomic write, [7] post-write re-validation (re-read from disk, re-validate against Pydantic again; a failure here aborts and reports rather than leaving a silently-corrupt file). A discovered-mid-build addition to phase [3]: an approved question cannot export without a matching, approved `answer_keys.json` entry, because `evaluation_service` reads expected answers from that private file, never from `Question.solution` (ADR-001) — the first export attempt shipped 44 Linear Equations questions that all 500'd on submission until this co-requisite check and the corresponding `answer_keys.json` entries were added.

**Merge safety — Option 3, "merge-by-chapter-partition," not whole-file overwrite (`mergeAndWrite.js`).** Existing runtime entries whose `chapterId` isn't touched by this run are preserved byte-for-byte; only the touched chapter's entries are replaced, then the combined list is sorted by `id` and written via write-to-`.tmp`-then-rename (atomic on the same filesystem). Topic and Question partitions are resolved and touched independently — a run exporting a chapter's Topic with zero approved Questions must not cause the Question merge to treat that `chapterId` as touched and wipe out a previous run's questions with nothing to replace them. This is also what keeps `rational-numbers`' hand-seeded Topic (no canonical source, no `reviewStatus` at all — predates this pipeline) safe from an unrelated chapter's export.

**Schema validation — Option 2 (`pydanticValidate.js`).** Shells out (`child_process.spawnSync`) to `backend/.venv/Scripts/python.exe` running `validate_runtime.py`, which imports the real `app.schemas.*` Pydantic models and validates the proposed payload before writing, and the actual on-disk result again after writing. No JS reimplementation of the schema exists anywhere in the pipeline — if a Pydantic model changes, this step's behavior changes with it automatically, with no second copy to keep in sync.

---

## Trade-offs

**Pros**
- Nothing reaches `backend/app/data/*.json` without passing through the same Pydantic models the FastAPI app itself uses — the pipeline cannot drift into accepting a shape the backend would reject.
- Chapter-partitioned atomic merge means an export for one chapter is provably incapable of corrupting or silently dropping another chapter's data, including hand-seeded data with no authoring trail (`rational-numbers`).
- Every generated question is independently solved and verified, not templated-text-with-numbers-swapped-in — `archive/stage6-expansion-coverage-report.md`'s self-review (duplicate check, difficulty/Bloom-level balance, misconception coverage) was possible only because generation produces real, checkable structure, not just prose.
- Fully reversible/re-runnable: re-exporting unchanged canonical content doesn't flag itself as a duplicate collision (the touched chapter is excluded from its own duplicate comparison), so authors can iterate and re-run without special-casing "first export vs. re-export."
- Zero new runtime dependencies — no npm package.json anywhere under `docs/content-pipeline/`, only Node built-ins (`fs`, `path`, `child_process`).

**Cons**
- The export pipeline has a hard runtime coupling to `backend/.venv/Scripts/python.exe` existing at a fixed relative path — it cannot validate or export at all without a provisioned backend venv, on the same machine, in the expected location. Acceptable today (pipeline and backend are developed together, same machine); would need addressing if content authoring/export is ever run somewhere the backend venv isn't present (e.g. a CI-only content job).
- No automated test suite exists for either `template-engine/` or `export/` themselves — correctness is enforced operationally, at run time, by the pipeline's own gates (approval, referential, duplicate, Pydantic) rather than by a unit-test suite for the pipeline code. This is a real gap against this project's own testing convention (every other production module has a matching test file) and should be named explicitly, not silently accepted as equivalent.
- Two authoring-shape vs. runtime-shape schemas now exist in parallel (canonical content in `docs/content-source/`, runtime content in `backend/app/data/`), maintained by the whitelist transform (`transform.js`) rather than a single shared schema — a deliberate simplicity choice (Option 2 for schema validation reuses the runtime Pydantic models only for the *output* check, not for authoring-side structure), but it means a canonical-shape field typo wouldn't be caught until phase [5], not at authoring time.
- Content-pipeline code lives under `docs/`, not `backend/` or a new top-level folder — chosen to avoid a top-level folder addition without approval (`AI_Coding_Standards.md` §1), but it means genuinely operational tooling (a CLI that writes to `backend/app/data/`) sits in a directory whose name signals "documentation," which could mislead a future contributor scanning the repo structure.

---

## Future Evolution

If content authoring/export ever needs to run somewhere the backend venv isn't co-located (a CI job, a separate content-ops environment), the Python-venv coupling in `pydanticValidate.js` becomes a real blocker and should be resolved with its own decision then, not preemptively now. If pipeline defects start recurring, a test suite for `template-engine/`/`export/` should be added — not designed speculatively here, but named as the known gap to close first. Whether `docs/content-pipeline/` should move to a proper top-level location (e.g. `content-pipeline/` or `tools/content-pipeline/`) is an open, not-yet-decided question — see `ProductArchitecture.md`'s folder structure section; raise it for approval before moving anything, per `AI_Coding_Standards.md` §1.

---

## Impact

**Frontend** — New: `TopicPage.tsx`/`.css`, `types/topic.ts`, `questionService.getTopics`/`getTopic`. Modified: `ChapterPage.tsx` (fetches topics alongside chapter/questions, routes to Topic when one exists), `App.tsx` (new `/topic/:topicId` route).

**Backend** — New: `app/schemas/topic.py`, `app/services/topic_service.py`, `app/api/routes/topics.py`, `backend/app/data/topics.json`. Modified: `app/schemas/question.py` (`topicId: str | None`), `app/api/router.py` (mounts the topics router), `backend/app/data/{questions,answer_keys}.json` (Linear Equations chapter re-exported: 5 → 44 questions, all with `topicId`; matching `answer_keys.json` entries added).

**Tooling** — New: `docs/content-pipeline/template-engine/*`, `docs/content-pipeline/export/*`, `docs/content-source/{linear-equations,data-handling}/*`. Not imported by `app/*` or `frontend/src/*` — pure authoring/build-time tooling, no production runtime dependency on it.

**API** — Additive only. `GET /api/v1/chapters/{chapterId}/topics`, `GET /api/v1/topics/{topicId}`, both new. No existing endpoint's contract changed.

**Tests** — Backend 65/65 passing (60 → 65; +5 for `test_topics.py`). Frontend 40/40 passing (36 → 40; +4, TopicPage's data path exercised via `questionService`/component tests — no page-level test, consistent with this project's established no-page-tests convention). No test suite exists for the pipeline tooling itself (see Trade-offs).

**Content** — Linear Equations: 44 questions live (up from the original 5), 1 Topic live. Data Handling: authored through stage 6 (42 questions, coverage-reviewed) but **not exported** — still the original 5 seed questions in runtime, pending review before its own Stage 10 run. Practical Geometry, Understanding Quadrilaterals, and Rational Numbers' question bank are untouched by this pipeline; Rational Numbers' single Topic predates it (hand-seeded, used to build and test the Topics API before Linear Equations' full pipeline existed).

---

## Related Documents

- [`ADR-001-evaluation-coaching-separation.md`](ADR-001-evaluation-coaching-separation.md) — the reason the export pipeline's answer-keys co-requisite check exists at all.
- `Products/math-thinking-coach/docs/LearningExperienceArchitecture.md` §3, §6 — the `Topic` model and per-Topic authoring brief this pipeline exists to fulfill.
- `Products/math-thinking-coach/docs/archive/stage6-expansion-coverage-report.md` (archived 2026-08-07, moved from `docs/content-source/`) — the content-quality self-review this pipeline's generated/authored output was checked against.
- `Products/math-thinking-coach/docs/Development-Journal.md` (2026-07-27 entries, Features 018–021) — the implementation record.
