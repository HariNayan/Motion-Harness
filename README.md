# Motion harness

Makes OpenCode work like a motion-design director: it plans first (direction + storyboard), reviews its own plan, builds an **editable HyperFrames project**, checks it, looks at preview frames, fixes specific defects, and hands the project to **HyperFrames Studio**. The harness never renders or exports; Studio owns preview and final render.

```
AGENTS.md                  operating procedure for the agent (workflow, rules, pitfalls)
opencode.jsonc             default agent; permissions deny render/publish/ffmpeg
.opencode/agent/           motion-director (primary), motion-critic (read-only reviewer)
.opencode/command/         /motion-new, /motion-revise, /motion-review
.opencode/tool/mh.ts       mh_* tools (wrappers over harness/mh.mjs)
harness/mh.mjs             the CLI: phases, plan lint, gate, frames, revisions, checklist, handoff
harness.config.json        depth presets, per-format safe areas, bundled fonts, archetypes
motion-lib/                mh-motion.js/.css primitives; mh-world.js/.css persistent-world + hero-object builders; presets/night-sky.json; README
templates/                 brief, direction, storyboard, reference-analysis templates
projects/<slug>/           HyperFrames project; harness state in .mh/
eval/                      acceptance runner + report, model-testing protocol
```

## Dashboard (connect OpenCode, create videos)

Double-click `Start Dashboard.cmd` (or `node dashboard/server.mjs`) and open http://127.0.0.1:4177.

- **Connection:** like Leadsmith, there is no OpenCode HTTP API. The dashboard runs the CLI headless, `opencode run --format json --agent motion-director [--model provider/model]`, from this folder (so `.opencode/` agents, tools and the no-render permissions apply), sends the prompt on stdin and turns the JSON events into a live log. Providers come from `~/.local/share/opencode/auth.json` (names only, keys are never read) and models from `opencode models`. Add a provider with `opencode auth login`.
- **Create:** describe the video, pick format, planning depth and look (`night-sky` dense preset or agent-designed), press *Create with OpenCode*. Only that press uses your model quota. One job runs at a time; *Stop* kills the process tree.
- **Reference video and raw files:** *Attach reference video or files* on the prompt box (or the Revise box), or drop files on it. Files stream into `inbox/` with progress (up to 4 GB each; executables are refused). Mark each as a **Reference** (look, pacing, structure; analysed, never copied) or a **Raw asset** (real material to use in the video). The agent imports them with `mh_importfile` (`mh import`): reference videos are probed, sampled into 8 frames and scanned for scene cuts (approximate times; easing is not measurable); raw assets are copied to `assets/source/`, probed, and video gets preview frames. The gate warns about imported assets no composition uses and about unfinished reference analyses. The project's **Files** tab shows both, with the reference video playable.
- **Projects:** phase, gate result, evidence level, storyboard with hero objects, design system, checklist notes, preview frames, revision history, *Revise with OpenCode*, *Run quality gate*, *Capture preview frames*, *Lock scenes*.
- **Studio:** *Open in HyperFrames Studio* starts the preview. There is deliberately no render or export button; render in Studio.
- Local only: binds to 127.0.0.1, rejects non-loopback Host headers and cross-origin POSTs (so a web page you visit cannot start jobs or upload files), validates project names and model ids, never passes user text through a shell (the brief goes on stdin).
- Tests: `node dashboard/test/run-tests.mjs` runs the server against a stub `opencode` (no model, no tokens).

## Use

In OpenCode, from this folder (`motion-director` is the default agent):

```
/motion-new 12 second vertical explainer about ... for ...
/motion-revise ex-editorial: make the number scene hit harder, keep the rest
```

Or drive the CLI directly (same state files):

```bash
node harness/mh.mjs new my-film --format horizontal --depth high
node harness/mh.mjs status my-film
node harness/mh.mjs lint my-film          # plan lint
node harness/mh.mjs gate my-film          # hyperframes check + harness checks
node harness/mh.mjs frames my-film        # preview stills, NOT a render
node harness/mh.mjs preset my-film night-sky   # dense persistent-world design system
node harness/mh.mjs studio my-film        # start HyperFrames Studio preview in the background
node harness/mh.mjs adopt hf-swiss --example swiss-grid   # wrap a HyperFrames shipped example
```

## What is persisted (`projects/<slug>/.mh/`)

`brief.md`, `direction.json` (concept, arc, design system, rules, anti-patterns, reference rules), `storyboard.json`, `manifest.json` (scene hashes for drift detection), `decisions.jsonl`, `revisions.jsonl` (reason, touched, preserved), `references/*.analysis.json`, `plan-lint.json`, `gate-report.json`, `checklist.json`, `frames/`. `HANDOFF.md` and `DIRECTION.md` (`mh direction-md`) are written into the project.

## Quality gates

`mh gate` reports real findings (including **sparse scenes** with no hero object and **near-empty / sparse frames** measured from snapshots; relaxed only by an explicit `density: minimal` + reason): `hyperframes check` sections (lint, runtime, layout, motion, contrast, craft), scene/storyboard structure and timing gaps/overlaps, off-palette colours, fonts outside the design system, sub-minimum type, forbidden APIs, identical motion across scenes, scene drift since the last lock, and whether frame evidence is none/stale/fresh. The 12-item checklist auto-fills only what is measurable; judgement items need a specific note, and `basis: visual` is refused without fresh frames.

## Depth

`draft` / `standard` / `high` in `harness.config.json` control required plan reviews (1/2/3), revision limit (3/5/8), minimum scenes, frame-evidence requirement (optional/recommended/required) and a guideline step budget. Higher depth buys more planning and verification, not more effects.

## Not done / limits

- The OpenCode model was not run against the harness (see `eval/README.md`).
- Nothing was rendered; visual claims rest on snapshot frames the agent opened.
- Reference-image analysis relies on the model's vision; `mh ref lint` only enforces structure (e.g. no timing claims from stills).
- Studio-edit round trip: edits made in Studio change files the harness has locked; the gate reports them as drift. Run `mh revise` or `mh lock` afterwards.
