# Creative brief — ex-world-tides

Quality-bar example: the *density* of a dense explainer (persistent world, HUD, hero object per beat, karaoke captions), applied to a new subject. Not a copy of any existing edit.

- **Subject / message:** Why there are two high tides a day, and why they are about 12.4 hours apart.
- **Audience & where it plays:** curious general audience, 16:9 explainer (inferred).
- **Format:** horizontal (1920x1080), 28 s, 30 fps.
- **Look:** the `night-sky` preset: navy sky with parallax cloud bands, one gold focal accent, panels with a gold bar, route HUD, captions.
- **Must include:** near-side and far-side bulge; Earth spinning under the bulges (one lunar day = 24 h 50 min, two highs); the 12.4 h interval; closing line "The Moon sets the clock".
- **Supplied assets:** none; everything drawn (SVG/CSS 3D).
- **Audio:** NONE. Karaoke captions use SYNTHETIC word timing generated from the script at a steady speaking rate (assets/transcript.synthetic.json). With a real voiceover, replace it via `hyperframes transcribe` then `mh cues`.
- **Facts used:** Moon distance about 384,400 km (mean); successive high tides about 12 h 25 min apart (12.4 h); lunar day 24 h 50 min (24.8 h).
- **Hard constraints:** no photos or stock footage; panels and instruments sit on the shared sky, never a different environment.
