# Learning Experience Architecture (LXA) — Math Thinking Coach

The educational counterpart to [`ProductArchitecture.md`](ProductArchitecture.md). That document governs how the system is built; this one governs how a learner learns. Every new feature should be placed here first — which stage does it belong to, what does it add — before any technical design work starts on it.

**Updated 2026-09-02** (Product Strategy Reset — see [`Product-Vision.md`](Product-Vision.md)): §2 is rewritten around the new North Star journey. The prior 8-stage journey (Learn → Understand → Worked Examples → Guided Practice → Independent Practice → Homework Practice → Revision → Mastery) is not discarded — it's mapped into the new stages in §2a, since most of it is already shipped and the new journey needs to account for real, working features, not replace them with unbuilt ones.

---

## 1. Pedagogical Foundation

Three principles govern every stage below. Any future feature that violates one of these needs a real conversation before it's built, not just a slot in the roadmap.

**Gradual release of responsibility.** The journey is a march from "the app does the thinking" to "the learner does the thinking," in explicit steps — not a jump from zero to a cold question. This is the actual content of "teach before you test," given its proper name: *I do → We do → You do*.

**Formative by default; summative only by explicit choice.** Nothing in the default coaching loop (Understand/Practise stages below) produces a grade — `isCorrect`/`score` are never surfaced as a score there, only as coaching input. This is unchanged by the 2026-09-02 reset. What *is* new: Test/Assessment is now a legitimate, first-class stage in the same journey (see §2), not an exception bolted onto a coaching-only product. A learner (or a teacher/parent on their behalf) can deliberately step into it. The rule is about *default state*, not about assessment being forbidden — see `Product-Vision.md`'s "Assessment Is Not Inherently Teacher-Only."

**Mastery-based, not completion-based, progression.** A Topic is "done" when a progress criterion is met, not when a fixed count of questions has been answered. Today that criterion is a single deterministic Mastery rule (§3); the target state distinguishes Mastery/Fluency/Transfer/Readiness as related but different signals — see `Product-Vision.md`'s "Mastery, Fluency, Transfer, and Readiness." Not implemented; documented so today's simple rule doesn't get hard-coded somewhere that makes adding the other three awkward later.

---

## 2. The North Star Learner Journey

**Understand → Practise → Diagnose → Fix → Review → Reattempt → Test → Measure → Recommend → Improve**

This is the target journey a learner should experience as one coherent whole — not a switch between disconnected modes. **Current implementation covers only part of this** (see §2a for exactly which parts, and under which old names they shipped). Nothing here is a mandate to build the rest now — per `Product-Vision.md`'s "Extend on evidence, not speculation," a stage earns its build when a release scopes it, same discipline as before this reset.

| Stage | Purpose | Enters when | Exits when |
|---|---|---|---|
| **Understand** | Build the concept: plain-language explanation, worked examples, a check that it landed | Learner opens a Topic | Learner has seen the explanation and at least one worked example |
| **Practise** | Attempt questions with hints available, gradually less scaffolded | After Understand, or returning to a Topic already understood | Enough correct attempts to move toward Diagnose/Test, or the learner stops |
| **Diagnose** | Identify *what specifically* is going wrong — which concept, which misconception, which question shape | Triggered by a pattern in recent attempts (repeated wrong answers, a specific wrong-option/misconception match) | A specific gap is identified (or none is — learner is doing fine) |
| **Fix** | Directly address the identified gap — targeted remediation, not a generic "try again" | Immediately after Diagnose finds something | Learner has seen a fix targeted at their actual mistake |
| **Review** | Look back at what was wrong and why, with the fix in hand | After Fix, or self-directed ("show me what I got wrong") | Learner has reviewed the specific missed item(s) |
| **Reattempt** | Try the same gap again, now informed | After Review | Correct on reattempt, or routed back to Diagnose |
| **Test** | Deliberately opt-in, timed/scored self-assessment of readiness | Learner (or a teacher/parent assigning to them) chooses to assess | Test session completes |
| **Measure** | Turn attempt history into a readable signal — accuracy, streak, mastery, (future) fluency/transfer/readiness | Continuously, from any attempt in any stage | N/A — a standing signal, not a task |
| **Recommend** | Answer "what should I do next" using Measure's signal | Whenever a learner needs a next step | Learner has a concrete next action |
| **Improve** | The outcome: demonstrably better at the thing that was previously a gap | Over time, across cycles of the stages above | N/A — the loop's purpose, not a single task |

This is still a **progression per Topic/concept**, not per Chapter and not global — unchanged from the prior model. A learner can be at Practise on one concept and Measure-showing-Mastery on another in the same Chapter simultaneously.

### 2a. Mapping from what's already shipped

So a reader doesn't have to guess how today's real, working feature names relate to the journey above:

| Shipped today (old stage name / feature) | Maps to | Status |
|---|---|---|
| Learn (Topic explanation) | Understand | ✅ Shipped, 7/7 chapters. Progressive disclosure + jump-to-section nav added 2026-09-02 (commit `44b98b7`). |
| Worked Examples | Understand | ✅ Shipped alongside Learn, same chapters. |
| Understand (old: single comprehension-check prompt) | Understand | ❌ Not built for any chapter — unchanged gap, carried forward from the prior model. |
| Guided Practice (hints, coaching message, solution reveal) | Practise | ✅ Shipped — today's `QuestionPage`/`SessionQuestionPage` flow, unchanged by this reset. |
| Independent Practice | Practise | ❌ Not built — no UI distinction between "hints foregrounded" and "hints available but not foregrounded" exists yet. |
| Homework Practice | Practise (self-directed return) | ❌ Not built — no "today's practice" surface exists; a learner returns to a Chapter/Topic manually. |
| Revision (resurface weak topics) | Diagnose + Recommend, partially | ⚠️ Partially shipped — Revision *mode* exists and auto-targets weak topics server-side (`learning_context_service`), but this is selection, not a visible diagnosis or an explained recommendation. The learner isn't told *why* these questions were chosen. |
| — (no prior equivalent) | Diagnose | ❌ Not built as a proactive stage (no view answers "what am I struggling with"). Self-Serve Learning Loop V1 Slice 5 (2026-09-08) built the reactive submission-matching logic this stage would consume (`commonWrongOptionId` exact-match, see Fix below) — Diagnose itself, as a standalone view over a learner's history, remains unbuilt. |
| — (no prior equivalent) | Fix | ⚠️ Partially shipped (Self-Serve Learning Loop V1, Slice 5, "Runtime Remediation," 2026-09-08) — the runtime mechanism (schema, matching logic, API, `RemediationPanel` UI) is fully built and live, gated on the coaching ladder reaching `SHOW_HINT`/`SHOW_SOLUTION`. It does not yet fire for any real question: the content-export pipeline hasn't been extended to carry authored `why`/`remediationHint`/`commonWrongOptionId` into the runtime `questions.json` (`ProductArchitecture.md` §14), so no question in the live dataset carries this content yet. |
| — (no prior equivalent) | Review (of *incorrect* questions specifically) | ⚠️ Partially shipped (Self-Serve Learning Loop V1, Slices 3 + 6b, 2026-09-08/09) — `GET /performance/me/mistakes` surfaces every unresolved wrong question as a Dashboard "Needs Practice" list, reachable self-serve and class-joined alike. The action offered is chapter-level only ("Practice this chapter") — no per-question fix/explanation attached and no exact reattempt of the missed question (see Reattempt below, still not built). The fuller vision of this stage — the missed question shown together with its fix — remains unbuilt. |
| — (no prior equivalent) | Reattempt | ❌ Not built — no "retry what I got wrong" flow exists; a learner can only restart a whole session or chapter. |
| Test mode | Test | ✅ Shipped — timed, scored, self-feedback-framed, and self-serve-reachable (Self-Serve Learning Loop V1, Slice 1, 2026-09-03: no class-membership gate exists anywhere in the session path; a self-serve learner identity is established lazily via `ensureLearnerSession()` on an explicit learner action, then routes through the same engine as the class-joined flow). Previously documented as teacher-facing/opt-in-only inside the authenticated flow only — superseded. |
| Mastery (deterministic rule) | Measure | ⚠️ Partially shipped — the Mastery rule, `GET /performance/me`'s per-topic accuracy/streak, and D1's `GET /performance/me/concepts` all exist and are reachable by authenticated class-joined students and self-serve learners alike (both resolve under the same `role="student"` session contract). Fluency/Transfer/Readiness (§ below) don't exist as distinct signals for either. |
| — (no prior equivalent) | Recommend | ❌ Not built — no feature currently answers "what should I do next" for a learner; they choose a chapter/mode themselves every time. |
| — (no prior equivalent) | Improve | N/A — an outcome of the loop working, not a feature to build directly. |

### 2b. The reach gap (why "shipped" isn't the same as "usable by everyone")

**Closed, 2026-09-03 to 2026-09-09 (Self-Serve Learning Loop V1).** Revision's weak-topic targeting, Test mode, Measure/Mastery, and Wrong-Answer Review are all now reachable by a self-directed learner without a teacher or class code: `ensureLearnerSession()` lazily establishes a `SelfServeLearner` identity on an explicit learner action (never merely on page view), after which the learner runs through the same Learning Session Engine the class-joined flow uses — no separate, cut-down path. What remains true: a visitor who never takes that action (pure anonymous, `localStorage`-only browsing) still has none of it. See `ProductArchitecture.md` §1a for the current shape of that remaining anonymous-track gap, which is narrower than originally scoped here but not eliminated.

---

## 3. The Topic Model (pedagogical anatomy)

`Topic` is the atomic unit of the learning journey. `Chapter` is a shelf of Topics; `Question` is a tool a Topic uses at specific stages — neither Chapter nor Question is where the journey actually lives.

**Anatomy of a Topic:**

| Component | Feeds which stage(s) | Exists today? |
|---|---|---|
| Concept explanation (plain language) | Understand | Yes — shipped, all 7 chapters |
| Comprehension check (1 lightweight prompt) | Understand | No — new, minimal |
| Worked example(s), fully solved | Understand | Yes — shipped |
| Question pool, tagged by role: *guided* vs *independent* vs *homework/revision* | Practise | Partially — `Question` exists; role tagging doesn't |
| Hints per question | Practise | Yes — shipped, unchanged |
| Authored misconception content (`commonWrongAnswer`, `why`, `remediationHint`, `commonWrongOptionId`) | Diagnose, Fix | Authored in content-source for a meaningful share of questions. The runtime mechanism (schema, matching, API, UI) shipped in Self-Serve Learning Loop V1 Slice 5 — but the content-export pipeline hasn't been extended to carry `why`/`remediationHint`/`commonWrongOptionId` into `backend/app/data/questions.json`, so the mechanism is currently dormant for every question. `commonWrongAnswer` is deliberately never exported (an authoring aid, not learner-facing content) — see `Product-Vision.md`. |
| Mastery criterion (3 consecutive correct, independent, no hints) | Measure | Yes — deterministic, shipped |
| Fluency / Transfer / Readiness signals | Measure | No — future, see `Product-Vision.md` |
| Cognitive-demand classification (Recall/Direct/Multi-step/Reasoning/Transfer/Trap/Challenge) | Diagnose, Fix, Recommend (future "twist" detection) | No — future, see `Product-Vision.md`'s "twist / transfer capability." `difficulty` (Easy/Medium/Hard) is the only classification axis a question carries today. |

Note what's *still* not here: no per-student model, no adaptive branching logic, no AI-generated-on-the-fly content. The Topic is a static, authored unit — the *journey through* it is what's dynamic (driven by the learner's tracked history), not the Topic's content itself. This principle is unchanged by the 2026-09-02 reset; GenAI's role (per `Product-Vision.md`'s GenAI Strategy) is additive intelligence on top of this, not a replacement for it.

---

## 4. Stage-by-stage: content, authorship, AI, and what stays deterministic

### Understand (Learn + Worked Examples + comprehension check)
- **What belongs:** one short, plain-language explanation per concept, 1–2 fully worked examples, and (not yet built) a single low-stakes comprehension check.
- **Content authors create:** the explanation text, the worked examples, the check prompt.
- **AI contributes:** offline-assisted first draft, human-reviewed before it ships. Never live.
- **Stays deterministic:** which explanation/examples are shown (exactly the authored ones, always, per Topic) — no selection logic.

### Practise (Guided → Independent → Homework)
- **What belongs:** today's real `QuestionPage`/`SessionQuestionPage` flow — question, hints, coaching message, solution reveal. Independent (less-foregrounded hints) and Homework (self-directed return) are not built.
- **Content authors create:** questions + hints (as today).
- **AI contributes:** Shadow Mode continues running underneath, unchanged, unseen by the learner — logging-only, per ADR-002.
- **Stays deterministic:** the coaching rule (`TRY_AGAIN`/`SHOW_HINT`/`SHOW_SOLUTION`) — completely unchanged, ADR-001 untouched.

### Diagnose (new stage — not built)
- **What belongs:** identifying which concept or misconception a learner's recent wrong answers actually point to, from their attempt history.
- **Content authors create:** nothing new directly — this stage *consumes* the misconception metadata already authored (see §3). The submission-matching logic already exists (Self-Serve Learning Loop V1, Slice 5); only the content-export pipeline step (§3) remains before real data flows through it.
- **AI contributes:** nothing at first pass — matching a submission against an authored `commonWrongOptionId` (choice questions) is exact and deterministic. Free-text submissions with no clean authored match are the one place a future, evidence-gated AI fallback could eventually help (see `Product-Vision.md`'s GenAI Strategy) — not now.
- **Stays deterministic:** entirely, for the covered case.

### Fix (partially built — runtime mechanism shipped, dormant pending content export)
- **What belongs:** surfacing the authored `remediationHint` targeted at the specific mistake Diagnose identified, instead of (or before) a generic coaching message.
- **Content authors create:** nothing new — the runtime mechanism (coaching-ladder-gated `RemediationPanel`) shipped in Self-Serve Learning Loop V1 Slice 5; only the content-export pipeline step remains before it fires on real questions.
- **AI contributes:** nothing for the covered case. A future fallback for the uncovered tail, per `Product-Vision.md`.
- **Stays deterministic:** entirely, for the covered case.

### Review (of missed questions — new stage, not built; distinct from the existing Dashboard "Review" concept link)
- **What belongs:** a learner-facing view of the specific questions they got wrong, with the fix/explanation attached.
- **Content authors create:** nothing new — reuses existing `solution`/`remediationHint` content.
- **AI contributes:** nothing at MVP.
- **Stays deterministic:** entirely — a query over tracked history ("which questions did this learner get wrong, most recent first"), not a model.

### Reattempt (new stage — not built)
- **What belongs:** offering the exact missed question again (or a close variant, future) after Review.
- **Content authors create:** nothing new.
- **AI contributes:** nothing at MVP. A future variant-generation capability (a differently-surfaced version of the same concept) is explicitly the kind of thing `Product-Vision.md`'s "twist" taxonomy would need to exist first — not scoped.
- **Stays deterministic:** entirely.

### Test
- **What belongs:** exactly today's Test mode — timed, question-count-configured, a self-feedback score at the end. Shipped and working.
- **Content authors create:** nothing new — reuses the existing question pool.
- **AI contributes:** nothing.
- **Stays deterministic:** entirely — session planning/selection (`ProductArchitecture.md` §17) is seeded and rule-based, no ML.
- **Target change, not yet built:** self-serve entry, not only class-joined entry — see §2b.

### Measure
- **What belongs:** turning attempt history into a readable signal. Today: accuracy, streak, the Mastery flag, per topic. Target: also Fluency, Transfer, Readiness (see `Product-Vision.md`).
- **Content authors create:** nothing.
- **AI contributes:** nothing — this is a hard line, unchanged from the prior model: mastery-and-siblings are **never AI-scored**. A fixed rule is the only thing that guarantees a learner can fully trust and verify this signal.
- **Stays deterministic:** entirely, always, including any future Fluency/Transfer/Readiness signal — those are new deterministic rules to design, not a model to train.

### Recommend (new stage — not built)
- **What belongs:** answering "what should I do next" — resume an unfinished chapter, revisit a weak concept, attempt a Test, review a specific missed question.
- **Content authors create:** nothing new — a query/ranking over Measure's signal.
- **AI contributes:** nothing at first pass — see `Product-Vision.md`'s GenAI use case 4 ("AI-supported next-step recommendations") for where this could eventually get AI assistance, gated on deterministic ranking having a demonstrated ceiling first.
- **Stays deterministic:** at first pass, entirely.

### Improve
- **What belongs:** not a screen or a feature — the observable outcome that Diagnose→Fix→Review→Reattempt (and Practise→Test→Measure→Recommend, cycling) actually worked. What "belongs" here is instrumentation to notice it, not new content.
- **Content authors create:** nothing.
- **AI contributes:** nothing directly; a future AI-generated study recap (`Product-Vision.md`'s GenAI use case 3) is the closest AI touchpoint, and it's a *summary of* this outcome, not a driver of it.
- **Stays deterministic:** the underlying measurement is; a future recap's *prose* would be the one place in this whole table AI-generated text reaches a learner un-reviewed in real time — flagged explicitly here as a real departure from the "AI never live" rule elsewhere in this document, and exactly why it's listed as a future, evidence-gated GenAI use case in `Product-Vision.md`, not committed to now.

---

## 5. AI Contribution Map (cross-cutting summary)

| AI does, offline, human-reviewed, today | AI may do, future, evidence-gated (see `Product-Vision.md`) | AI does not do |
|---|---|---|
| Draft concept explanations | Fallback remediation for uncovered wrong answers | Score or gate Mastery/Fluency/Transfer/Readiness |
| Draft worked examples | Socratic hint escalation past the authored hint ladder | Decide sequencing/adaptivity without a deterministic rule underneath |
| Tag misconceptions (Shadow Mode, already running, not yet surfaced) | Generate a study recap | Answer open-ended student questions |
| | Support next-step recommendations | Run as an autonomous agent or multi-agent system |
| | Assist question selection/generation, once deterministic selection has a demonstrated ceiling | Silently override authored content (see `Product-Vision.md`'s Curriculum Integrity) |

Every AI touchpoint that's actually live today is **offline and reviewed**, except the one that already exists and is already invisible to the learner (Shadow Mode, logging-only). The future column is a list of *validated problem shapes to watch for*, not a build order — see `Product-Vision.md`'s explicit non-goals for what stays out regardless (a generic chatbot, autonomous/multi-agent architecture, broad tutoring without a defined problem).

---

## 6. Content authoring brief (what a human produces, per Topic)

For each Topic, before it can ship:
1. One concept explanation (plain language, <1 minute read)
2. One comprehension-check prompt (not yet required in practice — still unbuilt, see §2a)
3. 1–2 worked examples, fully stepped
4. A tagged question pool: which existing/new questions are Guided vs. Independent vs. Homework/Revision material (role tagging still unbuilt — see §2a)
5. A mastery threshold (default: 3 consecutive correct, independent, no hints — override only with a reason)
6. Where available, authored misconception content per question (`commonWrongAnswer`/`why`/`remediationHint`/`commonWrongOptionId`) — already produced for a meaningful share of existing content; continue authoring it, since exposing it (Roadmap.md, near-term) is a documentation-and-export change, not a re-authoring one.

This is the brief the next release's content work produces against — one Topic per existing Chapter, unchanged.

---

## 7. Mapping to the Release Roadmap

| Release | LXA piece it delivers |
|---|---|
| 0.1 | Tracked history that Homework/Revision/Mastery all depend on — no journey stage itself, the substrate under several. Shipped. |
| 0.2 | Understand (Learn + Worked Examples) — one Topic per Chapter. First slice 2026-07-27 (Linear Equations only); all 6 then-existing chapters had Learn/Topic content by the Curriculum Expansion Milestone (2026-08-15); the 7th chapter (Exponents and Powers) shipped with full Understand content from creation (2026-09-02). The comprehension-check half of Understand still isn't built for any chapter. |
| (unnamed, 2026-09-02) | Progressive disclosure + jump-to-section navigation + a second Practise entry point on the Understand page — a UX improvement to the existing Understand stage, not a new stage. See `Backlog.md`. |
| 0.3 | (Orthogonal — answer tolerance, not a journey stage) |
| 0.4 | (Orthogonal — question-pool depth, feeds Practise/Diagnose pools) |
| 0.5 | Homework Practice, Revision, Mastery — the deterministic layer over 0.1's data. Revision and Mastery shipped; Homework Practice did not. |
| 0.6 | Alternate explanations — a second Understand-stage artifact per Topic. Not started. |
| Self-Serve Learning Loop V1 (2026-09-03 to 2026-09-09) | **Self-serve reach for Test/Measure/Revision** — the §2b gap named in this reset's original 2026-09-02 draft. Closed: no product-owner decision remains outstanding for reach — see §2b. Also shipped Wrong-Answer Review (partial version of the Review stage, see §2a) and the Runtime Remediation mechanism (partial version of Fix, see §2a) as part of the same effort. |
| **(future, not numbered)** | **Diagnose (proactive), the remainder of Review/Reattempt, Recommend** — the net-new stages this reset adds to the journey that remain unbuilt after Self-Serve Learning Loop V1. Highest-leverage entry point: extending the content-export pipeline to carry the misconception fields already authored (see `ProductArchitecture.md` §14) into the runtime data — the Fix/Diagnose runtime mechanism to consume it is already built. |

No release introduces a journey stage this document doesn't already define. That's the test for every future proposal: find its stage here first.

---

## 8. Guardrails

- Mastery — and its future siblings Fluency/Transfer/Readiness — are never AI-scored.
- No AI content reaches a learner without human review, at this stage of the product, with the one explicitly-flagged future exception (a study recap's generated prose) named in §4's "Improve" row — and that stays future, not current.
- Nothing in the Understand/Practise/Diagnose/Fix/Review/Reattempt stages is timed or graded in a way visible to the learner — every one of those stays formative, unchanged by this reset.
- Test/Measure are the deliberate, explicitly-entered exception to the rule above — not a contradiction of it, and not (per `Product-Vision.md`) something only a teacher can put a learner into.
- A stage doesn't get built just because it's in the journey diagram — it gets built when a release earns it (§7). This document defines the shape of the destination, not a mandate to build all of it now.
