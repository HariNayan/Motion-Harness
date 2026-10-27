<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-dark.svg">
    <img src="docs/logo.svg" alt="Motion Harness logo" width="120">
  </picture>
</p>

<h1 align="center">Motion Harness</h1>

<p align="center">
  <b>Describe a video, get an editable motion-graphics project, and open it in HyperFrames Studio,<br>
  from a local dashboard powered by the OpenCode you already use.</b>
</p>

<p align="center">
  <a href="#the-dashboard">Dashboard</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#example-videos">Examples</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#quality-gate-and-depth">Quality gate</a> ·
  <a href="#limits-read-before-relying-on-it">Limits</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/runs%20on-OpenCode-D97757" alt="Runs on OpenCode">
  <img src="https://img.shields.io/badge/output-HyperFrames%20project-2563eb" alt="Output: HyperFrames project">
  <img src="https://img.shields.io/badge/renders-never%20(Studio%20does)-6e7681" alt="Renders: never, Studio does">
  <img src="https://img.shields.io/badge/dashboard-local%20only-15803d" alt="Dashboard: local only">
  <img src="https://img.shields.io/badge/node-24-3c873a" alt="Node 24">
  <img src="https://img.shields.io/badge/API%20keys-none%20stored-6938ef" alt="API keys: none stored">
</p>

<p align="center">
  It plans first, builds, checks, <i>looks at the frames</i>, fixes what it finds, then hands the project over.<br>
  Your own OpenCode providers do the thinking. Nothing is rendered or exported here: you preview and render in Studio.
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/home-dark.png">
    <img src="docs/screenshots/home-light.png" alt="Motion Harness dashboard: describe a video, attach reference files, see projects, quality gate and runs" width="900">
  </picture>
</p>

<p align="center"><sub>The dashboard on a real workspace. Nothing is sent to a model until you press <b>Create</b>.</sub></p>

---

## What you get

<p align="center"><img src="docs/examples/world-tides-grid.jpg" alt="Four frames from the ex-world-tides example: orbit, two bulges, spinning Earth, gauge and tide curve" width="900"></p>

<p align="center"><sub>Four frames from <code>ex-world-tides</code>, built by the harness workflow: a persistent night-sky world, route HUD, captions, and a hero object in every scene.</sub></p>

- **A director's workflow, not a prompt-to-HTML shortcut.** Brief → design direction → storyboard (why each scene exists, what the viewer notices, one hero move) → plan reviews → build → quality gate → preview frames → targeted fixes → handoff. Phases are enforced by the CLI.
- **A small motion-design library.** Typography reveals, transitions, charts, image depth, audio-cue helpers, plus a *world layer*: sky, HUD, callouts, gauges, path-and-traveller, CSS-3D stage, karaoke captions.
- **Honest quality gates.** `hyperframes check` plus harness checks (structure, timing, palette, type size, determinism, scene drift, **sparse scenes with no hero object**, **near-empty frames**). Findings, not invented scores. A visual claim needs fresh frames the agent actually opened.
- **The practices Claude Code uses, built in.** Three genuinely different storylines before anything is built, hook and copy rules, measured references, brand capture from a website, stranger-eyes review with P0/P1/P2 notes and a delivery note. See [`docs/HOW-CLAUDE-MAKES-GOOD-MOTION.md`](docs/HOW-CLAUDE-MAKES-GOOD-MOTION.md) for the research and what was (and was not) implemented.
- **Prompts that don't stay thin.** *Enhance prompt* rewrites a one-line request into a brief (hook, beats with a hero object each, specifics instead of generic, look, assumptions; facts you did not give are marked `[verify: …]`) and you review it before creating. The agent also fills a required **Specifics** section in `brief.md` (what the generic film would be, what this one does instead) and never invents a statistic.
- **Your own material.** Attach a reference video (probed, sampled into frames, scene cuts detected) or raw files (imported, catalogued, checked for use).
- **Revisions that preserve work.** Each revision names the scenes it touches and logs a reason; the gate flags edits to scenes you meant to keep.

## How it works

```mermaid
flowchart LR
  A["Brief + reference video / raw files / brand website"] --> S["Three storylines: pick one"]
  S --> B["Design direction + storyboard"]
  B --> C["Plan reviews"]
  C --> D["Build HyperFrames project"]
  D --> E["Quality gate"]
  E --> F["Look at frames as a stranger: P0/P1/P2 notes"]
  F -- "specific defects" --> D
  F --> G["Handoff to HyperFrames Studio + REVIEW.md"]
```

Everything the agent does goes through `mh_*` tools that wrap one CLI (`harness/mh.mjs`), so the same state files and checks work from the dashboard, from OpenCode, or from a terminal.

## The dashboard

Double-click **`Start Dashboard.cmd`** (or run `node dashboard/server.mjs`) and open <http://127.0.0.1:4177>.

It connects to OpenCode the way [Leadsmith](https://github.com/HariNayan/Leadsmith) does: there is no server API. It runs the CLI headless (`opencode run --format json --agent motion-director`) from this folder and streams the steps into a live log.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/projects.png" alt="Projects table with thumbnails, phase, quality gate and frame evidence"><br><sub><b>Projects.</b> Phase, gate result and frame evidence at a glance.</sub></td>
    <td width="50%"><img src="docs/screenshots/project-overview.png" alt="Project overview with preview contact sheet, details, concept and palette, and a revise box"><br><sub><b>A project.</b> Preview frames, details, design system, and <i>Revise with OpenCode</i>.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/project-storyboard.png" alt="Storyboard tab: five scene cards with why it exists, hero object and hero move"><br><sub><b>Storyboard.</b> Every scene states why it exists and its hero object.</sub></td>
    <td><img src="docs/screenshots/project-quality.png" alt="Quality tab: gate findings and the 12-item checklist with evidence notes"><br><sub><b>Quality.</b> Gate findings and a checklist where every judgement carries its evidence.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/connection.png" alt="Connection page: OpenCode version, providers, agent status and model picker"><br><sub><b>Connection.</b> OpenCode status, providers (names only, never keys) and model.</sub></td>
    <td><img src="docs/screenshots/home-dark.png" alt="Dashboard in dark mode"><br><sub><b>Light, dark or auto.</b></sub></td>
  </tr>
</table>

**Enhance prompt.** Press it under the prompt box to have your OpenCode model rewrite the request into a specific brief that uses the format, depth, look, brand site and attached files you chose. It runs a read-only `brief-writer` agent that cannot write files, run commands or build anything, takes about 30 seconds on a small model, and costs one short model call. **Undo enhance** restores your original text. A failed or empty answer never replaces your prompt.

**Run again.** Every finished run keeps its request. On a run's page, **Run again** repeats it with the same brief, options, files and model (a taken project name becomes `name-2`), and **Edit & run again** opens Home with everything filled in so you can change it first. Uploads are kept for 3 days, and only one job runs at a time. A run that creates no project, or stops right after a failed tool call, is shown as **Ended early**, not Done.

**Storylines.** Choose *Let me pick the storyline* on Home and the agent stops after writing three different films; read them in the project's **Storylines** tab and press *Build this one*. The **Review** tab shows the stranger-eyes notes and the delivery note.

**Reference video and raw files.** Use *Attach reference video or files* (or drop files on the prompt box). Files stream into `inbox/` (up to 4 GB each; executables are refused). Mark each as a **Reference** (look, pacing, structure; analysed, never copied) or a **Raw asset** (real material to use in the video). The agent imports them with `mh_importfile`: reference videos are probed, sampled into 8 frames and scanned for scene cuts (approximate times; easing curves are not measurable), and raw assets are copied to `assets/source/`. The gate warns about imported assets no scene uses. The project's **Files** tab shows both.

**Safety.** Local only: it binds to `127.0.0.1` and rejects non-loopback `Host` headers and cross-origin POSTs. Project names and model ids are validated, and the brief goes on stdin, never through a shell. The agent's permissions in `opencode.jsonc` deny `hyperframes render`, `publish`, cloud renders and `ffmpeg`.

> Preview frames are git-ignored because they are regenerated, so a fresh clone shows no thumbnails until you press *Capture frames* on a project.

## Example videos

| Project | Style | What it shows |
| --- | --- | --- |
| **`ex-world-tides`** | Dense, persistent world (the quality bar) | Night-sky world, HUD, captions with *synthetic* word timing, CSS-3D Earth, gauge and tide curve |
| **`ex-data-vertical`** | Swiss data poster, 9:16 | Counter, bar chart with peak highlight, slat transitions |
| **`ex-editorial`** | Flat editorial, 16:9 | Heavy type, colour-block wipes, a drawn diagram (deliberately minimal) |

<table>
  <tr>
    <td><img src="docs/examples/data-vertical-1.jpg" height="300" alt="Vertical data poster: counter"></td>
    <td><img src="docs/examples/data-vertical-2.jpg" height="300" alt="Vertical data poster: bars with the peak highlighted"></td>
    <td><img src="docs/examples/data-vertical-3.jpg" height="300" alt="Vertical data poster: closing line"></td>
    <td><img src="docs/examples/editorial-2.jpg" height="300" alt="Editorial: two bulges diagram"></td>
  </tr>
</table>

Also included: `smoke-primitives` (exercises library primitives no real project used) and three of HyperFrames' own shipped examples, adopted with `mh adopt` so the same gate runs on them. [`eval/ACCEPTANCE-REPORT.md`](eval/ACCEPTANCE-REPORT.md) lists the actual gate findings per project.

## Quick start

Needs Node (developed on 24), [OpenCode](https://opencode.ai) (`npm install -g opencode-ai`, then `opencode auth login`), and FFmpeg on `PATH`. On Windows the dashboard adds System32 and the PowerShell folder to the PATH it gives OpenCode, because OpenCode's skill tool starts `powershell.exe`.

```bash
# the dashboard
node dashboard/server.mjs            # http://127.0.0.1:4177

# or from OpenCode (the motion-director agent is the default in this folder)
opencode                             # then:  /motion-new 30 second explainer on ...

# or the CLI directly
node harness/mh.mjs new my-film --format horizontal --depth high
node harness/mh.mjs preset my-film night-sky     # dense persistent-world design system
node harness/mh.mjs lint my-film                 # plan lint
node harness/mh.mjs gate my-film                 # hyperframes check + harness checks
node harness/mh.mjs frames my-film               # preview stills (not a render)
node harness/mh.mjs storylines my-film pick b    # pick one of the three storylines
node harness/mh.mjs review-done my-film --summary "…" --weakest "…" --unchecked "…"
node harness/mh.mjs studio my-film               # start the HyperFrames Studio preview
```

## Quality gate and depth

| Depth | Plan reviews | Revision limit | Frame evidence |
| --- | --- | --- | --- |
| `draft` | 1 | 3 | optional |
| `standard` | 2 | 5 | recommended |
| `high` | 3 | 8 | required |

Higher depth buys more planning and verification, not more effects. A deliberately sparse look (flat editorial, Swiss poster) is allowed only with `designSystem.density: "minimal"` and a written reason.

## Repository layout

```
dashboard/        local web app: server.mjs, public/ (UI), test/ (stub-OpenCode integration tests)
harness/mh.mjs    the CLI: phases, plan lint, gate, frames, import, revisions, checklist, handoff
harness/craft.mjs storylines, copy and hook rules, review notes, assertions, compare, capture, REVIEW.md
motion-lib/       mh-motion.* primitives, mh-world.* world layer, presets/night-sky.json   (see motion-lib/README.md)
.opencode/        motion-director, motion-critic and brief-writer agents, /motion-* commands, mh_* tools
opencode.jsonc    default agent and permissions (no render / publish / ffmpeg)
AGENTS.md         the agent's operating procedure and rules
harness.config.json, templates/   depth presets, formats, planning templates
projects/<slug>/  HyperFrames projects; harness state in .mh/ (brief, direction, storyboard, decisions, revisions, checklist)
eval/             acceptance runner, report, model-testing protocol   (see eval/README.md)
docs/             README images, and HOW-CLAUDE-MAKES-GOOD-MOTION.md (the research behind the workflow)
```

## Limits (read before relying on it)

- **Model quality decides the result.** The dashboard and tools are tested against a stub. The only real runs so far used small free models and ended early (one on a tool-wrapper bug that is now fixed), so no finished film has been produced end to end by a model here; the workflow depends on your model's planning and on it actually opening frames, and a stronger model is recommended. Reference analysis needs a **vision-capable** model. The protocol for measuring a model is in [`eval/README.md`](eval/README.md).
- **Nothing is rendered by this repo.** Visual claims rest on snapshot frames, and the examples carry no audio (captions use labelled synthetic timing).
- Scripted layers (sky, HUD, captions) are built from data, so Studio cannot edit them as plain HTML.
- Studio edits change files the harness has locked; run `mh lock` or log a revision afterwards.
- One dashboard job runs at a time.

## Credits

Built on [HyperFrames](https://hyperframes.heygen.com) and [OpenCode](https://opencode.ai). The dashboard's design language and its way of connecting to a coding agent follow [Leadsmith](https://github.com/HariNayan/Leadsmith).
