# Handoff — ex-data-vertical

Format vertical, depth standard. Revisions used: 0.

**Open in HyperFrames Studio:** run `npx hyperframes@0.8.207 preview "D:\Bholu\Freelane VE\Website\motion-harness\projects\ex-data-vertical"` (or `mh studio ex-data-vertical`). Preview and final render are yours to run there; the harness does not render.

## Evidence level
- Visual evidence: **fresh** (snapshot frames were captured and inspected after the last edit)

## Checklist (actual findings)
- **opening** — pass (visual): Frame 0.3s shows the 560px counter on light ground; frame 1.8s adds the red rule and label. Subject (cups at 8 am) is identifiable by 1.8s; frame 0 shows only a mid-count number.
- **narrative** — pass (visual): Beat frames: 412 -> bars by hour with 8am highlighted (frame 6.8s) -> STAFF FOR 8 AM, NOT 2 PM. Claim, evidence, decision in order.
- **scene-purpose** — pass (automatic): every scene has purpose + viewerShouldNotice; none flagged generic
- **variation** — pass (visual): Light poster number scene, light ruled chart scene, then solid ink slab; three different layouts.
- **typography** — pass (visual): Oswald numerals/headlines and Inter labels legible in frames; dimmed labels in 6.8s frame are low contrast by design (peak focus) but still readable. Not checked: phone-width strip not opened.
- **transitions** — pass (visual): Slats seen mid-retract at 3.4s and 7.4s; same device both times (ink slats on light, light slats on ink).
- **timing** — pass (automatic): hosts contiguous, 3 scene(s) match storyboard
- **clipping** — pass (visual): hyperframes check layout: 0 errors/warnings. Frames show text inside x>=108 and above y 1500. Observation: chart ends near y 1240, leaving a large empty lower third (inside the platform keep-out margin); not changed.
- **assets** — pass (source): No external assets; sample data labelled as sample in the brief.
- **arc** — pass (automatic): roles open with hook/context and close with payoff/resolution/cta
- **effects** — pass (source): Source scan clean: no glow/blur; dimming of non-peak bars is the only secondary effect and serves focus.
- **technical** — pass (automatic): hyperframes check + lint + structure: no errors

## Gate counts
0 errors, 0 warnings

