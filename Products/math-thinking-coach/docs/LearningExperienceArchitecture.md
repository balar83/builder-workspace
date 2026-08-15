# Learning Experience Architecture (LXA) — Math Thinking Coach

The educational counterpart to [`ProductArchitecture.md`](ProductArchitecture.md). That document governs how the system is built; this one governs how a student learns. Every new feature should be placed here first — which stage does it belong to, what does it add — before any technical design work starts on it.

---

## 1. Pedagogical Foundation

Three principles govern every stage below. Any future feature that violates one of these needs a real conversation before it's built, not just a slot in the roadmap.

**Gradual release of responsibility.** The journey is a march from "the app does the thinking" to "the student does the thinking," in explicit steps — not a jump from zero to a cold question. This is the actual content of "teach before you test," given its proper name: *I do → We do → You do*.

**Formative, not summative, at every stage.** Nothing in this journey produces a grade. `Product-Vision.md`'s Coaching vs. Assessment Philosophy already established this for the practice stages (`isCorrect`/`score` never surfaced to the learner); this document extends the same rule to Learn/Understand/Worked-Examples — a wrong guess during Guided Practice is data for the coach, never a judgment on the student.

**Mastery-based, not completion-based, progression.** A Topic is "done" when the mastery criterion is met, not when a fixed count of questions has been answered. This matters for §4 and §7 — it's why Mastery has its own stage instead of being "however many questions happen to exist."

---

## 2. The Learning Journey

| Stage | Purpose | Enters when | Exits when |
|---|---|---|---|
| **Learn** | Introduce the concept in plain language | Student opens a Topic for the first time | Student has read the explanation |
| **Understand** | Confirm the explanation actually landed | Immediately after Learn | Student can restate or recognize the idea (not a formal test — see §4) |
| **Worked Examples** | Show the concept applied, fully solved, before any attempt is required | After Understand | Student has seen at least one full worked solution |
| **Guided Practice** | First attempts, with hints available — today's existing flow | After Worked Examples | Student answers correctly with hints available, or exhausts hints and sees the solution |
| **Independent Practice** | Attempts without hint scaffolding foregrounded | After enough Guided Practice success | Consistent correct answers without needing hints |
| **Homework Practice** | Self-directed return to a Topic not yet mastered | Any time the student opens the app with unfinished Topics | Homework set for the session is attempted |
| **Revision** | Resurface previously-missed questions/weak Topics | Triggered by tracked history, not a fixed schedule | Previously-wrong items answered correctly |
| **Mastery** | A visible, earned signal that a Topic is done | Mastery criterion met (see §3) | N/A — a state, not a task |

This is a **progression per Topic**, not per Chapter and not global — a student can be at Mastery on one Topic and Learn on another in the same Chapter simultaneously. That's the point of introducing `Topic` as the atomic unit instead of stretching `Chapter` to carry this weight.

---

## 3. The Topic Model (pedagogical anatomy)

`Topic` is the atomic unit of the learning journey. `Chapter` is a shelf of Topics; `Question` is a tool a Topic uses at specific stages — neither Chapter nor Question is where the journey actually lives.

**Anatomy of a Topic:**

| Component | Feeds which stage(s) | Exists today? |
|---|---|---|
| Concept explanation (plain language) | Learn | No — new |
| Comprehension check (1 lightweight prompt, e.g. "does this make sense?" or a single low-stakes recognition question) | Understand | No — new, minimal |
| Worked example(s), fully solved | Worked Examples | No — new |
| Question pool, tagged by role: *guided* vs *independent* vs *homework/revision* | Guided/Independent/Homework/Revision Practice | Partially — `Question` exists; the *role* tagging doesn't |
| Hints per question | Guided Practice | Yes — already exists, unchanged |
| Mastery criterion (e.g. 3 consecutive correct, independent, no hints) | Mastery | No — new, deterministic |
| Common misconceptions (future) | Feeds targeted re-teaching, not MVP | No — Shadow Mode's `misconception_tags` are the eventual source, not yet controlled-vocabulary enough to use |

Note what's *not* here: no per-student model, no adaptive branching logic, no AI-generated-on-the-fly content. The Topic is a static, authored unit — the *journey through* it is what's dynamic (driven by the student's tracked history), not the Topic's content itself.

---

## 4. Stage-by-stage: content, authorship, AI, and what stays deterministic

### Learn
- **What belongs:** one short, plain-language explanation. No jargon beyond what the Chapter already assumes. Long enough to teach, short enough to read in under a minute — this is a companion opened after a tiring school day, not a textbook.
- **Content authors create:** the explanation text.
- **AI contributes:** offline-assisted first draft, human-reviewed before it ships. Never live.
- **Stays deterministic:** which explanation is shown (exactly one, always the same one, per Topic — no selection logic yet).

### Understand
- **What belongs:** a single, low-stakes comprehension check — not a quiz, closer to "here's a simple version, does this make sense?" It should be answerable from the explanation alone, no problem-solving required.
- **Content authors create:** the check prompt.
- **AI contributes:** nothing at MVP. This is the stage most tempting to over-build (a real "did they understand?" model) — resist; a simple authored prompt is enough until there's evidence it isn't.
- **Stays deterministic:** entirely — no branching based on the answer yet.

### Worked Examples
- **What belongs:** 1–2 fully solved problems, step-by-step, in the same format `SolutionPanel` already renders — reuse the existing solution-step convention, don't invent a new one.
- **Content authors create:** the examples and their step breakdown.
- **AI contributes:** offline-assisted drafting, human-reviewed.
- **Stays deterministic:** which examples are shown, in what order.

### Guided Practice
- **What belongs:** exactly today's `QuestionPage` flow — question, hints, coaching message, solution reveal. No new content type; this stage already exists.
- **Content authors create:** questions + hints (as they do today).
- **AI contributes:** Shadow Mode continues running underneath, unchanged, unseen by the student — this stage is where ADR-002's infrastructure quietly keeps collecting data for the eventual confidence-gated-evaluation decision (not yet scoped or numbered).
- **Stays deterministic:** the coaching rule (`TRY_AGAIN`/`SHOW_HINT`/`SHOW_SOLUTION`) — completely unchanged, ADR-001 untouched.

### Independent Practice
- **What belongs:** the same question pool, hints available but not visually foregrounded (a UI framing decision, not new content).
- **Content authors create:** nothing new — reuses the Guided Practice pool, tagged for independent use once a student has shown readiness.
- **AI contributes:** nothing new.
- **Stays deterministic:** the readiness threshold that moves a student from Guided to Independent (e.g. two correct-with-hints in a row) — a simple rule, not a model.

### Homework Practice
- **What belongs:** a "today's practice" surface — Topics not yet at Mastery, presented as a short session.
- **Content authors create:** nothing new — this is a *selection* over existing content, not new content.
- **AI contributes:** nothing.
- **Stays deterministic:** entirely a query over tracked history — "which Topics aren't mastered yet."

### Revision
- **What belongs:** previously-wrong questions and weak Topics, resurfaced.
- **Content authors create:** nothing new.
- **AI contributes:** nothing at MVP — spaced-repetition scheduling logic, if it ever gets fancier than "resurface what was wrong," is a later, evidence-gated decision, not an assumption to build in now.
- **Stays deterministic:** entirely.

### Mastery
- **What belongs:** a visible state — a checkmark, a completion indicator per Topic within a Chapter.
- **Content authors create:** nothing.
- **AI contributes:** nothing.
- **Stays deterministic:** entirely — mastery criterion is a fixed rule, not a judgment call, and specifically **not** AI-scored. This is a hard line: mastery is the one signal in the whole journey a student should be able to fully trust and verify, and a fixed rule is the only thing that guarantees that today.

---

## 5. AI Contribution Map (cross-cutting summary)

| AI does, offline, human-reviewed | AI does not do, at MVP |
|---|---|
| Draft concept explanations | Generate content live, on request |
| Draft worked examples | Score or gate Mastery |
| (Later) draft alternate explanations | Decide sequencing/adaptivity |
| Tag misconceptions (Shadow Mode, already running, not yet surfaced) | Answer open-ended student questions |

Every AI touchpoint in this journey is **offline and reviewed** except the one that already exists and is already invisible to the student (Shadow Mode). That's not a limitation of this document — it's the same discipline that made Feature 015 shippable with zero behavior-change risk, applied one level up.

---

## 6. Content authoring brief (what a human produces, per Topic)

For each Topic, before it can ship:
1. One concept explanation (plain language, <1 minute read)
2. One comprehension-check prompt
3. 1–2 worked examples, fully stepped
4. A tagged question pool: which existing/new questions are Guided vs. Independent vs. Homework/Revision material
5. A mastery threshold (default: 3 consecutive correct, independent, no hints — override only with a reason)

This is the brief the next release's content work produces against — one Topic per existing Chapter, to start.

---

## 7. Mapping to the Release Roadmap

| Release | LXA piece it delivers |
|---|---|
| 0.1 | Tracked history that Homework/Revision/Mastery all depend on — no journey stage itself, the substrate under three of them. Shipped — see `Development-Journal.md`'s 2026-07-27 entries. |
| 0.2 | Learn, Understand, Worked Examples — the new stages, one Topic per Chapter. **First slice implemented 2026-07-27** (Features 018–021, see `Roadmap.md` and [ADR-003](ADR/ADR-003-content-authoring-and-export-pipeline.md)): Learn + Worked Examples shipped for Linear Equations only at the time. As of the Curriculum Expansion Milestone (2026-08-15), five of six chapters have Learn/Topic content — Linear Equations, Data Handling, Understanding Quadrilaterals, A Square and A Cube, and Rational Numbers. Practical Geometry remains without a Topic, deliberately (see `Phase-1-Handoff.md` §8). Understand still not built for any chapter. |
| 0.3 | (Orthogonal — answer tolerance, not a journey stage) |
| 0.4 | (Orthogonal — question-pool depth, feeds Guided/Independent/Homework/Revision pools) |
| 0.5 | Homework Practice, Revision, Mastery — the deterministic layer over 0.1's data |
| 0.6 | Alternate explanations — a second Learn-stage artifact per Topic |

No release introduces a journey stage this document doesn't already define. That's the test for every future proposal: find its stage here first.

---

## 8. Guardrails

- Mastery is never AI-scored.
- No AI content reaches a student without human review, at this stage of the product.
- Nothing in this journey is timed or graded in a way visible to the student — every stage stays formative.
- A stage doesn't get built just because it's in the journey diagram — it gets built when a release earns it (§7). This document defines the shape of the destination, not a mandate to build all of it now.
