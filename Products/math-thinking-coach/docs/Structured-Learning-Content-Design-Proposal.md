# Structured Learning Content Foundation — Design Proposal

**Status:** **Slice A1 is implemented, tested, and formally CLOSED** (see §W for the closure record). Sections A–V are the original design/review record, kept as-is for history. §M's original single-shot Slice A1 was corrected mid-implementation into an explicitly migration-state-aware design (legacy vs. structured Topics coexist during A1/A2/A3) — see §W for what actually shipped. A2 and A3 are approved in shape only; neither is scheduled or started.
**Author:** Implementation agent (Claude), per `Phase-1-Handoff.md` §19 milestone selection.
**Scope:** §§A–V are the design record (unmodified after review). §W is the implementation closure record, added after Slice A1 shipped. No speculative AI/adaptive/A2/A3 documentation is included anywhere in this file.

---

## A. Current-state architectural assessment

The single most important finding: **the content authoring layer already contains almost the entire structure this milestone is asking us to design** — the Stage 10 export pipeline discards it on the way to runtime.

Evidence, from `docs/content-source/squares-and-cubes/canonical-topic.json`:

- `explanation.sections` is already an array of `{title, body}` — a de facto **Concept** list, one per named idea ("Square numbers and their properties", "Finding square roots", …).
- `workedExamples[]` already carries a `section` string and a `conceptRef` string (e.g. `"Prime-factorisation test for perfect squares (sc-raw-concept-1.1)"`) linking each worked example back to a section/concept — informally, by string-matching, not by id.
- `learningObjectives[]` is already grouped by `section`, and each objective is already phrased as a discrete, testable action statement — exactly what a "Skill" or "Learning Objective" needs to look like.
- `stage6-questions.json` questions already carry `objective: N` (an integer index into the chapter's flattened objective list), `bloomLevel`, `tags`, and (in several chapters — Data Handling shown above, also Understanding Quadrilaterals) a per-question `misconception: {commonWrongAnswer, why, remediationHint}` object.

Then `docs/content-pipeline/export/transform.js` (`transformTopic`, `transformQuestion`) — a deliberately strict whitelist transform with **no spread operator anywhere in the file**, so a canonical field not explicitly read there structurally cannot reach runtime — drops every one of these on the floor:

| Canonical field | Runtime fate |
|---|---|
| `explanation.sections[i].title` | **dropped**; only `.body` survives, joined into one string |
| `workedExamples[i].conceptRef` / `.section` | **dropped entirely** |
| `learningObjectives[i].section` (grouping) | **dropped**; flattened to `list[str]` |
| `questions[i].objective` | **dropped entirely** — no runtime field exists for it |
| `questions[i].bloomLevel`, `.tags`, `.misconception`, `.sourceRef` | **dropped entirely** |

This is exactly `Phase-1-Handoff.md` §13.4 (Topic section-title loss) — but it's one symptom of a broader pattern, not an isolated bug: the export pipeline currently has no runtime vocabulary for anything between "Topic" and "Question."

Other load-bearing findings:

- **`LearningExperienceArchitecture.md` §3 already defines the target vocabulary.** Its "Topic anatomy" table names: Concept explanation, Comprehension check, Worked examples, Question pool tagged by role, Hints, Mastery criterion, Common misconceptions (future, sourced from Shadow Mode). This document predates this milestone and should govern naming — we are not inventing terminology, we are implementing terminology that already exists in the product's own design doc.
- **Every mastery/progress/adaptivity signal in the runtime is keyed exclusively on `topicId`.** `attempt_service.get_performance()`, `learning_context_service.build_learning_context()`, and `session_planner.create_plan()` all operate at Topic granularity. Notably, `SessionPlan.weakConceptTopicIds` (`backend/app/schemas/session.py:62`) is *named* as if concept-level, but is actually just a list of weak topic ids — the field name already presages a granularity that doesn't exist yet.
- **The `attempts` SQLite table already has unused columns for this** — `misconception_tag` and `question_type` (`attempt_service.py:37-38`) are declared in the schema but never populated by `record_attempt_for_answer`. This is a second, independent signal (alongside the LXA doc) that finer-than-Topic granularity was anticipated architecturally before this milestone.
- **Shadow Mode has its own, separate `misconception_tags` concept** (`backend/app/schemas/ai_evaluation.py`), in an uncontrolled vocabulary, explicitly flagged by LXA §3 as "not yet controlled-vocabulary enough to use." This is a distinct, pre-existing signal from the content-source `misconception` field on questions — the two are not yet unified, and this design does not unify them (out of scope, §N).
- **`transform.js`'s whitelist discipline is a real architectural asset, not incidental strictness** — it is the reason "canonical metadata leak" and "unknown field in runtime JSON" are structurally impossible today. Any change here must preserve that property: every new field explicit, field-by-field, no spreads.
- **Referential validation is chapter/topic-anchored** (`referentialValidation.js`): a question bank's `topicId` must resolve either to a topic being exported in the same run or one already in `topics.json`. Practical Geometry has no Topic at all and uses a separate `run-topicless.js` because `loadCanonical()`'s `requireFields()` rejects `topicId: null`. Any new content structure must tolerate "no Topic" as a first-class case, not an edge case.
- **`pydanticValidate.js` shells out to the real backend venv and imports the actual Pydantic models** — there is no second, hand-maintained JS schema to keep in sync. This means the real cost of a schema change is in `backend/app/schemas/*.py` and `transform.js`, not in the validator itself.
- **`mergeAndWrite.js` is chapter-partitioned and atomic** — re-exporting one chapter cannot corrupt another, and re-exporting the same chapter twice is safe (self-exclusion from duplicate checks). This makes a chapter-by-chapter migration strategy cheap and reversible, not a special case to design around.
- **Frontend impact is narrow.** Only `TopicPage.tsx` reads `Topic.explanation` / `.workedExampleContent` / `.learningObjectives`. No session/practice/dashboard/performance code touches these fields. `TopicPage.tsx` currently contains regex-based reconstruction (`toParagraphs`, `toWorkedExamples`) purely to claw back structure the export pipeline threw away — this is fragile, self-documented as a workaround in its own comments, and would be *deleted*, not added to, by this design.

---

## B. Proposed Structured Learning Content model

Three deliberate decisions, each justified against the "avoid an over-engineered knowledge graph" constraint:

**1. Concept = a named section within a Topic's explanation.** Not a cross-topic, cross-chapter graph node. This matches exactly what `canonical-topic.json` already authors (`explanation.sections[i]`) — zero new authoring burden, only a schema/pipeline change to stop discarding what's already written.

**2. Skill and Learning Objective are collapsed into one entity: `LearningObjective`.** The authored content only ever produces one layer here — `learningObjectives[i].objectives[j]`, already phrased as discrete, testable, imperative statements ("Find the square root of a perfect square by prime factorisation."). Introducing a separate `Skill` entity on top of this would require inventing a distinction the content doesn't currently make and no consumer currently needs. `Skill` is named explicitly as deferred, future work (§N), revisited only if evidence shows a single objective is too coarse for adaptive practice.

**3. WorkedExample becomes a structured, Concept-linked entity**, replacing the joined-string `workedExampleContent`. This is already implicit in the canonical data's `section`/`conceptRef` string-matching — this design just makes the link an id instead of a matched string.

### Model shape

```
Chapter (unchanged)
 └─ Topic (existing identity: id, chapterId, title — unchanged)
     ├─ Concept[]           (NEW — one per authored section, ordered)
     │    └─ LearningObjective[]   (NEW — nested under its Concept)
     └─ WorkedExample[]     (NEW, structured — each tagged with a conceptId)

Question (existing identity: id, chapterId — unchanged)
 └─ objectiveIds: list[str] | None   (NEW, optional FK — many-to-many)
```

**Answering design question 5 directly:** yes, a question can assess multiple concepts/objectives. This is represented as `Question.objectiveIds: list[str]` — a plain list of ids, not a join table (no DB relational layer exists here; content is JSON, so a list-of-ids field *is* the many-to-many representation, consistent with how `Question.hints: list[str]` already works). A question's concept(s) are derivable transitively through its objectives' `conceptId` — no separate `conceptIds` field is needed on Question, avoiding a redundant, driftable second FK.

**Deliberately not modeled:** Comprehension checks (Understand stage), question pool role-tagging (guided/independent/homework/revision), mastery-per-objective, per-student anything. All named explicitly in LXA §3 as real future stages, all explicitly out of scope here (§N).

---

## C. Entity/relationship model

```
Topic 1───* Concept 1───* LearningObjective
Topic 1───* WorkedExample *───1 Concept
Question *───* LearningObjective   (via Question.objectiveIds)
Question *───1 Topic               (existing, via Question.topicId, unchanged)
```

- `Concept.id` is stable and authored once (slugified from title at authoring time), not recomputed from array position on each export — so a `WorkedExample.conceptId` or `LearningObjective.id` reference survives section reordering.
- `LearningObjective.id` likewise stable and authored, replacing the current fragile scheme (`objective: N`, a bare integer index into a flattened cross-section list — reordering or inserting an objective anywhere upstream of position N silently repoints every question that references N).

---

## D. Proposed source JSON/schema examples

### `canonical-topic.json` (additive changes only, shown against the real `squares-and-cubes` file)

```jsonc
{
  "id": "topic-squares-and-cubes-numbers-and-roots",
  "chapterId": "squares-and-cubes",
  "title": "A Square and A Cube: Numbers and Roots",
  "reviewStatus": "approved",
  "explanation": {
    "sections": [
      {
        "id": "concept-squares-properties",        // NEW — stable, authored
        "title": "Square numbers and their properties",
        "body": "A perfect square is any number you get by multiplying..."
      }
    ]
  },
  "workedExamples": [
    {
      "id": "sc-we-01",
      "conceptId": "concept-squares-properties",    // NEW — replaces "section" string match
      "problem": "Is 128 a perfect square? ...",
      "steps": ["..."],
      "finalAnswer": "No, 128 is not a perfect square..."
    }
  ],
  "learningObjectives": [
    {
      "conceptId": "concept-squares-properties",    // NEW — replaces "section" grouping key
      "objectives": [
        { "id": "obj-squares-unit-digit", "text": "Identify a perfect square and use the unit's-digit rule to rule out non-squares." }
      ]
    }
  ]
}
```

Everything not marked NEW is unchanged — this is additive to the existing shape, not a rewrite.

### `stage6-questions.json` (one field changed per question)

```jsonc
{
  "id": "sc-q03",
  "prompt": "True or False: a number ending in 3 can never be a perfect square.",
  "expectedAnswer": "True",
  "objectiveIds": ["obj-squares-unit-digit"],   // REPLACES the old "objective": 3 integer index
  "difficulty": "Easy"
}
```

`objectiveIds` is optional (`list[str] | None = None`) at the runtime schema level so back-filling can happen gradually, chapter by chapter, with zero migration urgency (see §I).

### Runtime `topics.json` (Pydantic `Topic`, after export)

```jsonc
{
  "id": "topic-squares-and-cubes-numbers-and-roots",
  "chapterId": "squares-and-cubes",
  "title": "A Square and A Cube: Numbers and Roots",
  "concepts": [
    {
      "id": "concept-squares-properties",
      "title": "Square numbers and their properties",
      "body": "A perfect square is any number you get by multiplying...",
      "learningObjectives": [
        { "id": "obj-squares-unit-digit", "text": "Identify a perfect square and use the unit's-digit rule to rule out non-squares." }
      ]
    }
  ],
  "workedExamples": [
    {
      "id": "sc-we-01",
      "conceptId": "concept-squares-properties",
      "problem": "Is 128 a perfect square? ...",
      "steps": ["Prime factorise 128: ...", "Group the factors in pairs: ...", "Since not every prime factor pairs up..."],
      "finalAnswer": "No, 128 is not a perfect square — its prime factorisation leaves one 2 unpaired."
    }
  ]
}
```

`explanation: str`, `workedExampleContent: str`, and `learningObjectives: list[str]` are **retained, unchanged, alongside the new fields, for the duration of Slice A1** — they are removed only in Slice A3, after the frontend has cut over (Slice A2) and every Topic-bearing chapter has migrated. See §K/§M for the full A1/A2/A3 rationale.

---

## E. Runtime schema impact

`backend/app/schemas/topic.py`:

```python
class LearningObjective(BaseModel):
    id: str
    text: str

class Concept(BaseModel):
    id: str
    title: str
    body: str
    learningObjectives: list[LearningObjective]

class WorkedExample(BaseModel):
    id: str
    conceptId: str
    problem: str
    steps: list[str]
    finalAnswer: str

class Topic(BaseModel):
    id: str
    chapterId: str
    title: str
    concepts: list[Concept]
    workedExamples: list[WorkedExample]
```

`backend/app/schemas/question.py`: one additive field.

```python
class Question(BaseModel):
    ...  # unchanged
    objectiveIds: list[str] | None = None
```

No other schema changes. `AnswerSubmission`, `AnswerEvaluationResponse`, `SessionPlan`, `StudentLearningContext`, `QuestionCandidate` — **all unchanged**. This is deliberate: this slice does not touch evaluation, coaching, or session planning at all.

**`Concept`/`WorkedExample`/`LearningObjective` are nested inside `Topic`, not a new top-level `concepts.json` file/service.** No current or near-term consumer needs to query concepts independently of their Topic (no "list all concepts across chapters" use case exists), so a fourth data file and fourth load-once service (`concept_service.py`) would be pure surface area with no behavior behind it yet. This is a genuine judgment call worth flagging for review — nesting is the recommendation, a standalone file is the documented alternative (§L).

---

## F. Content-pipeline impact

`docs/content-pipeline/export/transform.js` — `transformTopic` and `transformQuestion` rewritten to emit the structured shape field-by-field (whitelist discipline preserved, no spreads):

```js
function transformTopic(canonicalTopic) {
  const concepts = canonicalTopic.explanation.sections.map((section) => ({
    id: section.id,
    title: section.title,
    body: section.body,
    learningObjectives: findObjectiveGroup(canonicalTopic.learningObjectives, section.id)
      .objectives.map((o) => ({ id: o.id, text: o.text })),
  }));

  const workedExamples = canonicalTopic.workedExamples.map((we) => ({
    id: we.id,
    conceptId: we.conceptId,
    problem: we.problem,
    steps: we.steps,
    finalAnswer: we.finalAnswer,
  }));

  return { id: canonicalTopic.id, chapterId: canonicalTopic.chapterId, title: canonicalTopic.title, concepts, workedExamples };
}
```

`docs/content-pipeline/export/loadCanonical.js` — `requireFields` calls extended: each `explanation.sections[i]` now also requires `id`; each `workedExamples[i]` now requires `conceptId`; each `learningObjectives[i]` now requires `conceptId` and each nested objective requires `id`/`text`.

**New referential check** (new module, same phase-3 pattern as `referentialValidation.js`): every `workedExamples[i].conceptId` and `learningObjectives[i].conceptId` must resolve to a `section.id` within the same `canonical-topic.json`. Every `questions[i].objectiveIds[j]` (when present) must resolve to a real objective id inside the topic the question bank's `topicId` resolves to. Failures are loud, structural export errors — exactly the existing failure mode for a bad `topicId`, not a silent drop.

`pydanticValidate.js` and `mergeAndWrite.js` — **unchanged in mechanism.** They validate/merge whatever shape the Pydantic models declare; nested models need no special handling there.

Practical Geometry's `run-topicless.js` path is **unaffected** — it has no `canonical-topic.json` to begin with, so none of this applies to it.

---

## G. Frontend impact

`frontend/src/types/topic.ts`:

```ts
export interface LearningObjective { id: string; text: string; }
export interface Concept { id: string; title: string; body: string; learningObjectives: LearningObjective[]; }
export interface WorkedExample { id: string; conceptId: string; problem: string; steps: string[]; finalAnswer: string; }
export interface Topic { id: string; chapterId: string; title: string; concepts: Concept[]; workedExamples: WorkedExample[]; }
```

`frontend/src/pages/TopicPage.tsx`: **deletes** `toParagraphs()` and `toWorkedExamples()` entirely (the regex-based string reconstruction becomes unnecessary — the data arrives already structured) and renders `topic.concepts` directly, each as its own `<section>` with a real `<h2>{concept.title}</h2>` — this is the literal fix for §13.4, and it's a net simplification of the component, not an addition. Worked examples can optionally be grouped/rendered under their owning concept (nice-to-have; not required for DoD).

No other frontend file touches `Topic.explanation`/`.workedExampleContent`/`.learningObjectives` — confirmed via `ChapterPage.tsx` (only checks topic *existence* to decide routing, never reads content) and a repo-wide search for those field names.

---

## H. Learning Session Engine impact

**None, in this slice.** `content_repository.py`, `question_selector.py`, `session_planner.py`, `learning_context_service.py`, `attempt_service.py` — all unchanged. `Question.objectiveIds` is added to the schema but zero services read it.

This is intentional, not an oversight: the FK is laid down now so a *future*, separately-approved milestone — objective-level weak-spot detection, mastery-per-objective — can consume it without a second schema migration. Consuming it is explicitly not this milestone's job. Concretely, that future work would need one additive column on the `attempts` table (`objective_id TEXT`, nullable, mirroring the existing unused `misconception_tag`/`question_type` columns) — noted here as the natural next step, not designed further.

---

## I. Migration strategy for the existing 241 questions

Two independent migration tracks with very different urgency, because they have different blast radii:

**Track 1 — Topic restructuring (Concept/WorkedExample/LearningObjective).** Applies only to the 5 chapters that have a Topic at all: Linear Equations, Data Handling, Understanding Quadrilaterals, A Square and A Cube, Rational Numbers. (Practical Geometry has no Topic — untouched.) Each chapter's *canonical-source* migration must land **atomically per chapter**: a `canonical-topic.json` missing the new `id`/`conceptId` fields will fail the new structural validation loudly (not silently degrade), so a chapter cannot be half-migrated. Recommend piloting on **A Square and A Cube** first — newest, cleanest canonical data, smallest content-source file — then rolling to the other 4 in separate, independently-reviewable slices, using `mergeAndWrite.js`'s existing chapter-partitioning and re-export idempotency (already relied on by ADR-003) to make each chapter's migration a small, isolated, reversible PR. (Note: the *backend schema* itself is added once, additively, in Slice A1 — it is each chapter's *canonical-source content* that migrates chapter-by-chapter, on its own schedule; Slice A3's legacy-field removal is gated on all 5 chapters completing this migration, not on Slice A1 alone. See §K/§M.)

**Track 2 — `Question.objectiveIds` back-fill.** Fully optional and additive; nothing reads it yet (§H). Can be back-filled at any pace — one chapter, one question, or deferred indefinitely — with zero coordination cost, since the field defaults to `None`/absent and no validation requires it. **Not required for this slice's Definition of Done.**

Critically: **none of the 241 runtime `questions.json` entries are hand-migrated.** Runtime JSON is regenerated by re-running `node run.js --chapter=<slug>` against updated content-source; "migration" means editing `docs/content-source/<chapter>/canonical-topic.json` and `stage6-questions.json`, never hand-editing `backend/app/data/*.json` — exactly ADR-003's existing model.

---

## J. Validation/integrity rules

1. Every `Concept.id` unique within its Topic; authored once, frozen (not derived from array position each run).
2. Every `WorkedExample.conceptId` and `LearningObjective`-group `conceptId` must resolve to a `Concept.id` in the same canonical Topic — new phase-3 referential check, same error-collection pattern as existing chapter/topic validation (loud, aggregated `ExportValidationError`, not fail-fast-on-first-issue).
3. Every `Question.objectiveIds[i]` (when present) must resolve to a real `LearningObjective.id` inside the topic the question's chapter maps to.
4. `Topic.concepts` must be non-empty when a Topic exists at all (a Topic with zero concepts is a structural error, not a valid empty state — matches the existing "Topic implies real content" assumption).
5. Pydantic remains the single schema authority; no parallel hand-maintained JS validator is introduced (preserves the existing "shell out to the real venv" design from ADR-003).
6. `transform.js`'s whitelist invariant is preserved without exception — every new field explicitly named, no spread operator.

---

## K. Backward-compatibility strategy

This project has **no external API consumers** of the Topic shape — the only consumers are `TopicPage.tsx` (frontend) and the export pipeline itself (both inside this repo), and runtime `topics.json` is fully regenerated from canonical source on every export, never hand-edited. Given that, "backward compatibility" here means something narrower than API versioning: **don't leave the system in a half-migrated, silently-wrong state, and prefer independently revertible slices over one large coupled change.**

Concretely, an **additive-then-remove** sequence across three slices (approved; supersedes an earlier draft of this document that proposed one atomic cutover):
- **Slice A1** — `Topic` gains `.concepts`/`.workedExamples` **additively**; `.explanation`/`.workedExampleContent`/`.learningObjectives` are untouched and continue to be populated from the same canonical source. Backend/pipeline-only; the frontend is unaffected and keeps working exactly as today, off the still-populated legacy fields.
- **Slice A2** — `TopicPage.tsx` cuts over to the new structured fields; legacy-field rendering logic is deleted. Independently revertible from A1 without touching the backend.
- **Slice A3** — `.explanation`/`.workedExampleContent`/`.learningObjectives` are removed from the schema and the transform, once A2 is live-verified **and** every Topic-bearing chapter has completed its canonical migration (a single global schema change, so it cannot land while any chapter still depends on the old shape).
- `Question.objectiveIds` is **additive and non-breaking throughout**, defaulting to `None`, requiring no coordinated migration (§I Track 2).
- Because export is idempotent and chapter-partitioned (`mergeAndWrite.js`), a migration mistake in one chapter is fully reversible by re-running that chapter's export against corrected canonical content.
- No behavior change to evaluation, coaching, session planning, or the anonymous/authenticated question flows in any of A1/A2/A3 — confirmed by an empty diff on `evaluation_service.py`, `coaching_service.py`, `answer_service.py`, `session_planner.py`, `content_repository.py`, `question_selector.py`, `learning_context_service.py`, `attempt_service.py`.

This sequencing trades a small, bounded transitional cost (Slice A1's transform briefly emits both shapes) for slices that are independently testable, independently deployable, and independently revertible — consistent with `Phase-1-Handoff.md` §16's own standard of "small implementation slices, each independently testable."

---

## L. Risks and alternatives considered

| Alternative | Why not chosen |
|---|---|
| Full taxonomy: separate `Concept`, `Skill`, and `LearningObjective` entities | The authored content only ever produces two layers (section, objective-statement); no consumer needs a third. Would satisfy design question 15 ("smallest useful model") worse, not better. Deferred — revisit only with evidence that objective-level granularity is too coarse for adaptive practice. |
| Keep `Topic.explanation` as a flat string *permanently*; add concept metadata alongside it, never cutting the frontend over | Leaves the actual documented bug (§13.4) unfixed forever — rejected. (A *temporary, scheduled-for-removal* coexistence is a different thing and is exactly what Slice A1→A3 now does — see §K.) |
| Standalone `concepts.json` + `concept_service.py`, mirroring `topics.json`/`topic_service.py` | **Resolved by Product Architect review — nested under `Topic` is approved.** No further review needed; no cross-topic concept query exists to justify a standalone file. |
| Keep `objective: N` as an integer index rather than introducing stable `LearningObjective.id` | Already fragile today (reordering upstream objectives silently repoints every question referencing a higher index) — worth fixing regardless of this milestone, and required for `Question.objectiveIds` to be meaningful at all. |

**Named risk:** this is the first schema change to `Topic` since ADR-003 shipped it. Any other code that turns out to construct a `Topic` object directly (rather than through `topic_service`) would break silently at import time — a repo-wide grep for `Topic(` should be part of implementation, not assumed clean from this design pass alone.

---

## M. Recommended smallest implementation slice — Slice A1 / A2 / A3 (approved slicing)

The work is deliberately scoped to exactly one thing: **stop losing structure the content-source already has, and expose it to the Learn page** — no new runtime behavior, no new API routes, no touch to evaluation/coaching/session code. It closes a real, already-documented bug (§13.4) as a side effect of doing the design work correctly.

That work is split into three independently-testable, independently-revertible slices (§K):

- **Slice A1** (backend + pipeline only) — additive `Topic.concepts`/`.workedExamples`, structured `WorkedExample`/`LearningObjective`, stable IDs, `Question.objectiveIds`, structure-preserving export, new referential validation, A Square and A Cube pilot migration. Legacy `.explanation`/`.workedExampleContent`/`.learningObjectives` fields **retained, unchanged**. No frontend changes.
- **Slice A2** (frontend only) — `TopicPage.tsx`/`types/topic.ts` cut over to the new structured fields; legacy-field rendering deleted.
- **Slice A3** (cleanup) — legacy Topic fields removed from schema and transform, gated on A2 being live-verified and all Topic-bearing chapters being migrated.

**Only Slice A1 is in scope for implementation authorization at this stage.** A2 and A3 are approved in shape, not yet in schedule — each still needs its own explicit go-ahead once its predecessor is live-verified (§U).

---

## N. Explicitly out of scope for this milestone

- `Skill` as an entity distinct from `LearningObjective`.
- Comprehension-check / Understand stage (LXA §4) — separate journey stage, separate milestone.
- Question pool role-tagging (guided / independent / homework / revision) — named in LXA §3 as a real, distinct gap; a parallel `Question` field, not something concept/objective modeling resolves.
- Any mastery-criterion change, objective-level or otherwise.
- Any adaptive selection / weak-spot logic beyond what already exists (topic-level, unchanged).
- Unifying content-source's per-question `misconception` field with Shadow Mode's `misconception_tags` — two independent, uncontrolled vocabularies today; unification is real future work, not this slice's.
- Any LLM/AI evaluation work.
- Practical Geometry's topic-less export path — untouched.
- Backfilling `Question.objectiveIds` for all 241 questions — optional, gradual, explicitly not required for Definition of Done.
- Any change to `evaluation_service`, `coaching_service`, `answer_service`, or either practice-flow's frontend.

---

## O. Recommended milestone/slice breakdown

1. **This milestone — Slices A1 (backend/pipeline), A2 (frontend cutover), A3 (legacy cleanup)** — Concept/WorkedExample/LearningObjective structuring on Topic; `Question.objectiveIds` FK added but unused; TopicPage eventually renders real section headings. (Closes §13.4.) See §M.
2. *(Future, separate approval)* Question pool role-tagging (guided/independent/homework/revision) per LXA §3.
3. *(Future)* Objective-level attempt tracking (`attempts.objective_id`) + objective-level weak-spot detection in `learning_context_service`, consuming `objectiveIds` laid down in Slice A1.
4. *(Future)* Mastery-criterion refinement per objective; Understand-stage comprehension checks.
5. *(Future, evidence-gated)* `Skill` entity, only if objective-granularity proves too coarse; unified misconception vocabulary across content-source and Shadow Mode.

No slice after A1 is designed here — each needs its own design/review/approval pass per the project's established workflow. For the longer-term milestones beyond this document's scope entirely, see §V (Product Roadmap).

---

## P. Definition of Done for the first slice (Slice A1 only)

- [ ] `backend/app/schemas/topic.py`: `Concept`, `WorkedExample`, `LearningObjective` models added; `Topic` gains `.concepts`/`.workedExamples` **additively** — `.explanation`/`.workedExampleContent`/`.learningObjectives` remain, unchanged, still populated.
- [ ] `backend/app/schemas/question.py`: `objectiveIds: list[str] | None = None` added.
- [ ] `transform.js` emits **both** the legacy joined shape and the new structured shape, field-by-field; whitelist-only discipline preserved (no spreads).
- [ ] `loadCanonical.js` validates new canonical fields (`section.id`, `workedExamples[].conceptId`, `learningObjectives[].conceptId`, nested objective `id`/`text`).
- [ ] New referential check: concept ids resolve within their topic; question `objectiveIds` (if present) resolve to real objectives; failures are loud, aggregated `ExportValidationError`s, not silent drops.
- [ ] The pilot chapter's (`squares-and-cubes`) `canonical-topic.json`/`stage6-questions.json` migrated with stable concept/objective ids (one-time, human-reviewed bootstrap step outside the live pipeline — §I); re-exported via Stage 10; `topics.json`/`questions.json` diffed and sanity-checked, confirming **both** legacy and new fields present and correct.
- [ ] Backend pytest: `test_topics.py` (and any other Topic-shape-dependent tests) updated for the additive fields; full suite green.
- [ ] Confirmed empty diff on `evaluation_service.py`, `coaching_service.py`, `answer_service.py`, `session_planner.py`, `content_repository.py`, `question_selector.py`, `learning_context_service.py`, `attempt_service.py`.
- [ ] **No frontend file touched in this slice** — `TopicPage.tsx`/`types/topic.ts` migration is Slice A2's Definition of Done, defined when A2 is authorized, not A1's.

---

## Q. Architectural North Star — future product direction (acknowledged, not implemented)

*Addendum, added per Product Architect directive. This section records long-term product direction so future design work has a fixed reference point — it does not authorize, schedule, or expand any current implementation.*

Math Thinking Coach is intended to evolve into an **AI Learning Companion**: a system that helps a student learn mathematical thinking according to their own capability, understanding, and pace — not a static question bank. The future architecture is expected to support, eventually, across separate future milestones:

1. **Multiple question/response types** — single-choice, multiple-choice, true/false, fill-in-the-blank, numeric, symbolic/algebraic, matching, ordered-step, multi-part, open reasoning/explanation, and future specialized formats (diagram/geometry).
2. **Varied marking/evaluation** — full correctness, partial correctness, multi-part scoring, reasoning-aware assessment, complexity-dependent marking, mathematically-equivalent-response recognition.
3. **Adaptive learning** — capability, pace, difficulty progression, hint usage, retries, misconceptions, concept-level progress, personalized practice/revision.
4. **AI Learning Companion capabilities** — adaptive explanation, coaching, reasoning feedback, personalized question selection, learning-path adaptation, future AI-assisted evaluation.
5. **Curriculum expansion** — beyond Class 8, potentially multiple grades/classes, potentially multiple subjects.
6. **Teacher-provided content** — worksheet/document upload, future PDF/DOCX/image extraction, AI-assisted extraction of concepts/explanations/questions/answers/marking information, teacher review/approval, approved content entering the canonical pipeline, student prep/tests generated from it.

**None of this is designed, scheduled, or implemented by this document or by Slice A1.** It is recorded here so Slice A1's naming and shape (Concept, LearningObjective, WorkedExample, `objectiveIds`) can be checked against it for "does this foreclose anything" — and, per §A–§L, it doesn't: the model is deliberately the smallest useful structure for *today's* problem (§13.4 and the content-source/runtime gap), not a scaffold built in anticipation of items 1–6.

---

## R. Canonical Content Authority Guardrail (architectural principle)

**Principle:** Canonical structured content is the authoritative educational representation. Runtime JSON is a validated projection of canonical content, never a second source of truth. Any future content source — AI-generated, teacher-uploaded, or otherwise external — must enter through the same canonical layer and the same approval gate that hand-authored content already goes through today. **No future content source may write to runtime data directly, and none may bypass human/teacher approval where approval is required.**

Future conceptual flow (not implemented, no code changes implied):

```
External / manual / AI content
        │
        ▼
Candidate canonical content
        │
        ▼
     Validation
        │
        ▼
Human / teacher approval (where appropriate)
        │
        ▼
Canonical structured content
        │
        ▼
    Validated export
        │
        ▼
Runtime learning experience
```

This is not a new invention — it is the **existing** `docs/content-source/` → `reviewStatus` → `approvalGate.js` → Stage 10 export → runtime pipeline (ADR-003), generalized to name it as a permanent architectural boundary rather than a one-time implementation detail. A future teacher-upload or AI-extraction milestone is a new *arrow into the top* of this diagram (a new candidate-content producer), not a new path around the approval gate or the whitelist transform. §F's whitelist-transform discipline (`transform.js`'s "no spread operator anywhere," every runtime field named explicitly) is exactly the mechanism that makes this guardrail enforceable in code, today, for the content this milestone touches — that mechanism is why this principle is credible as a stated commitment rather than aspirational.

Slice A1 does nothing to build toward AI/teacher content ingestion. This section states the boundary that *any future work in that direction* must respect.

---

## S. Future milestone: Question & Response Semantics (not this milestone)

**Answer Evaluation v2 (`Phase-1-Handoff.md` §13.5) should not be scoped as "better exact-string matching."** The real gap is that the system has no model of *question and response semantics* at all — `evaluation_service.evaluate()` does a single string comparison regardless of what kind of question or answer is involved. A future milestone should instead establish, as its own design:

- **question type** (per §Q.1's list — single-choice, multi-part, open reasoning, etc.)
- **response type** (what shape an answer takes, independent of question type)
- **expected representation** (how a correct answer is canonically expressed)
- **acceptable equivalent responses** (e.g. mathematically equivalent forms, unit variants)
- **marking model** (how correctness is determined per question type)
- **partial credit** (where applicable)
- **multi-part structure** (a question with several gradable sub-answers)
- **reasoning expectations** (for open-response/explanation questions)

**This is explicitly a future milestone (§V, item 2) and is NOT part of the Structured Learning Content Foundation.** Nothing in Slices A1/A2/A3 designs, schedules, or scaffolds it.

**`Question.objectiveIds`, introduced in Slice A1, is only a stable relationship between a question and the learning objective(s) it assesses.** It answers "which objective(s) does this question target," nothing more. It does not implement, imply, or presuppose: question-type modeling, response-type modeling, evaluation semantics, marking models, partial credit, adaptive selection, or AI evaluation. A future Question & Response Semantics milestone may well add its own fields to `Question` (e.g. `questionType`, `responseSchema`) — those are independent of, and not designed by, `objectiveIds`.

---

## T. AI readiness (reaffirmed, scoped)

Structured `Concept`/`LearningObjective`/`WorkedExample` records and the stable `Question.objectiveIds` relationship are **foundational data structures** for future AI learning capabilities — addressable, stable-id-referenced content units instead of opaque joined strings and a fragile integer index (§A). That is the entirety of this milestone's contribution to "AI readiness": a data-structure property, not a capability.

**This milestone introduces:**
- no LLM
- no RAG
- no embeddings
- no vector database
- no AI evaluator
- no adaptive engine
- no mastery engine

**No speculative schema field is added merely because a future AI capability might want it.** Every field in §E exists because it fixes a concrete, present-tense problem already documented in §A (structure the content-source has and the runtime discards) — not because of a hypothetical future consumer. If a future milestone (§V) needs additional structure, it gets its own design/review/approval pass then, against real requirements at that time — not spec'd speculatively now.

---

## U. Scope protection — Slice A1 boundary (reaffirmed)

Per §M/§K, **Slice A1 is limited to exactly:**

- Additive backend `Topic` schema (`.concepts`/`.workedExamples` added; nothing removed).
- Structured `Concept` / `LearningObjective` / `WorkedExample` representation.
- Stable IDs (authored, not title-derived at runtime — §F/§I).
- The `Question.objectiveIds` relationship (optional, unused by any service).
- Structure-preserving export (`transform.js` whitelist, both shapes emitted).
- Referential validation (concept/objective/worked-example FK resolution, export-time hard failure on violation).
- The **A Square and A Cube** pilot chapter migration.
- **Existing legacy fields (`.explanation`/`.workedExampleContent`/`.learningObjectives`) retained, unchanged, during the transition.**
- **No frontend changes.**

**Slice A2** remains frontend migration only (`TopicPage.tsx`/`types/topic.ts` cutover, legacy rendering logic deleted). **Slice A3** remains legacy-field removal only, gated on A2 being live-verified and all Topic-bearing chapters being migrated.

**§Q–§T's broader product vision does not expand Slice A1.** Nothing in the AI Learning Companion direction, the canonical-content guardrail, the future Question & Response Semantics milestone, or the AI-readiness statement adds a field, a service, an endpoint, or a behavior to A1. Their only effect on A1 is naming discipline (§B's "Concept"/"LearningObjective" already match LXA §3's vocabulary, and now also match this addendum's) and confirmation that A1's structure doesn't foreclose anything listed in §Q — not new implementation surface.

---

## V. Product roadmap note (future milestones, not commitments)

For reference only — none of the following is designed, scheduled, or committed by this document beyond item 1:

1. **Structured Learning Content Foundation** — current milestone (this document; Slices A1/A2/A3).
2. **Question & Response Semantics** — §S.
3. **Adaptive Learning Foundation** — capability/pace/difficulty/hint/retry/misconception/concept-level progress tracking, personalized practice/revision (§Q.3).
4. **AI-assisted Coaching / Learning Companion** — adaptive explanation, coaching, reasoning feedback, personalized selection, learning-path adaptation, AI-assisted evaluation (§Q.4).
5. **Teacher Content Intelligence** — upload, AI-assisted extraction, teacher review/approval, entry into the canonical pipeline per §R (§Q.6).

Each future milestone requires its own design → review → approval pass, per this project's established workflow (`Phase-1-Handoff.md` §16), when its turn comes.

---

## W. Slice A1 implementation closure (formal record)

**Status: Slice A1 is implemented, tested, reviewed, and formally closed.** This section is the closure record referenced by the top-of-document status line — §§A–V above are the design record as reviewed and approved, unmodified after the fact.

### W.1 Structured Topic model delivered

`backend/app/schemas/topic.py` gained three new nested Pydantic models, exactly as designed in §B/§E:

- **`LearningObjective`** — `{id, text}`.
- **`Concept`** — `{id, title, body, learningObjectives: list[LearningObjective]}`, one per authored explanation section.
- **`WorkedExample`** — `{id, conceptId, problem, steps, finalAnswer}`.

`Topic` gained `.concepts: list[Concept]` and `.workedExamples: list[WorkedExample]`, both `Field(default_factory=list)` — **additive**, alongside the untouched legacy `.explanation`/`.workedExampleContent`/`.learningObjectives` string fields. `backend/app/schemas/question.py` gained one additive field: `objectiveIds: list[str] | None = None` — a stable, optional many-to-many relationship from a Question to the LearningObjective(s) it assesses. Per §S, this is *only* that relationship — it implements no question-type, response-type, or evaluation semantics.

### W.2 Stable-ID policy

IDs (`concept-*`, `obj-*`) are **authored, frozen content**, never computed by the live pipeline. For the pilot chapter, ids were derived once — mechanically slugified from the pre-migration section titles/objective text, then reviewed before being written into `canonical-topic.json` as real authored content (documented in that file's own `structureMigrationNote`). `transform.js` and `loadCanonical.js` only ever *read and validate* these ids; no code path in the ongoing export pipeline regenerates or derives an id from a title. Changing a `Concept.title` or a `LearningObjective.text` after migration does not and cannot change its `id`; reordering sections/objectives does not change ids. No standalone bootstrap script was left in the repository — the one-time derivation was a direct, reviewed content edit, not a mechanism that could ever run automatically.

### W.3 `objective:N` → `objectiveIds` migration policy

The legacy integer `objective` field (an index into a chapter's pre-migration flattened cross-section objective list) is **replaced, not deprecated-in-place**, on a per-chapter basis, at the moment that chapter's canonical Topic is migrated. For the pilot: every one of the 40 questions' `objective: N` was mechanically mapped to the corresponding new `objectiveIds: ["..."]` entry (full N→id table recorded in `stage6-questions.json`'s `objectiveMigrationNote`), preserving the original semantic relationship exactly — no mapping was guessed. **A migrated chapter's canonical questions may not retain the legacy `objective` field** — enforced as an export-time structural error, not a lint warning. `objectiveIds` itself remains optional at the runtime schema level (`None` by default) so it can be back-filled gradually for any future chapter and needs no value at all for chapters (like Practical Geometry) with no Topic/objective structure to reference.

### W.4 Transitional legacy-vs-structured export behavior (the corrective slice)

The first implementation pass made structured-id requirements global, which would have blocked re-exporting the four not-yet-migrated Topic-bearing chapters (Linear Equations, Data Handling, Understanding Quadrilaterals, Rational Numbers) until they were migrated — violating the approved chapter-by-chapter strategy. This was corrected before closure:

- **`docs/content-pipeline/export/topicMigrationState.js`** is the single, shared discriminator: a Topic is `'structured'` only if its sections (via `id`), worked examples (via `conceptId`), and learning-objective groups (via `conceptId`) *all* carry the new fields; `'legacy'` only if *none* do. Any mix — within one array or across the three — is reported as an explicit structural error naming the inconsistency, never silently guessed at.
- **`loadCanonical.js`** validates a `'legacy'` Topic against exactly its original pre-A1 shape (no ids required, `objective: N` untouched) and a `'structured'` Topic against the full Slice A1 shape.
- **`conceptReferentialValidation.js`** applies referential checks (concept/objective FK resolution, legacy-field rejection) only to `'structured'` Topics; a `'legacy'` Topic receives no structured checks and explicitly permits `objective: N`.
- **`transform.js`** dispatches to `transformLegacyTopic` (reproduces the exact pre-A1 output, `concepts`/`workedExamples` empty) or `transformStructuredTopic` (the full A1 output) based on the same detector.

This transitional dual-mode behavior is scaffolding for the migration window, not a permanent feature: **it exists solely so chapters can migrate one at a time, and is expected to be deleted in Slice A3** once every Topic-bearing chapter has migrated and the legacy shape/fields are removed from the schema and pipeline entirely. It is not a long-term architectural fixture.

### W.5 Referential validation rules (final)

For a `'structured'` Topic only:
1. Every `WorkedExample.conceptId` and every objective-group's `conceptId` must resolve to a `Concept.id` in the same Topic.
2. Every `Question.objectiveIds[i]` (when present) must resolve to a real `LearningObjective.id` in the topic its chapter maps to.
3. No question in a migrated chapter may carry the legacy `objective` field.

All three are export-time hard failures (aggregated `ExportValidationError`), never a runtime fallback — a dangling reference cannot reach `backend/app/data/*.json`. A `'legacy'` Topic receives none of these checks. Practical Geometry (no Topic at all) is untouched by any of this, unchanged from before A1.

### W.6 A Square and A Cube pilot migration — final state

Confirmed in the live runtime data at closure: 4 concepts, 4 worked examples, 11 learning objectives, 40 questions all carrying exactly one `objectiveIds` entry and zero legacy `objective` fields. Legacy `.explanation`/`.workedExampleContent`/`.learningObjectives` remain populated and byte-identical in content to their pre-migration values. The other 4 Topic-bearing chapters are confirmed untouched (`concepts`/`workedExamples` empty, `objective: N` intact, fully re-exportable); Practical Geometry is confirmed untouched (no Topic).

### W.7 A2/A3 status

**A2 implemented and closed (2026-08-19).** `TopicPage.tsx`/`types/topic.ts` now render the structured `concepts`/`workedExamples` fields for any migrated chapter (A Square and A Cube, A1's sole pilot), with the pre-A1 legacy rendering kept as an explicit fallback for the 4 not-yet-migrated Topic-bearing chapters — a deliberate, confirmed deviation from this section's original "legacy-field rendering logic is deleted" wording (written before A1 had shipped and the migration-window reality was fully concrete). See `Development-Journal.md`'s 2026-08-19 (A2) entry for the full record. **A3 not started**, still gated on A2 being live-verified (done) **and** every Topic-bearing chapter completing its migration (A2b, not authorized).
