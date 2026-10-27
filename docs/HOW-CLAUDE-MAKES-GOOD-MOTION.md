# How Claude makes good motion graphics, and what this tool took from it

Researched on 2026-10-27 from public write-ups, HeyGen's HyperFrames docs, and the HyperFrames skill that Claude Code loads (`~/.claude/skills/hyperframes`). Most web sources are third-party blog posts and demos, not controlled tests: **no benchmark was found that compares animation quality with and without a skill.** Treat the claims below as reported practice, not measured results.

## What the sources say

**The mechanism.** Claude does not generate pixels. It writes a *program that draws each frame* (HTML plus a paused GSAP timeline in HyperFrames, or React in Remotion), then frames are rendered and stitched ([Sébastien Dubois's write-up, quoting Addy Osmani](https://www.dsebastien.net/2026-10-04-claude-opus-5-5-ask-for-a-video-get-a-program-you-can-edit/)). That makes every frame a function of time, so a fix is one changed line and everything else stays.

**What reportedly makes the output good**
- Skills that carry rules, installed once, instead of ever-longer prompts: HyperFrames' own skill, and a motion-graphics skill pack ([same write-up](https://www.dsebastien.net/2026-10-04-claude-opus-5-5-ask-for-a-video-get-a-program-you-can-edit/)); Remotion ships official agent skills too ([Remotion docs](https://www.remotion.dev/docs/ai/skills)).
- Brand context and references up front: a one-line brief produced a convincing showreel because the model read the public design system first; the first render is "structurally close", then refined ([Claude Code for Marketers](https://claudecodeformarketers.com/blog/motion-graphics-with-hyperframes/)).
- Subjects that have a mathematical description (geometry, motion, structure, timing) work best.
- A review-and-refine loop, never one prompt: "You are refining, never starting over."

**HyperFrames' own prompting guidance** ([overview](https://hyperframes.heygen.com/prompting/overview.md), [motion](https://hyperframes.heygen.com/prompting/motion.md), [recreating references](https://hyperframes.heygen.com/prompting/recreating-references.md))
- Beats with timestamps; exact on-screen copy; name the technique where the default might fail; state negatives.
- Iterate like an editor: **one variable per edit, freeze what works, absolute targets instead of relative nudges, layer one element at a time, strip and rebuild when a scene keeps failing.**
- Motion: land then hold; overlap; one property per idea; overshoot on objects only; depth through speed; 3–5 caused transition types; Three.js via the adapter for real depth.
- References: transcribe the motion with timestamps, sample hex colours, correct one axis at a time; expect ~75% first, ~80–90% after distilling a spec; continuous qualities (bloom, material feel) are not recoverable from text.

**What Claude Code's HyperFrames skill enforces** (read from its reference files)
- `story.md`: one thing to remember; **three storylines that are three different films** (own world, device, form) before building; the hook (frame 0 is the thumbnail, never "Introducing"); beat shares; copy rules; the tells of a generated film.
- `spec.md` / `look.md`: every adjective becomes a number; banned defaults by name; brand from a captured website or a reference, not from the model's habits.
- `motion.md`: ease by role (not one curve), exits 40–50% shorter than entrances, stagger values, dead-still titles after landing, measured transition recipes, `motion.json` assertions that `check` verifies.
- `review.md`: measure first (`check`), then look as a **harsh director, not a proud author**: describe each beat as a stranger, file P0/P1/P2 notes (`t · where · problem → exact change · what stays`), fix P0 first, never score out of 10, write a delivery note (`REVIEW.md`: creative calls, what was measured vs looked at, weakest shot, what nobody checked).

## What was implemented here

| Practice | In this tool |
| --- | --- |
| Three different storylines, then one | `.mh/storylines.json` + `mh storylines pick`; validated (exactly three, distinct device/form); **required at high depth** before the direction can advance; `STORYLINES.md`; dashboard **Storylines** tab and a "let me pick the storyline" mode (the run stops, you choose, a follow-up run builds it) |
| Hook and copy rules | plan lint: banned marketing words (error), long lines, `in seconds` unmeasured, "Introducing/Meet" opener, required `first2s` for the first scene |
| Motion craft numbers | `AGENTS.md` carries them; source scan warns on bounce easing and on one ease used everywhere |
| Stranger-eyes review | `mh describe` per beat (required at high depth), `mh note` P0/P1/P2 (open P0 blocks handoff), `mh review-done` (weakest shot, creative calls, what nobody checked), generated **REVIEW.md**; dashboard **Review** tab |
| Tells go on the BANNED line | `mh ban` appends to the project's anti-patterns |
| Reference recreation by measurement | reference videos get a **measured palette from pixels**, sampled frames and detected cuts; `mh compare` renders render-vs-reference sheets at the same times |
| Brand from a real source | `mh capture <url>` (HyperFrames' capture: screenshots, tokens, fonts, visible copy); dashboard "brand website" field |
| Assert intent, don't eyeball | storyboard `assertions` → `index.motion.json` (with scene-local times converted to film time); verified: `hyperframes check` reported `motion_appears_late` for a deliberately wrong one |
| Iterate like an editor | `AGENTS.md` iteration rules; `mh revise` names touched scenes and the gate flags drift in the rest |

Tests: `node harness/test/craft-tests.mjs` (25 checks) and `node dashboard/test/run-tests.mjs` (49 checks, stub OpenCode, no model).

## What was not implemented (and why)

- **Three.js stage helper.** HyperFrames recommends Three.js (via its adapter) for real depth; our `MH.world.stage3d` is CSS 3D, which can look flat on a hero object. The skill's `references/runtimes.md` explains the adapter; a wrapper in `motion-lib` is future work.
- **Render-time motion blur** (`data-motion-blur`) and registry blocks are left to the agent via the HyperFrames skills; nothing enforces them.
- **A real voice or music bed.** The `hf.craft.film_silent` warning stays on silent examples by design.
- **Any measurement that the new steps improve quality.** They encode what Claude Code's own skill does and what the guides recommend; whether the *configured OpenCode model* follows them well is untested (see `eval/README.md`).
