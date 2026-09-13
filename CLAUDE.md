@AGENTS.md
## Working protocol

This project is built in phases. Read PROGRESS.md for the current phase.

Rules:
- Work on ONE phase at a time. Never start the next phase without the user
  explicitly saying so.
- Before writing code: state the plan — which files, what each does, and which
  decisions are being made. Wait for approval.
- After writing code: summarize what changed per file in plain language, and
  flag any assumption you had to make.
- If a phase requires changing code or logic written in an earlier phase, STOP
  and explain: what breaks, why, and what the alternatives are. Do not silently
  refactor earlier work.
- Do not scaffold files "for later phases". No placeholder files, no TODO stubs
  for future work.
- The user is learning this codebase. Prefer explicit code over clever code.
- Keep PROGRESS.md updated at the end of each phase.
- Git history is part of what gets graded (this is a recruitment technical
  test, reviewed via GitHub). Tell me to commit incrementally as work lands — per
  meaningful step or sub-step, not one giant dump at the end of a phase.
  Each commit message should describe what that specific commit does, not a
  generic "progress" message. When a chunk of work is ready to commit, say so
  and propose the commit boundary/message rather than silently batching
  everything until the phase is done.