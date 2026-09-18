# Product Vision
**Project:** Math Thinking Coach

**Strategic reset:** 2026-09-02. This document was rewritten at that date to record a significant product-strategy reset, superseding the narrower "coaching tool only" framing that preceded it. Where anything elsewhere in this repository's documentation states or implies the pre-reset framing (assessment as permanently teacher-only, the product as an anonymous learning app, a hard boundary at Class 8 CBSE), **this document governs** — see "What this reset supersedes" below.

---

## North Star

Math Thinking Coach is evolving into: **an intelligent mathematics learning and assessment platform that helps learners understand concepts, practise deliberately, learn from mistakes, strengthen weaknesses, assess their readiness, and know what to do next — while enabling teachers and parents to create and evaluate assessments when external accountability is needed.**

The product is not defined as an anonymous learning app, and not defined as a teacher/classroom product. It is one platform with one underlying model (see "Common Product Model" below); different people relate to it differently depending on who controls the learning experience, who controls assessment, and who needs visibility into results.

**The fundamental learner questions this product exists to answer:**
1. What do I need to understand?
2. What do I need to improve?
3. What should I do next?

Everything the product does should trace back to answering one of these three questions more clearly than before.

---

## North Star Learner Journey

**Understand → Practise → Diagnose → Fix → Review → Reattempt → Test → Measure → Recommend → Improve**

This is meant to be experienced by the learner as **one coherent journey**, not as a menu of disconnected modes (today's Learn / Practice / Revision / Test are steps inside this journey, not separate products). A learner moving through it should always be able to answer "where am I, and what's next" without having to know the underlying feature names.

This journey is the product-level frame. The detailed pedagogical anatomy of each stage — what content each one needs, what stays deterministic, where AI may eventually contribute — lives in [`LearningExperienceArchitecture.md`](LearningExperienceArchitecture.md), which this reset also updates. Do not duplicate that detail here; if it drifts from this journey, LXA is wrong, not this file.

**Current implementation covers only part of this journey** — see "Current State vs. Target State" below. Do not read this journey as already built.

---

## Common Product Model

The strategic model underneath every context the product serves is:

**Learner → Content → Attempt → Evidence → Intervention → Assessment → Result**

This is **one engine, not two.** Do not build separate learning engines for self-serve/anonymous learners and class-connected learners. Different contexts sit on top of the same underlying learning/assessment engine, distinguished only by *who controls the experience*:

- **Self-directed learner** — independently learns, practises, reviews, revises, and (eventually) self-tests. Must not require a teacher or a class to exist. This is a first-class context, not a stripped-down fallback.
- **Teacher/parent context** — can configure/assign assessments and see results for the learners they're responsible for.
- **Institutional/class context** — supports multiple learners, accountability, and external assessment at scale.

The distinction across these three is **who controls the learning experience, who controls the assessment, and who needs visibility into the results** — not three different products, and not three different data models.

**Known current gap against this target** (see `ProductArchitecture.md` §1a for the technical record): Self-Serve Learning Loop V1 (2026-09-03 to 2026-09-09) closed the largest part of this gap — a self-directed learner can now reach the real, shared Learning Session Engine (weak-area targeting, Test mode, Mastery, Wrong-Answer Review) without a teacher or class code, by lazily establishing a self-serve identity on an explicit action. What remains structurally separate is narrower: a visitor who never takes that action still gets only a `localStorage`-only, unidentified flat pass-through with none of the above. This is named here explicitly so the remaining gap is never mistaken for fully closed; converting anonymous browsing itself into a self-serve session automatically (if ever done) is a real future decision, not authorized by this document alone.

---

## Assessment Is Not Inherently Teacher-Only

This reset explicitly retires the prior framing (recorded in `Roadmap.md`'s original "Scalable Assessment System" section and this document's own prior "Coaching vs. Assessment Philosophy" addendum) that assessment/Test mode is fundamentally a **teacher-facing** surface. That framing is superseded — see "What this reset supersedes" below.

The corrected framing:

- A learner should eventually be able to **self-test** — configure and take an assessment of their own readiness, without a teacher assigning it.
- Teacher/parent-specific capabilities are primarily about **creating/configuring assessments, selecting questions, assigning them, external accountability, and viewing results** — a layer of control and visibility on top of the same assessment engine, not a separate engine that only they can reach.
- The underlying assessment engine is **reusable** across self-serve and class contexts.

**What does not change from the prior philosophy** — this is preserved, not reversed: the default coaching loop (Learn/Practise/Guided Practice/Revision) stays formative and score-free. A learner is never shown a grade during ordinary practice. Assessment is a distinct, explicitly-entered mode within the journey — not the default state, and not something imposed on a learner who hasn't asked for it. What changes is *who may enter that mode*: not "a teacher assigns it to you," but "you can enter it yourself, or a teacher/parent can assign it to you" — the same engine, two entry points.

---

## Mastery, Fluency, Transfer, and Readiness (future direction — not implemented)

The product should eventually distinguish between four related but different things a learner's history can tell us:

- **Mastery** — does the learner understand the concept?
- **Fluency** — can the learner solve it reliably?
- **Transfer** — can the learner apply the concept when the question looks different (a "twist" — see below)?
- **Readiness** — can the learner perform adequately for the specific assessment/goal they're preparing for?

**Current implementation only has a simple deterministic Mastery signal** (3 consecutive correct, no hints, most-recent-first — see `LearningExperienceArchitecture.md` §3). Fluency, Transfer, and Readiness as distinct measured signals do not exist yet. **Do not implement a sophisticated readiness or adaptive-learning engine against this section** — it documents intent so future work doesn't accidentally foreclose the distinction (e.g. by hard-coding "mastered" as the only signal anywhere it would be awkward to add a second one later), not a specification to build now.

### The "twist" / transfer capability (future differentiator)

A future differentiator is detecting when a learner is comfortable with straightforward questions but struggles once a question requires unfamiliar presentation, multi-step reasoning, genuine transfer/application, or resists a specific misconception — colloquially, when there's a "twist." Recognizing this reliably will likely need richer question metadata than exists today — a cognitive-demand classification, possible future dimensions being: Recall, Direct application, Multi-step, Reasoning, Transfer, Trap/misconception, Challenge.

**Do not implement this taxonomy now.** It's recorded here so that future content-authoring or schema work doesn't accidentally make it hard to add later (e.g. by treating "difficulty" as the only axis a question can ever be tagged on).

---

## GenAI Strategy

**GenAI is an intelligence layer, not the learning engine.** The preferred progression, always: **deterministic educational logic first → GenAI only where deterministic logic is insufficient.** This was already this product's discipline in practice (see ADR-001, ADR-002, and Shadow Mode's design) before this reset; the reset makes it an explicit, permanent principle rather than an implicit pattern.

High-value future GenAI use cases, none authorized to build yet:
1. **AI fallback remediation** — when authored remediation is unavailable or insufficient for a specific wrong answer.
2. **AI/Socratic hint escalation** — when the authored, deterministic hint ladder is exhausted and the learner is still stuck.
3. **AI-generated learner study recap** — summarizing a session or a period of practice back to the learner.
4. **AI-supported next-step recommendations** — helping answer "what should I do next" when deterministic rules alone can't decide.
5. **Eventually, AI-assisted question selection/generation** — where appropriate, and only after the deterministic selection logic (already built — see `ProductArchitecture.md` §17) has a demonstrated ceiling.

**Every AI intervention must have a concrete product purpose and a measurable outcome.** Do not build a generic AI chatbot, broad AI tutoring without a defined learning problem, autonomous agents, or multi-agent architecture, unless a future product problem genuinely requires them — none currently does. This list is a menu of *validated problem shapes* worth watching for, not a build order.

### Existing authored remediation — expose before you generate

Question content already contains authored, per-question remediation fields (`commonWrongAnswer`, `why`, `remediationHint`, `commonWrongOptionId`) written during content authoring. **The runtime mechanism to surface `why`/`remediationHint`/`commonWrongOptionId` shipped** (Self-Serve Learning Loop V1, Slice 5, "Runtime Remediation," 2026-09-08 — see `ProductArchitecture.md` §14), but **the content-export pipeline still does not carry these fields into the runtime data file**, so the mechanism has no real content to surface for any question yet — a real, concrete remaining gap, narrower than originally scoped (found during the 2026-09-02 exam-prep readiness review; see `Roadmap.md`'s near-term items). `commonWrongAnswer` is deliberately excluded from that export even once it happens — an authoring aid, not learner-facing content.

The strategic order is: **expose/use this authored remediation first → measure how often it actually covers what a learner got wrong → use GenAI only for the uncovered, long-tail cases.** Do not skip straight to an AI-generated explanation for a case authored remediation already answers — that's slower, costlier, and less reliable than data that already exists.

---

## Future Extensibility to Preserve (not decided — do not build against any of this)

Three areas where documentation must not quietly foreclose a future direction, even though none of them are being built now:

- **Teacher/parent custom question ingestion.** A future capability may let a teacher or parent add their own questions — write, upload, or otherwise supply them — for the system to classify, mark, validate, and either fold into the platform's own question bank or use for one assessment only. A rough future flow: *Upload → Understand → Classify → Determine answer/marking → Validate → Approve → Use.* Not implemented; do not implement now. But architecture and content-pipeline documentation must not assume the authored question bank can *never* be extended by anyone other than the current offline-authoring process (see `ProductArchitecture.md` §7/§14).
- **Competitive exam preparation.** The product may eventually expand beyond school chapter-based learning into competitive-exam prep. Do not design the immediate product around this. But "a school chapter" must not be documented as a permanent, hard-coded product boundary — see `ProductArchitecture.md`'s "Future extensibility" note and `Roadmap.md`'s "Open architecture question," both of which already carry this caveat and are extended by this reset rather than replaced.
- **A second class, subject, or board.** Unchanged from the prior "Extensibility Principles" below — still evidence-gated, still not scheduled.

---

## Explicit Non-Goals (deferred, not rejected)

The following are **not current implementation priorities.** None are permanently rejected — they are deliberately deferred until the core product generates enough evidence to justify them. Building any of these without that evidence would itself violate this document's "Problems before technology" principle below.

- Autonomous AI agents
- A general-purpose AI chatbot
- A sophisticated adaptive-learning engine
- Complex mastery algorithms (beyond the existing simple deterministic rule)
- A full competitive-exam framework
- A large teacher dashboard
- A full parent portal
- A large-scale AI-generated question bank
- A full custom-question ingestion pipeline

See `Roadmap.md`'s "Deferred" section for where each of these is tracked, and what (if anything) would need to be true before one gets picked up.

---

## Current State vs. Target State

A fast way to check whether a claim about this product is describing reality or intent:

| | Current (shipped) | Target (this reset) |
|---|---|---|
| Learner journey | Learn / Practice / Revision / Test as separate modes; reachable either self-serve (identity established lazily on an explicit action) or via a class join code — no longer class-only | One coherent Understand→Practise→Diagnose→Fix→Review→Reattempt→Test→Measure→Recommend→Improve journey, available self-serve |
| Underlying engine | One shared Learning Session Engine serves both self-serve and class-joined learners; a third, unidentified `localStorage`-only anonymous path remains separate for visitors who never establish an identity | One shared Learner→Content→Attempt→Evidence→Intervention→Assessment→Result engine under every context, including anonymous browsing |
| Assessment | Test mode exists and is reachable self-serve or class-assigned, no longer authenticated-flow-only | A reusable capability any context (self-serve or assigned) can enter |
| Progress signal | One deterministic Mastery rule | Mastery / Fluency / Transfer / Readiness, distinctly measured (future) |
| Remediation on a wrong answer | The runtime mechanism is built (surfaces `remediationHint` once authored) but no question in the live dataset carries authored remediation yet — every wrong answer still gets a generic coaching message today | Authored `remediationHint` surfaced first; AI only for the uncovered tail (future) |
| Question metadata | `difficulty` (Easy/Medium/Hard) only | Difficulty plus a cognitive-demand classification (Recall/Direct/Multi-step/Reasoning/Transfer/Trap/Challenge) (future) |
| Question bank | Offline-authored only, through the content pipeline | Same, plus a future teacher/parent ingestion path (future) |
| Curriculum scope | NCERT Class 8 CBSE Math only | Same today; documentation must not hard-code this as permanent |

This table is the fast-reference version; the authoritative capability-by-capability breakdown (all 12 target capabilities, current vs. target) lives in `ProductArchitecture.md` and `Roadmap.md` — update those, then this table, if they ever disagree.

---

## What This Reset Supersedes

Named explicitly so a future reader doesn't have to reconcile two documents by inference:

- **This document's own prior "Coaching vs. Assessment Philosophy" section** (the version before 2026-09-02) framed Test mode as a narrow, teacher-adjacent exception to a coaching-only rule. Superseded by "Assessment Is Not Inherently Teacher-Only" above. The underlying behavioral commitment it protected — no score during default coaching — is **not** superseded; it's restated above.
- **`Roadmap.md`'s original "Scalable Assessment System" framing**, which resolved the Milestone E assessment work as "a teacher-facing surface... not a change to the student coaching experience." That resolution was correct *for the milestone it was scoping at the time* and is preserved as history in `Backlog.md`/`PROJECT_STATUS.md`'s completed-work log — but as forward-looking guidance it is superseded by this document. `Roadmap.md` has been updated accordingly.
- **This document's prior narrower mission statement** ("help learners think independently instead of memorizing solutions") — not wrong, but incomplete against the North Star above. The underlying value (reasoning over speed, hints before answers, building confidence) is preserved in "Product Principles" below, unchanged.

---

## Mission

Help learners understand concepts, practise deliberately, learn from mistakes, strengthen weaknesses, assess their readiness, and know what to do next — building independent problem-solving skill, not just syllabus completion. See "North Star" above for the full statement this summarizes.

---

## Target Audience

Class 8 CBSE students, today. This remains a deliberate scope discipline, not a limitation to apologize for — validating the approach deeply for one grade, one subject, and one curriculum comes before generalizing. It is **not** documented as a permanent boundary: see "Future Extensibility to Preserve" above for what must stay possible (competitive exams, a second class/subject/board) without being built now. See `Roadmap.md`'s "Open architecture question" for the current state of that thinking.

---

## Long-Term Vision

If the approach proves out for Class 8 CBSE Math, the long-term aspiration is a platform that helps any learner understand what they need to work on and know what to do next — not just complete a syllabus, and not just for one exam format. That could eventually mean other classes, subjects, boards, or competitive-exam contexts. Nothing about the current architecture commits to that expansion yet, and nothing should be built in anticipation of it before it's a real, approved requirement — but nothing should be built that quietly forecloses it either.

---

## Product Principles

- Learning before answering — the learner attempts first.
- Hints are progressive and optional, never forced.
- The full solution is the last resort, not the default path.
- Deterministic logic first; AI fills a gap only where deterministic logic genuinely can't (see "GenAI Strategy" above) — AI is never the sole grading authority.
- Encourage reasoning over speed.
- Reward progress, not just correctness.
- Support multiple question types and answer formats, not just single numeric answers.
- Build learner confidence.
- Problems before technology — every feature must solve a real learner problem, not showcase a technology.
- Mobile-first, minimal UI, one primary action per screen.
- Extend on evidence, not speculation — new architecture is built only when a real requirement exists, not in anticipation of one. This applies to the North Star journey above exactly as it always applied to everything else: the journey describes a destination, not a mandate to build all of it now.

---

## Curriculum Integrity

Math content — chapters, questions, hints, solutions, expected answers — is human-authored and treated as ground truth. AI is not permitted to silently override it.

This is grounded in a real finding, not a hypothetical: the Feature 014 AI evaluation spike found a case (sample `s26`) where the model incorrectly penalized a mathematically valid method. That's the concrete reason AI evaluation must be validated against human judgment before it can influence what a learner is told, rather than being trusted on deployment. Shadow Mode (Feature 015, shipped 2026-07-23) is that validation mechanism — it runs the AI evaluator against real submissions and logs the comparison, but by design cannot yet influence what a learner is told; see `Roadmap.md` for what has to be true before that changes.

Valid regional or curriculum variation in terminology (e.g. "Trapezoid" vs. "Trapezium" — both valid depending on source) must be accommodated, not marked wrong by default. This is a known limitation of the current exact-match evaluation (see `ProductArchitecture.md` §8) that any future evaluator must actually fix, not just replicate with more confidence.

---

## Extensibility Principles

- Don't build for a second class, subject, board, or competitive-exam framework until one is an approved requirement — see `Roadmap.md`'s "Open architecture question."
- Isolate experimental or unvalidated capability behind seams that can be adopted or discarded without touching the validated core — see ADR-001.
- Extend the data model only when the current one measurably can't express a real requirement. Example: `answer_keys.json` was added only when rule-based evaluation actually needed a comparable answer, not preemptively.
- Don't document a current boundary (a curriculum, a content-ingestion path, a single-engine-per-context assumption) as permanent when it's really just "not built yet" — see "Future Extensibility to Preserve" above.

---

## Success Criteria

**Current, MVP-specific** (see `ProductArchitecture.md` §13): the product succeeds if a student can think through a problem independently — arriving at understanding, not just an accepted final answer.

**Target, North Star-level:** the product succeeds if a learner can, at any point, get a clear answer to "what do I need to understand," "what do I need to improve," and "what should I do next" — and act on that answer without leaving a single coherent journey, whether or not they arrived through a teacher.
