# Invoice Workspace Agent Instructions

Keep this file as a short navigation map. Put changing project state in the linked internal documents, not here.

## Session startup

1. Load the available `caveman` skill and select `ultra` mode before responding. Keep that mode active until the user requests another level or disables it. If the skill is unavailable, state that briefly and continue with equally terse communication.
2. Read [`.internal/current-state.md`](.internal/current-state.md) before substantive work. Treat it as the canonical snapshot of current work, decisions, open questions, verification, and next action.
3. Read [`.internal/handoffs/active-handoff.md`](.internal/handoffs/active-handoff.md). If it names an active handoff, read the linked handoff before continuing.
4. If current state names an active plan, read that plan from [`.internal/plans/`](.internal/plans/). Do not load unrelated or completed plans without need.
5. If current state names an open audit, read that audit from [`.internal/audits/`](.internal/audits/). Do not load closed audits without need.
6. For Google Workspace Add-on design, implementation, review, debugging, authorization, testing, deployment, or maintenance, load [`.agent/skills/google-workspace-addons/SKILL.md`](.agent/skills/google-workspace-addons/SKILL.md) and follow its reference routing.

If an internal file is absent, continue from repository evidence and recreate only files needed for the current task.

## Documentation workflow

- Keep `current-state.md` concise and current. Replace stale facts; do not append a session diary.
- Create a detailed plan only for work needing sustained sequencing, decisions, or multi-session continuity. Follow [the plans guide](.internal/plans/README.md). Follow [the audits guide](.internal/audits/README.md) only when a review needs a durable record.
- After material work, update current focus, decisions, blockers, verification, and next action.
- Before leaving incomplete work, create or update a dated handoff document and point `active-handoff.md` to it.
- When a handoff is accepted, completed, or obsolete, reset `active-handoff.md` to `None`.
- When implementation and documentation conflict, verify behavior, fix stale documentation, and record any material decision.

## Project references

- Live project state: [`.internal/current-state.md`](.internal/current-state.md)
- Active handoff pointer: [`.internal/handoffs/active-handoff.md`](.internal/handoffs/active-handoff.md)
- Plans and plan format: [`.internal/plans/`](.internal/plans/)
- Audits and audit format: [`.internal/audits/`](.internal/audits/)
- Google Workspace Add-on skill: [`.agent/skills/google-workspace-addons/SKILL.md`](.agent/skills/google-workspace-addons/SKILL.md)
