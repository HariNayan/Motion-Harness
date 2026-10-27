# Acceptance report

Generated 2026-10-27T06:29:05.825Z by eval/run-acceptance.mjs. Findings are copied from each project's .mh/gate-report.json; nothing here is a score.
| project | format | origin | gate errors | gate warnings | visual evidence |
| --- | --- | --- | --- | --- | --- |
| ex-data-vertical | vertical | built through the harness workflow | 0 | 0 | fresh |
| ex-editorial | horizontal | built through the harness workflow | 0 | 0 | fresh |
| ex-world-tides | horizontal | built through the harness workflow | 0 | 1 | fresh |
| hf-kinetic-type | horizontal | adopted: hyperframes example: kinetic-type | 0 | 10 | none |
| hf-nyt-graph | horizontal | adopted: hyperframes example: nyt-graph | 1 | 4 | fresh |
| hf-swiss-grid | horizontal | adopted: hyperframes example: swiss-grid | 4 | 9 | fresh |
| smoke-primitives | horizontal | adopted: hyperframes example: blank | 0 | 3 | fresh |


## ex-data-vertical

- Origin: built through the harness workflow
- Format: vertical; phase: handoff; revisions logged: 0
- Gate (2026-10-27T06:29:17.689Z): 0 error(s), 0 warning(s), 5 note(s)
- Visual evidence: **fresh** (3 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 12 pass

## ex-editorial

- Origin: built through the harness workflow
- Format: horizontal; phase: handoff; revisions logged: 2
- Gate (2026-10-27T06:29:30.782Z): 0 error(s), 0 warning(s), 7 note(s)
- Visual evidence: **fresh** (3 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 12 pass

## ex-world-tides

- Origin: built through the harness workflow
- Format: horizontal; phase: handoff; revisions logged: 3
- Gate (2026-10-27T06:29:53.454Z): 0 error(s), 1 warning(s), 1 note(s)
- Visual evidence: **fresh** (37 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 12 pass

Findings:
- WARN `hf.craft.film_silent` [index]: This 28 s film has no sound source (no <audio>, no <video> with sound): add a music bed and sounds on the visible actions unless the person asked for silence; see references/sound.md. @0s

## hf-kinetic-type

- Origin: adopted: hyperframes example: kinetic-type
- Format: horizontal; phase: verify; revisions logged: 0
- Gate (2026-10-27T06:30:14.315Z): 0 error(s), 10 warning(s), 8 note(s)
- Visual evidence: **none**
- Checklist: 8 unreviewed, 3 pass, 1 fail

Findings:
- WARN `hf.layout.container_overflow` [main-graphics]: Element extends outside a clipping layout container. @2.5s  Fix: Resize/reposition the child or container, or mark intentional overflow with data-layout-allow-overflow.
- WARN `hf.craft.first_frame_empty` [index]: Frame 0 shows only the background, and the first frame is the thumbnail on social players: have the title or key image already on screen at 0 s instead of entering from nothing; see references/review.md. @0s
- WARN `hf.craft.text_below_floor` [main-graphics]: Type floor is 28 px (2.6% of the 1080 px short side, what a phone can read) and 2 text elements stay under it for 0.5 s or more, the smallest "all generated from a single prompt" at 22 px: set reading text to at least 28 px, or put data-layout-ignore on text that is texture rather than reading; see 
- WARN `hf.craft.line_unread` [main-graphics]: "Just describe the motion" (4 words) is on screen 1.00 s (±0.01 s), under its 1.27 s floor: hold it about 0.5 s + 0.3 s a word (1.70 s here) before it leaves or changes; see references/motion.md. @12.172s
- WARN `hf.craft.line_unread` [main-graphics]: The film's last line "HyperFrames" (1 word) is on screen 1.04 s (±0.01 s), under the 2.00 s a closing line needs: hold it about 0.5 s + 0.3 s a word and at least 2 s before the film ends; see references/motion.md. @13.969s
- WARN `hf.craft.line_unread` [main-graphics]: The film's last line "is here." (2 words) is on screen 0.83 s (±0.01 s), under the 2.00 s a closing line needs: hold it about 0.5 s + 0.3 s a word and at least 2 s before the film ends; see references/motion.md. @14.172s
- WARN `struct.ids` [main-graphics]: host id "graphics-layer", composition id "main-graphics" and file "main-graphics" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safe
- WARN `src.fontsize` [main-graphics]: font-size 24px < minimum 28px for this format (ignore only for decorative micro-labels)
- WARN `src.busy` [main-graphics]: 45 tweens in one scene — is every movement meaningful?
- WARN `evidence.none`: no preview frames captured — any statement about appearance is source-based only

## hf-nyt-graph

- Origin: adopted: hyperframes example: nyt-graph
- Format: horizontal; phase: verify; revisions logged: 0
- Gate (2026-10-27T06:30:31.353Z): 1 error(s), 4 warning(s), 3 note(s)
- Visual evidence: **fresh** (7 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 8 unreviewed, 2 pass, 2 fail

Findings:
- WARN `hf.lint.composition_file_too_large` [nyt-chart]: This HTML composition file has 332 lines. Smaller sub-compositions are easier to read, iterate on, and diff. @0s  Fix: Split this sub-composition further into smaller .html files, then mount them from the parent with data-composition-src so each file stays small enough to inspect, revise, and valida
- WARN `hf.craft.text_below_floor` [nyt-chart]: Type floor is 28 px (2.6% of the 1080 px short side, what a phone can read) and 22 text elements stay under it for 0.5 s or more, the smallest "Source: Internal analytics" at 13 px: set reading text to at least 28 px, or put data-layout-ignore on text that is texture rather than reading; see referen
- WARN `struct.ids` [nyt-chart]: host id "nyt-chart-comp", composition id "nyt-chart" and file "nyt-chart" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safest
- WARN `src.fontsize` [nyt-chart]: font-size 16px < minimum 28px for this format (ignore only for decorative micro-labels)
- ERROR `src.nondeterministic` [nyt-chart]: non-deterministic/forbidden API

## hf-swiss-grid

- Origin: adopted: hyperframes example: swiss-grid
- Format: horizontal; phase: verify; revisions logged: 0
- Gate (2026-10-27T06:30:47.123Z): 4 error(s), 9 warning(s), 16 note(s)
- Visual evidence: **fresh** (13 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 8 unreviewed, 2 pass, 2 fail

Findings:
- ERROR `hf.layout.clipped_text` [captions]: Text content is clipped by its own box. @0.556s  Fix: Text is 1077px x 72px inside 1077px x 72px and overflows by up to 7px; increase the text box height to at least ~79px, or allow wrapping with max-width/fitTextFontSize.
- ERROR `hf.layout.clipped_text` [captions]: Text content is clipped by its own box. @3.889s  Fix: Text is 1600px x 72px inside 1600px x 72px and overflows by up to 16px; resize the text box to at least ~1616px x 79px, or allow wrapping with max-width/fitTextFontSize.
- ERROR `hf.layout.clipped_text` [captions]: Text content is clipped by its own box. @6.111s  Fix: Text is 1283px x 72px inside 1283px x 72px and overflows by up to 7px; increase the text box height to at least ~79px, or allow wrapping with max-width/fitTextFontSize.
- WARN `hf.layout.container_overflow` [graphics]: Element extends outside a clipping layout container. @0.556s  Fix: Resize/reposition the child or container, or mark intentional overflow with data-layout-allow-overflow.
- WARN `hf.contrast.contrast_aa_failure` [graphics]: Contrast is 2.12:1; WCAG AA requires 3:1. @2.778s
- ERROR `hf.contrast.contrast_aa_failure` [graphics]: Contrast is 2.12:1; WCAG AA requires 3:1. @5s
- WARN `hf.contrast.contrast_aa_failure` [graphics]: Contrast is 2.12:1; WCAG AA requires 3:1. @9.444s
- WARN `hf.craft.text_below_floor` [graphics]: Type floor is 28 px (2.6% of the 1080 px short side, what a phone can read) and 3 text elements stay under it for 0.5 s or more, the smallest "NEED MOTION GRAPHICS" at 24 px: set reading text to at least 28 px, or put data-layout-ignore on text that is texture rather than reading; see references/loo
- WARN `hf.craft.line_unread` [graphics]: The film's last line "3 OF 4" (3 words) is on screen 1.07 s (±0.01 s), under the 2.00 s a closing line needs: hold it about 0.5 s + 0.3 s a word and at least 2 s before the film ends; see references/motion.md. @8.938s
- WARN `struct.ids` [intro]: host id "intro-comp", composition id "intro" and file "intro" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safest
- WARN `struct.ids` [graphics]: host id "graphics-comp", composition id "graphics" and file "graphics" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safest
- WARN `struct.ids` [captions]: host id "captions-comp", composition id "captions" and file "captions" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safest
- WARN `src.fontsize` [graphics]: font-size 24px < minimum 28px for this format (ignore only for decorative micro-labels)

## smoke-primitives

- Origin: adopted: hyperframes example: blank
- Format: horizontal; phase: verify; revisions logged: 0
- Gate (2026-10-27T06:30:59.233Z): 0 error(s), 3 warning(s), 4 note(s)
- Visual evidence: **fresh** (3 frame files in .mh/frames; a human or agent must still open them)
- Checklist: 8 unreviewed, 4 pass

Findings:
- WARN `hf.lint.nested_structure_needs_subcomposition` [index]: <div id="b-frame"> is a timeline element that contains nested <div id="b-far">. The timeline shows one row per top-level element, and the root composition is built only from sub-compositions. @0s  Fix: Move <div id="b-frame"> and its contents into a sub-composition file and mount it with data-compos
- WARN `hf.lint.nested_structure_needs_subcomposition` [index]: <div id="d-rules"> is a timeline element that contains nested <div>. The timeline shows one row per top-level element, and the root composition is built only from sub-compositions. @0s  Fix: Move <div id="d-rules"> and its contents into a sub-composition file and mount it with data-composition-src.
- WARN `hf.craft.line_unread` [index]: The film's last line "callout label" (2 words) is on screen 1.67 s (±0.01 s), under the 2.00 s a closing line needs: hold it about 0.5 s + 0.3 s a word and at least 2 s before the film ends; see references/motion.md. @7.336s
