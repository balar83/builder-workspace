# Math Thinking Coach Documentation

This folder contains project-specific documentation for the Math Thinking Coach frontend and planned backend.

## Current focus
- Frontend: React + TypeScript + Vite application with chapter selection, chapter detail, multi-question flow, progressive hint guidance, answer capture, and question progress indicators — backed by the live backend API.
- Backend: FastAPI service layer live since Feature 007. Answer evaluation is rule-based and drives coaching (Feature 010, seam established by ADR-001). An experimental AI evaluator now runs alongside it in production, out-of-band and logging-only (Shadow Mode, Feature 015, ADR-002). A Topic data model and retrieval API (Feature 018) is fed by a content authoring and Stage 10 export pipeline (Features 019–021, ADR-003). Minimal student/teacher identity (Milestone A, ADR-004) exists but is dormant — no route or page consumes it yet. See `HANDOFF_PROMPT.md` for current status.

## Documents
- Product-Vision.md — why the product exists (living: mission, audience, principles, roadmap-adjacent philosophy)
- ProductArchitecture.md — how the system is built
- LearningExperienceArchitecture.md — how students learn (the pedagogical counterpart to ProductArchitecture.md)
- Roadmap.md — living capability roadmap, phased and sequenced
- Idea-Inbox.md — living, append-only, unfiltered idea capture
- Backlog.md — approved future work only
- Development-Journal.md — append-only engineering diary
- Release-Notes.md — user-visible changes
- ADR/ — accepted architecture decision records
- Wireframes.md
- HANDOFF_PROMPT.md

## Documentation Principles
- Documentation is a living artifact.
- Every architectural change must be reflected here.
- Documentation should always match the implementation.
- Only completed work should be documented as done.
- **Exception**: `Product-Vision.md`, `Roadmap.md`, and `Idea-Inbox.md` are intentionally forward-looking and exempt from "only completed work" — see `AI-Builder-OS/CLAUDE.md`'s "Engineering Documentation vs. Product Documentation" section for the full rule.