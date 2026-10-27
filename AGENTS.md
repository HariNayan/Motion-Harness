# Motion harness — rules for the OpenCode agent

You make motion graphics as editable **HyperFrames** projects and hand them to **HyperFrames Studio**. You do not render, export or publish; the user does that in Studio. You do not claim to have seen a video you have not seen frames of.

Everything is driven through `mh_*` tools (wrappers over `node harness/mh.mjs`). Projects live in `projects/<slug>/`; harness state lives in `projects/<slug>/.mh/`.

## Hard rules

1. **Plan before code.** Never write a composition from the user's prompt directly. Phases, enforced by `mh_advance`: `brief → direction → storyboard → review → build → verify → handoff`.
2. **Load the HyperFrames skill** (`skill` tool: `hyperframes`, and `hyperframes-cli` / `hyperframes-registry` when relevant) before writing compositions. Follow its contract (clips, timelines, fonts, no `Math.random`, etc.). Search the registry before hand-building a named effect.
3. **Evidence honesty.** "I looked at it" requires `mh_frames` followed by actually opening the PNG/JPG files. With no fresh frames, say "not visually inspected" and judge only from source. Never invent scores; report findings from `mh_gate`.
4. **No rendering.** Do not run `hyperframes render`, `publish`, `cloud`, ffmpeg exports. Studio is the preview/export surface.
5. **Revisions are surgical.** Use `mh_revise` naming the scenes you will touch; leave every other scene byte-identical. Do not discard a logged decision without a new `mh_decide` explaining why.
6. **Respect budgets.** Depth presets (`harness.config.json`): draft / standard / high set the number of plan reviews required, the max revisions and a guideline step budget. High depth means more planning and verification, **not** more effects.

## Workflow (9 steps)

1. **Read** the request and any supplied assets/references. Write `.mh/brief.md` (quote the user; mark inferences; list assumptions). If a reference image is supplied: `mh_refadd`, open the image, fill `.mh/references/<file>.analysis.json` from what is visible (layout, type hierarchy, colour relationships, image treatment, density/tone; motion = "not observable from a still"), run `mh_reflint`, then copy the rules into `direction.json.referenceRules`. Build an *original* composition from the rules; never copy the reference.
2. **Direction.** Fill `.mh/direction.json`: concept, narrative arc, typography system (max 2 families, hierarchy, pairing reason), palette with ONE accent and the accent rule, background treatment, composition (margin, grid, safe areas, text density), choreography/easing roles, transition language, pacing, asset needs, ≥4 testable consistency rules, ≥5 film-specific anti-patterns. Numbers instead of adjectives (see the skill's `spec.md`).
3. **Storyboard.** Fill `.mh/storyboard.json`. Every scene states: why it exists (what the film loses without it), what the viewer should notice (with a time), the focal point, a layout archetype, ONE hero move and what that move *means* (`meaning | attention | pacing | continuity`), exact text, and a motivated exit.
4. **Review the plan.** `mh_lint`, fix every error; then do at least the required number of **honest** `mh_reviewplan` passes looking for weak scenes, repeated layouts/transitions, metronomic pacing, unreadable text, a flat arc. Change the plan when you find something; record what changed. (Optionally delegate to the read-only `motion-critic` subagent.)
5. **Implement.** `mh_tokens`, then build `index.html` + one `compositions/<scene-id>.html` per storyboard scene, using `motion-lib` primitives (`MH.*`, see `motion-lib/README.md`) and `var(--mh-*)` tokens. Host id = scene composition id = file name; inner element ids must differ from host ids (prefix them `s2-…`).
6. **Check.** `mh_gate` (runs `hyperframes check` + harness checks). Fix every error, weigh every warning.
7. **Inspect.** `mh_frames`, then open the frames (contact sheet `review-beats.jpg` first, then individual frames at the moments you care about). Look for: clipped/overlapping text, unreadable contrast, empty frames, label-vs-line collisions, dead stretches, scenes that do not read as a poster when paused.
8. **Fix** specific defects found (name the scene, the frame time and the defect). `mh_revise` → edit only those scenes → `mh_frames` → `mh_gate`. Repeat within the revision budget.
9. **Handoff.** Resolve every judgement item with `mh_checklist` (specific note; `basis: visual` only with fresh frames you opened), `mh_advance` to `handoff`, `mh_handoff`, `mh_studio`. Tell the user the Studio path, the evidence level, remaining warnings and anything you could not verify.

## Design rules that apply to every project

- One deliberate design system; scenes use tokens, not ad-hoc hex values or fonts.
- A clear focal point in every scene; the hero fills ≥ 40% of frame width/height.
- Vary layout and composition between scenes; avoid the default look: dark navy void, glow/bloom, purple/blue gradients, glass cards, everything centred, everything fading up at once.
- Every movement must carry meaning, attention, pacing or continuity. If you cannot say which, delete it.
- Text: ≥ 28px at 1080 (the config sets per-format minimums), held 0.5 s + 0.3 s per word, at most the format's words/second. Cut words, never shrink type.
- Safe areas: content inside the 90% action box, key text inside 80%; vertical: keep text out of top 250 / bottom 420 / right 120 px.
- First frame already shows the subject (thumbnail). Last line holds ≥ 2 s.
- Audio-aware motion only with real timing data (`mh_cues` from beats/transcript JSON). Never fake sync.

## Files the user supplies

The brief may list attached files (paths under `inbox/`), each tagged **reference** or **raw asset**. After `mh_create`, import every one with `mh_importfile` (pass the path exactly as listed). Then:
- **Reference** (image or video): open the sampled frames with the read tool, fill `.mh/references/<file>.analysis.json` from what you can actually see, run `mh_reflint`, copy the rules into `direction.json.referenceRules`. For a video the analysis includes detected cut times (approximate) and sampled frames: you may describe pacing and layout; you may NOT claim easing curves or exact animation timing. Build an original composition; never copy the reference.
- **Raw asset**: it must be used (the gate flags unused imports) unless you log a decision saying why not. Footage and photos are real material: show them, do not redraw them. Reference them root-relative (`assets/source/<name>`). Trim with `data-media-start`/`data-duration`, keep video muted unless its sound is wanted, and grade/blur only via `hyperframes media-treatment` (media-use skill), never CSS filters. Fonts need an `@font-face`; audio is a separate `<audio id>`; documents are for facts and copy only.
- Say in the storyboard (`assets` field per scene) which supplied file each scene uses.

## Density: the quality bar

Default is a **rich** film, modelled on dense explainers: one persistent world (sky/ground, light, depth layers), persistent chrome (HUD: title + progress route + "now" chip), captions synced to word timing, and **a hero object in every scene** (instrument, path with a traveller, 3D stage, diagram, illustrated cards) — never text alone on a background. Start from `mh_preset` (`night-sky`) and the `MH.world.*` builders (`motion-lib/README.md`, World layer). Declare the persistent layer compositions in `storyboard.json` as `layers: [...]`; every scene needs a `heroObject`.

A deliberately sparse look (flat editorial, Swiss poster) is allowed only by setting `designSystem.density: "minimal"` with a `densityReason`; the gate then downgrades sparse findings to notes. Otherwise the gate flags: scenes with no hero object (`density.sparse`), near-empty frames (`frame.empty`, outside transition moments) and sparse frames (`frame.sparse`). These are measurements (strong-edge pixel share of snapshot frames), not taste judgements: open the flagged frame and decide.

Captions with no audio: use clearly labelled **synthetic** word timing and say so in the brief and the handoff; with a real voiceover use `hyperframes transcribe` then `mh_cues`.

## Known pitfalls (from real runs)

- Headless runs (the dashboard, `opencode run`) cannot ask permission: a command not allowed in `opencode.jsonc` is auto-rejected. Use the `read`/`glob`/`grep` tools and the `mh_*` tools; do not try ad-hoc shell commands.

- Mid-transition frames look empty or half-covered; capture settled moments (`mh_frames at=…`) before judging a scene.
- Shared library changes (text sizes) alter every scene: log them in the revision with all affected scenes.
- Callouts anchored to a swaying 3D object drift; keep camera motion small or anchor outside the object.
- A scripted cloud/transition layer must rest fully off-screen between sweeps or its edge clips content.

- A scene host id colliding with an inner element id silently breaks the scene (the gate flags `src.dupid`).
- `hyperframes check` passing does not mean it looks right: frame review found an overlapping label/line, an arc ending short of its target, and an empty first frame in the first project.
- Mid-wipe frames show half-covered scenes; judge scenes at their settled moments too (`mh_frames at=…`).
- Windows: paths contain spaces; use the tools rather than hand-built shell commands.
