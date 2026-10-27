# Handoff — ex-editorial

Format horizontal, depth standard. Revisions used: 2.

**Open in HyperFrames Studio:** run `npx hyperframes@0.8.207 preview "D:\Bholu\Freelane VE\Website\motion-harness\projects\ex-editorial"` (or `mh studio ex-editorial`). Preview and final render are yours to run there; the harness does not render.

## Evidence level
- Visual evidence: **fresh** (snapshot frames were captured and inspected after the last edit)

## Checklist (actual findings)
- **opening** — pass (visual): Frame at 0.3s (review-beats, before the s2 revision; s1 unchanged since) shows amber TWO and teal ground already on screen; subject and palette identifiable at frame 0.
- **narrative** — pass (visual): Beat frames show hook (TWO TIDES) -> diagram (2 BULGES with near/far labels) -> 12.4h -> The Moon sets the clock; the claim, cause, number and takeaway follow in order.
- **scene-purpose** — pass (automatic): every scene has purpose + viewerShouldNotice; none flagged generic
- **variation** — pass (visual): Grounds teal / deep teal / amber / teal and four different layouts seen in review-beats; hero move differs per scene (reveal, ellipse growth, counter, line reveal).
- **typography** — pass (visual): Archivo Black headlines 150-440px and Inter 40-64px labels read clearly in frame 5.9s and review-beats; ink/ground contrast passed hyperframes contrast check. Not checked: phone-width strip (review-phone.jpg) was not opened.
- **transitions** — pass (visual): Same left-to-right ground wipe at all three seams (seen mid-wipe in review-beats frames 3, 5, 7); each incoming scene has a different ground so the wipe is legible.
- **timing** — pass (automatic): hosts contiguous, 4 scene(s) match storyboard
- **clipping** — pass (visual): hyperframes check layout reports 0 errors/warnings; frames show all text inside margins. Mask overflow is intentional (data-layout-allow-overflow).
- **assets** — pass (source): No external assets; all graphics are inline SVG/CSS drawn for the subject (no stock imagery).
- **arc** — pass (automatic): roles open with hook/context and close with payoff/resolution/cta
- **effects** — pass (source): Source scan: no glow/blur/particles, no unlogged scene drift; every tween maps to the storyboard hero move or secondary callout.
- **technical** — pass (automatic): hyperframes check + lint + structure: no errors

## Gate counts
0 errors, 0 warnings

