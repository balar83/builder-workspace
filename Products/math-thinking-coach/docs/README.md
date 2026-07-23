# Math Thinking Coach Documentation

This folder contains project-specific documentation for the Math Thinking Coach frontend and planned backend.

## Current focus
- Frontend: React + TypeScript + Vite application with chapter selection, chapter detail, multi-question flow, progressive hint guidance, answer capture, and question progress indicators.
- Backend: Planned FastAPI service layer for future answer evaluation and AI orchestration.

## Documents
- Product-Vision.md — why the product exists (living: mission, audience, principles, roadmap-adjacent philosophy)
- ProductArchitecture.md — how the system is built
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