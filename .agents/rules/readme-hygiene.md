# Public README vs Maintainer Skills Hygiene

## Strict Rule:
1. `README.md` is strictly a user-facing product document for football coaches, analysts, players, and end-users.
   - It MUST contain: feature guides, screenshots, GIF animations, demo video links, and clean milestone changelogs.
   - It MUST NEVER contain:
     - Internal planning comparisons (e.g. comparing cloud providers, hosting tiers, billing limits, pricing risks).
     - Internal safety instructions (e.g. "$0.00 spending limit checklist", account security steps).
     - Internal Git tutorials or workflow diagrams meant for the maintainer's private use.
     - Direct links to `.agents/skills/` or internal agent tooling.
2. Maintainer knowledge, internal plans, hosting limits, and git workflows MUST reside exclusively in `.agents/skills/`:
   - `.agents/skills/deployment/SKILL.md`: hosting architecture, limits, and zero-charge guarantees.
   - `.agents/skills/release-planning/SKILL.md`: SemVer gates, release checklists, and git tagging commands.
   - `.agents/skills/tactical-board-dev/SKILL.md`: coding conventions, store architecture, and commit rules.
