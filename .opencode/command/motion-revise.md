---
description: Targeted revision of an existing motion project (preserves working scenes and logged decisions)
agent: motion-director
---

Revise an existing project: $ARGUMENTS

First `mh_status` and read `.mh/decisions.jsonl` and `.mh/revisions.jsonl` so you know what was decided and why. Identify the minimum set of scenes that must change. `mh_revise` with those scene ids and the reason, edit only those files (and `index.html` timing if required), run `mh_gate`, `mh_frames` and look at the frames of what you changed, then re-resolve any checklist items your change affects. If the request contradicts a logged decision, say so and record a new `mh_decide` before changing it. Do not render.
