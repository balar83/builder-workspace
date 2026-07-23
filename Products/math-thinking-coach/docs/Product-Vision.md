# Product Vision
**Project:** Math Thinking Coach

---

## Mission

Help learners think independently instead of memorizing solutions.

---

## Target Audience

Class 8 CBSE students, today, specifically and only. This is a deliberate narrowing, not a limitation to apologize for: validating the coaching approach deeply for one grade, one subject, and one curriculum comes before generalizing to others. See "Extensibility Principles" below and `Roadmap.md`'s "Open architecture question" for what would need to be true before that scope expands.

---

## Long-Term Vision

If the coaching approach proves out for Class 8 CBSE Math, the long-term aspiration is a coach that helps any learner build independent problem-solving skill — not just complete a syllabus. That could eventually mean other classes, subjects, or boards. Nothing about the current architecture commits to that expansion yet, and nothing should be built in anticipation of it before it's a real, approved requirement.

---

## Product Principles

- Learning before answering — the student attempts first.
- Hints are progressive and optional, never forced.
- The full solution is the last resort, not the default path.
- AI acts as a coach, not an answer machine, and never as a grading authority (see "Coaching vs. Assessment Philosophy" below).
- Encourage reasoning over speed.
- Reward progress, not just correctness.
- Support multiple question types and answer formats, not just single numeric answers.
- Build learner confidence.
- Problems before technology — every feature must solve a real learner problem, not showcase a technology.
- Mobile-first, minimal UI, one primary action per screen.
- Extend on evidence, not speculation — new architecture (e.g. supporting a second class or subject) is built only when a real requirement exists, not in anticipation of one.

---

## Coaching vs. Assessment Philosophy

This product is a coaching tool, not an assessment or grading tool.

Concretely: the backend's evaluation logic produces a correctness signal (`isCorrect`, `score`), but the UI never surfaces a score or grade to the learner — only a coaching message and a next action. Evaluation exists solely to drive *coaching decisions* (which hint to suggest, when to nudge, when to offer the solution), never to produce a report card.

This isn't just a UI choice — it has architectural teeth. Evaluation and coaching are deliberately separate services (see [ADR-001](ADR/ADR-001-evaluation-coaching-separation.md)) precisely so a future, smarter evaluator can improve *correctness-checking* without this product drifting into a testing/scoring tool.

---

## Curriculum Integrity

Math content — chapters, questions, hints, solutions, expected answers — is human-authored and treated as ground truth. AI is not permitted to silently override it.

This is grounded in a real finding, not a hypothetical: the Feature 014 AI evaluation spike found a case (sample `s26`) where the model incorrectly penalized a mathematically valid method. That's the concrete reason AI evaluation must be validated against human judgment (via Shadow Mode — see `Roadmap.md`, near-term) before it can influence what a learner is told, rather than being trusted on deployment.

Valid regional or curriculum variation in terminology (e.g. "Trapezoid" vs. "Trapezium" — both valid depending on source) must be accommodated, not marked wrong by default. This is a known limitation of the current exact-match evaluation (see `ProductArchitecture.md` §7) that any future evaluator must actually fix, not just replicate with more confidence.

---

## Extensibility Principles

- Don't build for a second class, subject, or board until one is an approved requirement — see `Roadmap.md`'s "Open architecture question."
- Isolate experimental or unvalidated capability behind seams that can be adopted or discarded without touching the validated core — see ADR-001.
- Extend the data model only when the current one measurably can't express a real requirement. Example: `answer_keys.json` was added only when rule-based evaluation actually needed a comparable answer, not preemptively.

---

## Success Criteria

The product succeeds if a student can think through a problem independently — arriving at understanding, not just an accepted final answer. See `ProductArchitecture.md` §12 for the current, MVP-specific checklist this translates to in the shipped product.
