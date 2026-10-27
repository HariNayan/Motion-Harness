# Handoff — ex-world-tides

Format horizontal, depth high. Revisions used: 3.

**Open in HyperFrames Studio:** run `npx hyperframes@0.8.207 preview "D:\Bholu\Freelane VE\Website\motion-harness\projects\ex-world-tides"` (or `mh studio ex-world-tides`). Preview and final render are yours to run there; the harness does not render.

## Evidence level
- Visual evidence: **fresh** (snapshot frames were captured and inspected after the last edit)

## Checklist (actual findings)
- **opening** — pass (visual): Frame 0.3s (review-beats) and 4.2s (settled): night-sky world, HUD title, gold TWO already readable at frame 0, Earth with orbit; subject and visual identity clear. Orbit/moon seen at 0.3s, 2.5s, 4.2s.
- **narrative** — pass (visual): Settled frames 4.2/9.9/16.4/22.9/27.16s: orbit + two tides -> two labelled bulges -> Earth spinning under them with elapsed hours -> gauge/curve at 12.4 h -> three summary cards + closing line. Captions at those frames read as the narration of each beat (synthetic timing).
- **scene-purpose** — pass (automatic): every scene has purpose + viewerShouldNotice; none flagged generic
- **variation** — pass (visual): Five different hero objects (orbit path, CSS-3D Earth with callouts, top-down spinning Earth, gauge + tide curve, three cards); five layouts per storyboard. Same sky/HUD/captions throughout by design.
- **typography** — pass (visual): Montserrat headings, JetBrains Mono values, Poppins notes legible in all settled frames; hyperframes craft check reports no text under 28px after the size revision. Not checked: phone-width review strip (review-phone.jpg) was not opened.
- **transitions** — pass (visual): Cloud-bank sweep seen mid-pass at 5.3/11.3/18.3/24.3s; after the fix it no longer clips content at rest (frames 0.3s, 14s clean). Exact moment of full coverage at each cut was not captured.
- **timing** — pass (automatic): hosts contiguous, 9 scene(s) match storyboard
- **clipping** — pass (visual): No clipped text in settled frames; hyperframes layout check 0 errors. Remaining visual nit: the leader line of the 12.4 h callout crosses the top of the second HIGH label (22.9s).
- **assets** — pass (source): No external assets; Earth, Moon, gauge, curve, icons all drawn (SVG/CSS 3D). Captions use synthetic word timing, disclosed in the brief; there is no audio.
- **arc** — pass (automatic): roles open with hook/context and close with payoff/resolution/cta
- **effects** — pass (source): Source scan clean (no glow classes beyond the single sky light wash, no unlogged drift). Every tween maps to the storyboard hero move, callout or caption.
- **technical** — pass (automatic): hyperframes check + lint + structure: no errors

## Gate counts
0 errors, 1 warnings
- hf.craft.film_silent [index]: This 28 s film has no sound source (no <audio>, no <video> with sound): add a music bed and sounds on the visible actions unless the person asked for silence; see references/sound.md. @0s

