#!/usr/bin/env node
// mh — motion harness CLI. Plans, persists, gates and hands off HyperFrames projects.
// It never renders. Rendering is the user's call in HyperFrames Studio.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { craft } from "./craft.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "harness.config.json"), "utf8"));
const HF = `hyperframes@${CFG.hyperframes}`;
const PHASES = ["brief", "direction", "storyboard", "review", "build", "verify", "handoff"];

/* ------------------------------------------------------------------ utils */
const out = (s = "") => console.log(s);
const die = (s) => { console.error("mh: " + s); process.exit(1); };
const rj = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8").replace(/^﻿/, "")); } catch { return d; } }; // tolerate a BOM from Notepad/PowerShell
const wj = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); };
const now = () => new Date().toISOString();
const hash = (p) => crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex").slice(0, 12);
const append = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, JSON.stringify({ at: now(), ...o }) + "\n"); };
const readLines = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

function parseArgs(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt !== undefined && !nxt.startsWith("--")) { flags[k] = nxt; i++; } else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

function proj(slug) {
  if (!slug) die("project slug required");
  const dir = path.isAbsolute(slug) ? slug : path.join(ROOT, "projects", slug);
  if (!fs.existsSync(path.join(dir, ".mh", "state.json"))) die(`not a harness project: ${dir}`);
  const mh = path.join(dir, ".mh");
  return {
    dir, mh, slug: path.basename(dir),
    state: rj(path.join(mh, "state.json")),
    saveState(s) { this.state = s; wj(path.join(mh, "state.json"), s); },
    direction: () => rj(path.join(mh, "direction.json")),
    storyboard: () => rj(path.join(mh, "storyboard.json")),
    manifest: () => rj(path.join(mh, "manifest.json"), { scenes: {} }),
    saveManifest: (m) => wj(path.join(mh, "manifest.json"), m),
    decisions: path.join(mh, "decisions.jsonl"),
    revisions: path.join(mh, "revisions.jsonl"),
    fmt() { return CFG.formats[this.state.format]; },
  };
}

// share of pixels sitting on a strong edge (192x108 gray). Smooth sky/gradient = ~0, text/panels/objects = several %.
function frameEdgeFraction(file) {
  const W = 192, H = 108;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale=" + W + ":" + H + ":flags=area", "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  const b = r.stdout; if (!b || b.length < W * H) return null;
  let n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (Math.abs(b[i + 1] - b[i - 1]) + Math.abs(b[i + W] - b[i - W]) > 28) n++; }
  return +((100 * n) / (W * H)).toFixed(2);
}

function hf(args, cwd) {
  // one command string (paths here contain spaces); quote every argument that needs it
  const q = (a) => (/[\s"&|<>^]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : a);
  const r = spawnSync(["npx", "--yes", HF, ...args].map(q).join(" "), { cwd, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/* -------------------------------------------------------------- color math */
function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(h || "").trim());
  if (!m) return null;
  let s = m[1]; if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const A = lum(a), B = lum(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); }
function hue([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return { h: 0, s: 0 };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1) || 1) };
}

/* ------------------------------------------------------------ plan linting */
const GENERIC_PURPOSE = /^(intro|outro|transition|filler|b-?roll|show|display|title|text|scene)\b/i;
const BANNED_WORDS = /\b(glow|glowing|neon|bloom|lens flare|floating particles?|glass ?card|glassmorphism|mesh gradient|orb)\b/i;
const wc = (arr) => (arr || []).join(" ").split(/\s+/).filter(Boolean).length;

export function lintPlan(P) {
  const F = []; // findings
  const add = (level, code, msg, scene) => F.push({ level, code, scene: scene || undefined, msg });
  const d = P.direction(), sb = P.storyboard(), fmt = P.fmt();
  if (!d) { add("error", "direction.missing", "direction.json missing"); return F; }
  if (!sb) { add("error", "storyboard.missing", "storyboard.json missing"); return F; }
  const todo = (o, p = "") => {
    for (const [k, v] of Object.entries(o || {})) {
      if (typeof v === "string" && /\bTODO\b/.test(v)) add("error", "todo.left", `placeholder left at ${p}${k}`);
      else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "string" ? /\bTODO\b/.test(x) && add("error", "todo.left", `placeholder at ${p}${k}[${i}]`) : todo(x, `${p}${k}[${i}].`)));
      else if (v && typeof v === "object") todo(v, `${p}${k}.`);
    }
  };
  todo(d, "direction."); todo(sb, "storyboard.");

  // ---- direction document completeness
  const need = { "concept": d.concept, "narrativeArc.beginning": d.narrativeArc?.beginning, "narrativeArc.middle": d.narrativeArc?.middle, "narrativeArc.end": d.narrativeArc?.end,
    "designSystem.typography.display.family": d.designSystem?.typography?.display?.family, "designSystem.typography.body.family": d.designSystem?.typography?.body?.family,
    "designSystem.typography.hierarchy": d.designSystem?.typography?.hierarchy, "designSystem.palette.ground": d.designSystem?.palette?.ground,
    "designSystem.palette.ink": d.designSystem?.palette?.ink, "designSystem.palette.accent": d.designSystem?.palette?.accent, "designSystem.accentRule": d.designSystem?.accentRule,
    "designSystem.background.treatment": d.designSystem?.background?.treatment, "designSystem.composition.margin": d.designSystem?.composition?.margin,
    "designSystem.composition.textDensity": d.designSystem?.composition?.textDensity, "designSystem.choreography.easing": d.designSystem?.choreography?.easing,
    "designSystem.transitionLanguage.primary": d.designSystem?.transitionLanguage?.primary, "designSystem.pacing.rhythm": d.designSystem?.pacing?.rhythm };
  for (const [k, v] of Object.entries(need)) if (v == null || v === "") add("error", "direction.field", `direction.${k} is empty`);
  if ((d.consistencyRules || []).length < 4) add("error", "direction.rules", "need >= 4 testable consistencyRules");
  if ((d.antiPatterns || []).length < 5) add("error", "direction.antipatterns", "need >= 5 film-specific antiPatterns");
  if (!d.assets) add("warn", "direction.assets", "assets section (images/footage/illustration/audio) missing");

  // ---- design system sanity
  const ds = d.designSystem || {}, pal = ds.palette || {}, typ = ds.typography || {};
  const fams = new Set([typ.display?.family, typ.body?.family].filter(Boolean));
  if (fams.size > 2) add("error", "ds.fonts", "more than two font families");
  for (const f of [...fams, typ.data?.family].filter(Boolean)) if (!CFG.bundledFonts.includes(f) && !typ.fontFiles?.[f]) add("warn", "ds.font.unbundled", `font "${f}" is not bundled; add typography.fontFiles["${f}"]="assets/fonts/…" and an @font-face`);
  if (typ.body?.sizePx && typ.body.sizePx < fmt.minBodyPx) add("error", "ds.type.small", `body size ${typ.body.sizePx}px < minimum ${fmt.minBodyPx}px for ${P.state.format}`);
  const g = hexToRgb(pal.ground), ink = hexToRgb(pal.ink), ac = hexToRgb(pal.accent);
  if (!g || !ink) add("error", "ds.palette", "palette.ground/ink must be 6-digit hex");
  else {
    const c = contrast(g, ink);
    if (c < 4.5) add("error", "ds.contrast", `ground/ink contrast ${c.toFixed(2)}:1 < 4.5:1`);
    if (ac && contrast(g, ac) < 3) add("warn", "ds.accent.contrast", `accent on ground only ${contrast(g, ac).toFixed(2)}:1 (<3:1 for large text)`);
    const hh = hue(g);
    if (lum(g) < 0.03 && hh.h > 200 && hh.h < 280 && !ds.background?.justifyDark)
      add("warn", "ds.banned.darkvoid", "dark navy/blue ground is a default look; set background.justifyDark with a reason tied to the subject, or change it");
  }
  const extraAccents = Object.keys(pal).filter((k) => /accent/i.test(k));
  if (extraAccents.length > 1) add("warn", "ds.accents", `multiple accent colours (${extraAccents.join(", ")}); the brief asks for controlled accent use`);
  const dScan = JSON.stringify({ ...d, antiPatterns: undefined, consistencyRules: undefined });
  if (BANNED_WORDS.test(dScan)) add("warn", "ds.banned.words", `direction mentions a banned default (${dScan.match(BANNED_WORDS)[0]}) — justify or remove`);

  // ---- storyboard
  const sc = sb.scenes || [];
  if (sc.length < CFG.depth[P.state.depth].minScenes) add("error", "sb.few", `${sc.length} scenes < ${CFG.depth[P.state.depth].minScenes} for depth ${P.state.depth}`);
  const sum = sc.reduce((a, s) => a + (s.duration || 0), 0);
  if (Math.abs(sum - sb.totalDuration) > 0.05) add("error", "sb.duration", `scene durations sum to ${sum.toFixed(2)}s but totalDuration=${sb.totalDuration}`);
  const ids = new Set();
  sc.forEach((s, i) => {
    const w = s.id;
    if (!s.id || ids.has(s.id)) add("error", "sb.id", `scene ${i} id missing or duplicate`, w); ids.add(s.id);
    for (const k of ["title", "role", "purpose", "viewerShouldNotice", "focalPoint", "layout", "heroMove", "motionPurpose", "motionWhy", "background"])
      if (!s[k]) add("error", "sb.field", `scene.${k} missing`, w);
    if (!s.transitionOut?.type || !s.transitionOut?.motivation) add(i === sc.length - 1 ? "info" : "error", "sb.transition", "transitionOut {type, motivation} missing", w);
    if (s.role && !CFG.narrativeRoles.includes(s.role)) add("error", "sb.role", `role "${s.role}" not in ${CFG.narrativeRoles.join("/")}`, w);
    if (s.layout && !CFG.layoutArchetypes.includes(s.layout)) add("warn", "sb.layout", `layout "${s.layout}" not a known archetype (${CFG.layoutArchetypes.join(", ")})`, w);
    if (s.motionPurpose && !CFG.motionPurposes.includes(s.motionPurpose)) add("error", "sb.motionPurpose", `motionPurpose must be one of ${CFG.motionPurposes.join("/")}`, w);
    if (s.purpose && (s.purpose.length < 25 || (GENERIC_PURPOSE.test(s.purpose) && s.purpose.length < 60))) add("warn", "sb.weak", "purpose is generic/short — say what the film loses without this scene", w);
    if (s.heroMove && /\band\b.*\band\b|;|,.*,/.test(s.heroMove)) add("warn", "sb.heroMove", "heroMove lists several moves; keep ONE hero move, put the rest in secondary choreography", w);
    if (BANNED_WORDS.test(JSON.stringify(s))) add("warn", "sb.banned", `scene mentions a banned default (${JSON.stringify(s).match(BANNED_WORDS)[0]})`, w);
    const words = wc(s.text), need = words ? 0.5 + 0.3 * words : 0;
    if (need > s.duration) add("error", "sb.readtime", `${words} words need >= ${need.toFixed(1)}s to read (0.5s + 0.3s/word) but the scene is ${s.duration}s`, w);
    if (s.duration && words / s.duration > fmt.maxWordsPerSec) add("warn", "sb.density", `${(words / s.duration).toFixed(1)} words/sec exceeds ${fmt.maxWordsPerSec} for ${P.state.format}`, w);
    if (s.duration && s.duration < 1.2) add("warn", "sb.short", `scene is ${s.duration}s — can the viewer notice anything?`, w);
    if (s.duration && s.duration > 9) add("warn", "sb.long", `scene is ${s.duration}s — long hold, justify or split`, w);
  });
  // uniqueness of purpose / notice
  const seenP = new Map();
  sc.forEach((s) => { const k = (s.purpose || "").toLowerCase().slice(0, 40); if (k && seenP.has(k)) add("warn", "sb.dup", `purpose duplicates scene ${seenP.get(k)}`, s.id); seenP.set(k, s.id); });
  // arc coverage
  if (sc.length) {
    if (!["hook", "context"].includes(sc[0].role)) add("warn", "arc.open", "first scene should be a hook/context scene that establishes subject + visual identity");
    if (!["payoff", "resolution", "cta"].includes(sc[sc.length - 1].role)) add("warn", "arc.end", "last scene should be payoff/resolution/cta");
    const mid = sc.slice(1, -1).length;
    if (sc.length >= 3 && mid === 0) add("warn", "arc.middle", "no middle");
  }
  // repetition & variation
  const lay = sc.map((s) => s.layout), tr = sc.map((s) => s.transitionOut?.type).filter(Boolean);
  for (let i = 1; i < lay.length; i++) if (lay[i] && lay[i] === lay[i - 1]) add("warn", "var.layout", `layout "${lay[i]}" repeats in consecutive scenes ${sc[i - 1].id} → ${sc[i].id}`, sc[i].id);
  if (sc.length >= 4) {
    const cnt = {}; lay.forEach((l) => (cnt[l] = (cnt[l] || 0) + 1));
    const [top, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (n / sc.length > 0.5) add("warn", "var.dominant", `layout "${top}" used in ${n}/${sc.length} scenes`);
    if (new Set(lay).size < 3) add("warn", "var.few", `only ${new Set(lay).size} distinct layouts across ${sc.length} scenes`);
    if (tr.length >= 3 && new Set(tr).size === 1) add("warn", "var.transition", `every transition is "${tr[0]}" — consistent is good, but is there a motivated exception (e.g. a match cut)?`);
    const ds2 = sc.map((s) => s.duration), mean = ds2.reduce((a, b) => a + b, 0) / ds2.length;
    const sd = Math.sqrt(ds2.reduce((a, b) => a + (b - mean) ** 2, 0) / ds2.length);
    if (sd / mean < 0.1) add("warn", "pace.metronomic", "scene durations are nearly identical; vary rhythm on purpose");
  }
  if (sc.length && sc.filter((s) => /cent(er|re)/i.test(s.layout + " " + s.focalPoint)).length / sc.length > 0.6) add("warn", "var.centred", "most scenes are centred; use off-centre compositions");
  // deck-wide sanity: text density target
  const density = d.designSystem?.density || "rich";
  if (density === "minimal" && !d.designSystem?.densityReason) add("error", "ds.density.reason", "designSystem.density is 'minimal' but densityReason is empty: say why a sparse look is intended");
  if (density !== "minimal") sc.forEach((s) => { if (!s.heroObject) add("error", "sb.nohero", "scene has no heroObject (a drawn / 3D / instrument / diagram / image object the eye lands on). Text-only scenes read as sparse: add one, or set designSystem.density='minimal' with a densityReason", s.id); });
  X.lintExtra(P, d, sc, add);
  const heroInfo = sc.filter((s) => !s.viewerShouldNotice).length;
  if (heroInfo) add("error", "sb.notice", `${heroInfo} scenes have no viewerShouldNotice`);
  return F;
}

/* ------------------------------------------------------------------ commands */
const C = {};
const X = craft({ ROOT, CFG, rj, wj, now, append, out, die, proj, hf, readLines }); // quality mechanics: storylines, copy/hook, review notes, assertions, compare, capture
Object.assign(C, X.commands);

C.new = (pos, f) => {
  const slug = pos[0]; if (!slug || !/^[a-z0-9-]+$/.test(slug)) die("usage: mh new <slug-kebab> [--format horizontal|vertical|square] [--depth draft|standard|high] [--duration N]");
  const format = f.format || "horizontal", depth = f.depth || "standard";
  if (!CFG.formats[format]) die("unknown format"); if (!CFG.depth[depth]) die("unknown depth");
  const dir = path.join(ROOT, "projects", slug);
  if (fs.existsSync(dir)) die(`${dir} exists`);
  const fm = CFG.formats[format];
  fs.mkdirSync(path.join(ROOT, "projects"), { recursive: true });
  const r = hf(["init", slug, "--non-interactive"], path.join(ROOT, "projects"));
  if (r.code !== 0 || !fs.existsSync(dir)) die("hyperframes init failed:\n" + r.stdout + r.stderr);
  for (const sub of ["compositions", "assets", ".mh/references", ".mh/frames"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "motion-lib/mh-motion.js"), path.join(dir, "assets/mh-motion.js"));
  for (const lf of ["mh-motion.css", "mh-world.js", "mh-world.css"]) fs.copyFileSync(path.join(ROOT, "motion-lib", lf), path.join(dir, "assets", lf));
  const brief = fs.readFileSync(path.join(ROOT, "templates/brief.template.md"), "utf8").replace(/{{slug}}/g, slug).replace(/{{format}}/g, format).replace(/{{w}}/g, fm.w).replace(/{{h}}/g, fm.h);
  fs.writeFileSync(path.join(dir, ".mh/brief.md"), brief);
  fs.copyFileSync(path.join(ROOT, "templates/direction.template.json"), path.join(dir, ".mh/direction.json"));
  fs.copyFileSync(path.join(ROOT, "templates/storyboard.template.json"), path.join(dir, ".mh/storyboard.json"));
  if (CFG.depth[depth].storylines !== "off") fs.copyFileSync(path.join(ROOT, "templates/storylines.template.json"), path.join(dir, ".mh/storylines.json"));
  wj(path.join(dir, ".mh/state.json"), { slug, format, depth, phase: "brief", planReviews: 0, revisions: 0, createdAt: now(), targetDuration: f.duration ? +f.duration : null });
  wj(path.join(dir, ".mh/manifest.json"), { scenes: {}, root: "index.html" });
  append(path.join(dir, ".mh/decisions.jsonl"), { type: "init", format, depth });
  out(`created ${dir}\nphase: brief  (depth ${depth}: ${JSON.stringify(CFG.depth[depth])})\nnext: write .mh/brief.md from the user's request, then \`mh advance ${slug}\``);
};

C.adopt = (pos, f) => {
  // Wrap one of HyperFrames' own shipped examples (hyperframes init --example <name>) in harness state so the
  // technical gate, source scan, frame evidence and handoff run on it. No plan files exist for adopted projects.
  const slug = pos[0]; if (!slug || !f.example) die("usage: mh adopt <slug> --example <hyperframes example name> [--format horizontal|vertical|square]");
  const dir = path.join(ROOT, "projects", slug); if (fs.existsSync(dir)) die(dir + " exists");
  fs.mkdirSync(path.join(ROOT, "projects"), { recursive: true });
  const r = hf(["init", slug, "--example", f.example, "--non-interactive"], path.join(ROOT, "projects"));
  if (r.code !== 0 || !fs.existsSync(dir)) die("hyperframes init --example failed: " + (r.stdout + r.stderr).slice(-600));
  for (const sub of [".mh/references", ".mh/frames"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  wj(path.join(dir, ".mh/state.json"), { slug, format: f.format || "horizontal", depth: f.depth || "standard", phase: "verify", adopted: true, source: "hyperframes example: " + f.example, planReviews: 0, revisions: 0, createdAt: now() });
  wj(path.join(dir, ".mh/manifest.json"), { scenes: {}, root: "index.html" });
  append(path.join(dir, ".mh/decisions.jsonl"), { type: "adopt", example: f.example });
  out("adopted " + f.example + " as " + dir + "\nnext: mh frames " + slug + "; mh gate " + slug);
};

C.status = (pos) => {
  const P = proj(pos[0]); const s = P.state;
  out(`${P.slug}  format=${s.format} depth=${s.depth} phase=${s.phase}`);
  out(`plan reviews: ${s.planReviews}/${CFG.depth[s.depth].planReviewsRequired}   revisions: ${s.revisions}/${CFG.depth[s.depth].maxRevisions}`);
  out(`agent step budget (guidance): ${CFG.depth[s.depth].agentStepBudget}`);
  const gr = rj(path.join(P.mh, "gate-report.json")); if (gr) out(`last gate: ${gr.at} errors=${gr.counts.error} warnings=${gr.counts.warn} evidence=${gr.visualEvidence}`);
};

C.lint = (pos) => {
  const P = proj(pos[0]); const F = lintPlan(P);
  wj(path.join(P.mh, "plan-lint.json"), { at: now(), findings: F });
  if (!F.length) out("plan-lint: no findings");
  F.forEach((x) => out(`${x.level.toUpperCase().padEnd(5)} ${x.code}${x.scene ? " [" + x.scene + "]" : ""}: ${x.msg}`));
  const e = F.filter((x) => x.level === "error").length; out(`\n${e} error(s), ${F.filter((x) => x.level === "warn").length} warning(s)`);
  process.exitCode = e ? 1 : 0;
};

C["review-plan"] = (pos, f) => {
  // Records one structured plan review pass. The agent (or the motion-critic subagent) supplies findings + resolutions.
  const P = proj(pos[0]);
  if (!f.findings || !f.resolved) die('usage: mh review-plan <slug> --findings "weak scenes / repetition found…" --resolved "what changed in the plan, or why left as is"');
  const lint = lintPlan(P);
  P.saveState({ ...P.state, planReviews: P.state.planReviews + 1 });
  append(P.decisions, { type: "plan-review", n: P.state.planReviews, findings: f.findings, resolved: f.resolved, openLintErrors: lint.filter((x) => x.level === "error").length });
  out(`plan review ${P.state.planReviews}/${CFG.depth[P.state.depth].planReviewsRequired} recorded (open lint errors: ${lint.filter((x) => x.level === "error").length})`);
};

C.decide = (pos, f) => {
  const P = proj(pos[0]); if (!f.what) die('usage: mh decide <slug> --what "…" [--why "…"] [--scene id]');
  append(P.decisions, { type: "decision", what: f.what, why: f.why || "", scene: f.scene || null });
  out("decision logged");
};

C.advance = (pos, f) => {
  const P = proj(pos[0]); const s = P.state; const i = PHASES.indexOf(s.phase);
  const fails = [];
  fails.push(...X.advanceChecks(P, s.phase));
  const brief = fs.readFileSync(path.join(P.mh, "brief.md"), "utf8");
  if (s.phase === "brief" && /\bTODO\b/.test(brief)) fails.push("brief.md still contains TODO");
  if (s.phase === "direction") {
    const d = P.direction(); const json = JSON.stringify(d);
    if (/\bTODO\b/.test(json)) fails.push("direction.json still contains TODO");
    lintPlan(P).filter((x) => x.level === "error" && /^(direction|ds)\./.test(x.code)).forEach((x) => fails.push(`${x.code}: ${x.msg}`));
  }
  if (s.phase === "storyboard") lintPlan(P).filter((x) => x.level === "error" && /^(sb|todo|arc)/.test(x.code)).forEach((x) => fails.push(`${x.code}${x.scene ? "[" + x.scene + "]" : ""}: ${x.msg}`));
  if (s.phase === "review") {
    const need = CFG.depth[s.depth].planReviewsRequired;
    if (s.planReviews < need) fails.push(`${s.planReviews}/${need} plan reviews recorded (mh review-plan)`);
    lintPlan(P).filter((x) => x.level === "error").forEach((x) => fails.push(`${x.code}: ${x.msg}`));
  }
  if (s.phase === "build") {
    const sb = P.storyboard();
    for (const sc of sb.scenes) if (!fs.existsSync(path.join(P.dir, "compositions", sc.id + ".html"))) fails.push(`compositions/${sc.id}.html missing`);
  }
  if (s.phase === "verify") {
    const gr = rj(path.join(P.mh, "gate-report.json"));
    if (!gr) fails.push("run `mh gate` first");
    else {
      if (gr.counts.error) fails.push(`${gr.counts.error} gate error(s)`);
      const cl = rj(path.join(P.mh, "checklist.json"), {});
      const open = Object.entries(cl.items || {}).filter(([, v]) => !["pass", "fail", "n/a"].includes(v.status));
      if (open.length) fails.push(`checklist unresolved: ${open.map(([k]) => k).join(", ")}`);
      if (CFG.depth[s.depth].frameEvidence === "required" && gr.visualEvidence !== "fresh") fails.push("depth requires fresh frame evidence: run `mh frames`");
    }
  }
  if (s.phase === "handoff") die("already at handoff");
  if (fails.length && !f.force) { fails.forEach((x) => out("BLOCK " + x)); process.exit(1); }
  const nxt = PHASES[i + 1];
  P.saveState({ ...s, phase: nxt });
  append(P.decisions, { type: "phase", from: s.phase, to: nxt, forced: !!f.force });
  out(`phase: ${s.phase} → ${nxt}`);
};

C.revise = (pos, f) => {
  // begin a targeted revision: logs which scenes will change; everything else is expected to stay byte-identical.
  const P = proj(pos[0]); if (!f.reason || !f.scenes) die('usage: mh revise <slug> --reason "…" --scenes s2,s3 [--replan] [--override "why exceed budget"]');
  const max = CFG.depth[P.state.depth].maxRevisions;
  if (P.state.revisions >= max && !f.override) die(`revision budget reached (${max}). Pass --override "reason" to exceed, or hand off.`);
  const touched = String(f.scenes).split(",").map((x) => x.trim()).filter(Boolean);
  const man = P.manifest();
  const unknown = touched.filter((t) => !man.scenes[t] && t !== "index" && t !== "design-system");
  if (unknown.length) out(`note: ${unknown.join(", ")} not in manifest (new scenes?)`);
  append(P.revisions, { n: P.state.revisions + 1, reason: f.reason, touched, preserved: Object.keys(man.scenes).filter((k) => !touched.includes(k)), replan: !!f.replan, override: f.override || null });
  P.saveState({ ...P.state, revisions: P.state.revisions + 1, phase: f.replan ? "storyboard" : "build" });
  out(`revision ${P.state.revisions} logged. Touch ONLY: ${touched.join(", ")}. Preserved: ${Object.keys(man.scenes).filter((k) => !touched.includes(k)).join(", ") || "(none)"}`);
};

C.lock = (pos) => {
  // snapshot hashes of every scene so later edits to "working" scenes are detectable
  const P = proj(pos[0]); const man = P.manifest(); man.scenes = {};
  const cd = path.join(P.dir, "compositions");
  if (fs.existsSync(cd)) for (const fn of fs.readdirSync(cd).filter((x) => x.endsWith(".html"))) man.scenes[fn.replace(/\.html$/, "")] = { file: "compositions/" + fn, hash: hash(path.join(cd, fn)) };
  man.index = fs.existsSync(path.join(P.dir, "index.html")) ? hash(path.join(P.dir, "index.html")) : null;
  man.lockedAt = now(); P.saveManifest(man);
  out(`locked ${Object.keys(man.scenes).length} scene(s): ${Object.keys(man.scenes).join(", ")}`);
};

C.cues = (pos, f) => {
  // Inline timing data (beats json from `hyperframes beats`, or a word-level transcript.json) as assets/mh-cues.js
  const P = proj(pos[0]); if (!f.from) die("usage: mh cues <slug> --from <beats.json|transcript.json> [--offset seconds]");
  const src = rj(path.isAbsolute(f.from) ? f.from : path.join(P.dir, f.from)); if (!src) die("cannot read " + f.from);
  const off = +(f.offset || 0), cues = { beats: [], words: [], hits: [] };
  const beats = src.beats || src.beatTimes || (Array.isArray(src) && typeof src[0] === "number" ? src : null);
  if (beats) cues.beats = beats.map((b) => +(typeof b === "number" ? b : b.time ?? b.t) + off);
  const words = src.words || (Array.isArray(src) && src[0] && (src[0].text || src[0].word) ? src : null);
  if (words) cues.words = words.map((w) => ({ t: +(w.start ?? w.t) + off, end: +(w.end ?? w.start ?? w.t) + off, text: String(w.text ?? w.word) }));
  if (src.hits) cues.hits = src.hits.map((h) => +h + off);
  fs.writeFileSync(path.join(P.dir, "assets/mh-cues.js"), `/* generated by mh cues from ${path.basename(f.from)} */\nwindow.MH_CUES=${JSON.stringify(cues)};\n`);
  out(`assets/mh-cues.js: ${cues.beats.length} beats, ${cues.words.length} words, ${cues.hits.length} hits. Add <script src="assets/mh-cues.js"></script> to index.html before scenes.`);
};

/* ------------------------------------------------- user files: references and raw assets */
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|lnk|dll|sh)$/i;
const MEDIA_KIND = [["video", /\.(mp4|mov|m4v|webm|mkv|avi)$/i], ["image", /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i], ["audio", /\.(mp3|wav|m4a|aac|ogg|flac)$/i], ["font", /\.(woff2?|ttf|otf)$/i], ["doc", /\.(pdf|txt|md|csv|json|docx?|pptx?|xlsx?)$/i]];
const kindOf = (name) => (MEDIA_KIND.find(([, re]) => re.test(name)) || ["other"])[0];
const safeName = (n) => path.basename(String(n)).replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file";
function probeMedia(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8", maxBuffer: 16 << 20 });
  if (r.status !== 0) return null;
  let j; try { j = JSON.parse(r.stdout); } catch { return null; }
  const v = (j.streams || []).find((s) => s.codec_type === "video"), a = (j.streams || []).some((s) => s.codec_type === "audio");
  const fr = v && v.avg_frame_rate && v.avg_frame_rate.includes("/") ? v.avg_frame_rate.split("/").map(Number) : null;
  return { durationSec: j.format && j.format.duration ? +(+j.format.duration).toFixed(2) : null, width: v ? v.width : null, height: v ? v.height : null, fps: fr && fr[1] ? +(fr[0] / fr[1]).toFixed(2) : null, hasAudio: a, codec: v ? v.codec_name : null };
}
function grabFrames(file, outDir, count, durationSec, prefix) {
  fs.mkdirSync(outDir, { recursive: true }); const made = [], times = [];
  for (let i = 0; i < count; i++) {
    const t = +((durationSec || 0) * (i + 0.5) / count).toFixed(2), name = `${prefix}-${String(i + 1).padStart(2, "0")}.jpg`;
    const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=960:-2", "-y", path.join(outDir, name)], { encoding: "utf8" });
    if (r.status === 0 && fs.existsSync(path.join(outDir, name))) { made.push(name); times.push(t); }
  }
  return { made, times };
}
function sceneCuts(file) {
  // scene-change detection on the first 180 s: approximate cut times, NOT frame-exact
  const r = spawnSync("ffmpeg", ["-v", "info", "-t", "180", "-i", file, "-vf", "select='gt(scene,0.30)',showinfo", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const t = [...String(r.stderr || "").matchAll(/pts_time:([\d.]+)/g)].map((m) => +(+m[1]).toFixed(2));
  return [...new Set(t)].slice(0, 60);
}
function inboxPath(src) {
  const inbox = path.join(ROOT, "inbox"); fs.mkdirSync(inbox, { recursive: true });
  let real; try { real = fs.realpathSync(path.resolve(src)); } catch { die("file not found: " + src); }
  if (!real.startsWith(fs.realpathSync(inbox) + path.sep)) die("imports are only accepted from the harness inbox/ folder (the dashboard puts uploads there)");
  return real;
}
function addReference(P, real, note) {
  const name = safeName(path.basename(real)), dst = path.join(P.mh, "references", name); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(real, dst);
  const kind = kindOf(name), tpl = rj(path.join(ROOT, "templates/reference-analysis.template.json"));
  tpl.source = name; if (note) tpl.userNote = note;
  let msg = "";
  if (kind === "video") {
    const pr = probeMedia(dst) || {}, fdir = path.join(P.mh, "references", name + ".frames");
    const fr = pr.durationSec ? grabFrames(dst, fdir, 8, pr.durationSec, "frame") : { made: [], times: [] };
    const cuts = pr.durationSec ? sceneCuts(dst) : [];
    tpl.kind = "video";
    tpl.observed = { ...pr, palette: X.samplePalette(fr.made.map((n) => path.join(fdir, n))), sampledFrames: fr.made.map((n) => `${name}.frames/${n}`), sampleTimesSec: fr.times, detectedCutsSec: cuts, cutNote: "scene-change detection (threshold 0.30, first 180 s): approximate cut times; says nothing about easing curves" };
    tpl.motion = { observable: "cut rhythm and on-screen timing can be read from the sampled frames and detected cuts; easing/spring curves and sub-frame timing cannot", pacingNotes: "TODO", transitions: "TODO" };
    msg = `video: ${pr.width}x${pr.height} ${pr.fps}fps ${pr.durationSec}s${pr.hasAudio ? " with audio" : ""}; ${fr.made.length} frames sampled, ${cuts.length} cuts detected.\nOpen the frames (read tool): ${fr.made.map((n) => path.join(fdir, n)).join("\n  ")}`;
  } else { tpl.kind = "still"; tpl.measuredPalette = X.samplePalette([dst]); msg = "image copied: open it with the read tool. Measured palette (from pixels): " + tpl.measuredPalette.map((c) => c.hex).join(" "); }
  wj(dst + ".analysis.json", tpl);
  return `${msg}\nThen fill ${name}.analysis.json from what is actually visible (layout, type hierarchy, colour, image treatment, density, pacing), run mh ref lint, and copy the winning rules into direction.json referenceRules. Build an original composition; do not copy the reference.`;
}
function addAsset(P, real, note) {
  let name = safeName(path.basename(real)); const dir = path.join(P.dir, "assets", "source"); fs.mkdirSync(dir, { recursive: true });
  const man = rj(path.join(P.mh, "assets.json"), { files: [] });
  if (fs.existsSync(path.join(dir, name))) name = name.replace(/(\.[^.]*)?$/, "-" + Date.now().toString(36) + "$1");
  const dst = path.join(dir, name); fs.copyFileSync(real, dst);
  const kind = kindOf(name), pr = ["video", "audio", "image"].includes(kind) ? probeMedia(dst) : null;
  let previews = [];
  if (kind === "video" && pr && pr.durationSec) { const g = grabFrames(dst, path.join(P.mh, "assets", name + ".preview"), 4, pr.durationSec, "preview"); previews = g.made.map((n) => `assets/${name}.preview/${n}`); }
  const entry = { name, path: "assets/source/" + name, kind, sizeBytes: fs.statSync(dst).size, ...(pr || {}), note: note || "", previews, importedAt: now() };
  man.files = man.files.filter((x) => x.name !== name).concat(entry); wj(path.join(P.mh, "assets.json"), man);
  const tips = { video: "Real footage: look at the previews, trim with data-media-start/data-duration, keep it muted unless it carries wanted sound (data-has-audio), and grade/blur ONLY through `hyperframes media-treatment` (see the media-use skill), never CSS filters.", image: "Use it root-relative in the composition.", audio: "Mount as a separate <audio id=...>; time cues with mh_cues from a transcript or beats.", font: "Declare an @font-face pointing at this file; only bundled fonts resolve by name.", doc: "Read it for facts/copy; do not embed it.", other: "Check what it is before using it." };
  return `imported ${name} (${kind}${pr && pr.width ? `, ${pr.width}x${pr.height}` : ""}${pr && pr.durationSec ? `, ${pr.durationSec}s` : ""}) -> ${entry.path}\n${previews.length ? "Preview frames to open: " + previews.map((p) => path.join(P.mh, p)).join("\n  ") + "\n" : ""}${tips[kind]}`;
}
C.import = (pos, f) => {
  const [slug, file] = pos; if (!slug || !file) die("usage: mh import <slug> <file-in-inbox> --role reference|asset [--note \"…\"]");
  if (BLOCKED_EXT.test(file)) die("this file type is not accepted");
  const P = proj(slug), real = inboxPath(file), role = f.role === "reference" ? "reference" : "asset";
  const res = role === "reference" ? addReference(P, real, f.note) : addAsset(P, real, f.note);
  append(P.decisions, { type: "import", role, file: path.basename(real), note: f.note || "" });
  out(res);
};

C.ref = (pos, f) => {
  const [sub, slug, file] = pos; const P = proj(slug);
  if (sub === "add") {
    if (!file || !fs.existsSync(file)) die("usage: mh ref add <slug> <image-or-video-file>");
    const tmp = path.resolve(file);
    out(addReference(P, tmp, f.note));
  } else if (sub === "lint") {
    const dir = path.join(P.mh, "references"); let bad = 0, n = 0;
    for (const fn of fs.readdirSync(dir).filter((x) => x.endsWith(".analysis.json"))) {
      n++; const a = rj(path.join(dir, fn)), er = [];
      if (JSON.stringify(a).includes("TODO")) er.push("placeholders left");
      if (a.kind === "still" && (a.motion?.timing || a.motion?.easing || a.motion?.durations)) er.push("a still cannot reveal timing/easing/durations — remove those fields");
      if (a.kind === "still" && a.motion?.observable && !/not observable/i.test(a.motion.observable)) er.push('for stills motion.observable must say "not observable from a still"');
      if (a.kind === "video" && !a.observed) er.push("video analysis needs the observed block (re-run mh ref add or mh import --role reference)");
      if ((a.designRules || []).length < 3) er.push("need >= 3 designRules");
      if (!a.originalityNote) er.push("originalityNote missing");
      er.forEach((e) => out(`ERROR ${fn}: ${e}`)); bad += er.length;
    }
    out(`${n} reference analysis file(s), ${bad} problem(s)`); process.exitCode = bad ? 1 : 0;
  } else die("usage: mh ref add|lint <slug> [file]");
};

C.frames = (pos, f) => {
  // Preview evidence only: stills via `hyperframes snapshot`. This is not a render/export.
  const P = proj(pos[0]); const dir = path.join(P.mh, "frames");
  fs.mkdirSync(dir, { recursive: true });
  for (const x of fs.readdirSync(dir)) { try { fs.rmSync(path.join(dir, x), { force: true }); } catch { /* locked by a viewer on Windows: the snapshot overwrites it */ } }
  const args = ["snapshot", P.dir, "-o", dir, "--json"]; if (f.at) args.push("--at", f.at); else args.push("--review");
  const r = hf(args, P.dir);
  const errMsg = /"error"\s*:\s*"([^"]+)"/.exec(r.stdout)?.[1];
  if (r.code !== 0 || errMsg) die(`snapshot failed — no visual evidence was produced${errMsg ? ": " + errMsg : ""}`);
  const files = fs.readdirSync(dir).filter((x) => /\.(png|jpg)$/.test(x));
  const fstats = {};
  for (const x of files.filter((n) => /^(beat|frame)-.*\.png$/.test(n))) { const e = frameEdgeFraction(path.join(dir, x)); if (e != null) fstats[x] = e; }
  wj(path.join(dir, "frame-stats.json"), { at: now(), metric: "percent of pixels on a strong edge (192x108 gray, |gx|+|gy|>28)", thresholds: { empty: 0.4, sparse: 2.5 }, stats: fstats });
  append(P.decisions, { type: "frames", count: files.length });
  out(`${files.length} frame file(s) in ${dir}\nOPEN AND LOOK at them (Read tool on each image) before claiming anything about how it looks.`);
  files.forEach((x) => out("  " + path.join(dir, x)));
};

/* --------------------------------------------------------------------- gate */
const CHECKLIST = [
  ["opening", "Does the opening establish the subject and visual identity?", "judge"],
  ["narrative", "Is the narrative understandable?", "judge"],
  ["scene-purpose", "Does every scene have a clear purpose?", "plan"],
  ["variation", "Is there meaningful visual variation?", "plan+source"],
  ["typography", "Is the typography readable and well composed?", "source+visual"],
  ["transitions", "Are transitions consistent and intentional?", "source"],
  ["timing", "Are there awkward gaps, overlaps or timing conflicts?", "auto"],
  ["clipping", "Are elements clipped or outside safe areas?", "auto+visual"],
  ["assets", "Are images and assets used effectively?", "judge"],
  ["arc", "Does the video have a coherent beginning, middle and end?", "plan"],
  ["effects", "Are there unnecessary effects or repetitive layouts?", "source"],
  ["technical", "Does the project pass the supported technical checks?", "auto"],
];

function scanSource(P, fmt, d) {
  const F = []; const add = (level, code, msg, scene) => F.push({ level, code, scene, msg });
  const density = d?.designSystem?.density || "rich";
  const layerIds = new Set((P.storyboard() && P.storyboard().layers) || []);
  // adopted projects (HyperFrames' own examples) have no design-system file: skip palette/font discipline checks
  const pal = d ? Object.values(d.designSystem.palette).map((x) => String(x).toLowerCase()) : null;
  const fams = d ? new Set([d.designSystem.typography.display.family, d.designSystem.typography.body.family, d.designSystem.typography.data?.family].filter(Boolean)) : null;
  const files = [["index", "index.html"], ...fs.existsSync(path.join(P.dir, "compositions")) ? fs.readdirSync(path.join(P.dir, "compositions")).filter((x) => x.endsWith(".html")).map((x) => [x.replace(/\.html$/, ""), "compositions/" + x]) : []];
  const prims = {};
  for (const [id, rel] of files) {
    let src = fs.readFileSync(path.join(P.dir, rel), "utf8");
    const noRoot = src.replace(/:root\s*\{[^}]*\}/g, "");
    const cssHex = [...new Set([...noRoot.matchAll(/(?:color|background|border|fill|stroke)[^;{}]*?:[^;{}]*?(#[0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase()))].filter((h) => pal && !pal.includes(h));
    if (cssHex.length) add("warn", "src.palette", `colours outside the palette (use var(--mh-*)): ${cssHex.join(", ")}`, id);
    for (const m of noRoot.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
      const v = m[1].trim();
      if (/var\(--mh-font/.test(v)) continue;
      const first = v.split(",")[0].replace(/["']/g, "").trim();
      if (fams && !fams.has(first) && first !== "inherit" && !/^var\(/.test(first)) add("warn", "src.font", `font "${first}" is not in the design system`, id);
    }
    for (const m of noRoot.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) if (+m[1] < fmt.minBodyPx && !/data-layout-ignore/.test(src)) { add("warn", "src.fontsize", `font-size ${m[1]}px < minimum ${fmt.minBodyPx}px for this format (ignore only for decorative micro-labels)`, id); break; }
    if (BANNED_WORDS.test(noRoot.replace(/<script[\s\S]*?<\/script>/g, "")) || /box-shadow[^;]*0 0 \d{2,}px|filter\s*:\s*blur\(\s*[2-9]\d/.test(noRoot)) add("warn", "src.banned", "glow/blur-heavy/banned default detected in styles", id);
    if (/repeat\s*:\s*-1|Math\.random|Date\.now|setTimeout|setInterval|fetch\(/.test(src)) add("error", "src.nondeterministic", "non-deterministic/forbidden API", id);
    if (id !== "index") {
      const hostIds = new Set(files.map((x) => x[0]));
      for (const m of src.matchAll(/\sid="([^"]+)"/g)) if (hostIds.has(m[1]) && m[1] !== id) add("error", "src.dupid", `element id "${m[1]}" collides with a scene host id (breaks the scene silently); rename the inner element`, id);
    }
    const used = [...new Set([...src.matchAll(/MH\.(\w+)\.(\w+)/g)].map((m) => m[1] + "." + m[2]))].sort();
    prims[id] = used;
    if (id !== "index" && !layerIds.has(id)) {
      const shapes = (src.match(/<(path|circle|ellipse|rect|polygon|polyline|line)\b/g) || []).length;
      const hero = /data-mh-hero/.test(src) || /MH\.(world\.(gauge|path|travel|cube|stage3d|callout|floor|drum)|graphic\.(bars|draw))/.test(src) || /<(img|video|canvas)\b/.test(src) || shapes >= 6;
      if (!hero) add(density === "minimal" || !d ? "info" : "warn", "density.sparse", "no hero object found (needs data-mh-hero, an MH.world instrument/3D/path/callout, media, or a diagram with >= 6 shapes): a scene of only text and flat blocks reads as sparse", id);
    }
    if (id !== "index" && !used.length) add("info", "src.noprims", "scene uses no MH primitives (fine if hand-built, but check consistency)", id);
    const tweenCount = (src.match(/\.(fromTo|to|from|set)\(/g) || []).length;
    if (id !== "index" && tweenCount > 40) add("warn", "src.busy", `${tweenCount} tweens in one scene — is every movement meaningful?`, id);
  }
  X.scanExtra(files, (id) => fs.readFileSync(path.join(P.dir, files.find((f) => f[0] === id)[1]), "utf8"), add);
  const sigs = Object.entries(prims).filter(([k]) => k !== "index").map(([, v]) => v.join("|"));
  if (sigs.length >= 3 && new Set(sigs).size === 1 && sigs[0]) add("warn", "src.repetitive", "every scene uses exactly the same primitive set — likely templated motion", null);
  return { F, prims };
}

C.gate = (pos) => {
  const P = proj(pos[0]); const d = P.direction(), sb = P.storyboard(), fmt = P.fmt();
  const F = []; const add = (level, code, msg, scene) => F.push({ level, code, scene, msg });
  // 1. plan lint (warnings carried, errors block)
  if (!P.state.adopted) lintPlan(P).forEach((x) => F.push({ ...x, code: "plan." + x.code }));
  // 2. hyperframes check
  const ck = hf(["check", P.dir, "--json"], P.dir);
  let ckj = null;
  { // the CLI prints log lines before the JSON envelope; the envelope starts at the line `{` followed by `"ok"`
    const m = /^\{\s*\n\s*"ok"/m.exec(ck.stdout); const start = m ? m.index : ck.stdout.indexOf("{");
    try { ckj = JSON.parse(ck.stdout.slice(start)); } catch {}
  }
  if (!ckj) add("error", "hf.check.unparsed", "hyperframes check produced no JSON: " + (ck.stderr || ck.stdout).slice(-400));
  else {
    for (const sec of ["lint", "runtime", "layout", "motion", "contrast", "craft", "audio"]) {
      for (const i of ckj[sec]?.findings || []) {
        const lvl = i.severity === "error" ? "error" : i.severity === "info" ? "info" : "warn";
        add(lvl, `hf.${sec}.${i.code || i.rule || "issue"}`, `${i.message || ""}${i.time != null ? ` @${i.time}s` : ""}${i.fixHint || i.fix ? "  Fix: " + (i.fixHint || i.fix) : ""}`, (i.sourceFile || i.file || "").replace(/^compositions\/|\.html$/g, "") || undefined);
      }
    }
    if (ckj.ok === false && !F.some((x) => x.level === "error" && x.code.startsWith("hf."))) add("error", "hf.check.failed", "hyperframes check reported ok=false");
  }
  // 3. structure: hosts vs storyboard vs files
  const html = fs.existsSync(path.join(P.dir, "index.html")) ? fs.readFileSync(path.join(P.dir, "index.html"), "utf8") : "";
  const rootDur = +(/data-composition-id="main"[^>]*data-duration="([\d.]+)"/.exec(html) || /data-duration="([\d.]+)"[^>]*data-composition-id="main"/.exec(html) || [])[1];
  const hosts = [...html.matchAll(/<div\b[^>]*data-composition-src="compositions\/([\w-]+)\.html"[^>]*>/g)].map((m) => {
    const t = m[0], g = (k) => { const x = new RegExp(k + '="([^"]+)"').exec(t); return x ? x[1] : null; };
    return { id: m[1], start: +g("data-start"), dur: +g("data-duration"), hostId: g("id"), cid: g("data-composition-id") };
  }).sort((a, b) => a.start - b.start);
  if (!hosts.length) add(P.state.adopted ? "info" : "error", "struct.nohosts", "index.html mounts no scenes from compositions/ (single-file composition)");
  let prevEnd = 0;
  const layerIds = new Set((sb && sb.layers) || []); // persistent world layers (sky, hud, captions, transitions) span the film: not scenes
  hosts.forEach((h) => {
    if (h.hostId !== h.cid || h.cid !== h.id) add("warn", "struct.ids", `host id "${h.hostId}", composition id "${h.cid}" and file "${h.id}" differ. The hyperframes skill says this makes each render wait ~45s per scene; HyperFrames own shipped examples do it and hyperframes check does not flag it, so the render cost is unverified here. Matching them is safest`, h.id);
    if (layerIds.has(h.id)) return;
    if (h.start - prevEnd > 0.04) add("warn", "timing.gap", `${(h.start - prevEnd).toFixed(2)}s gap before ${h.id} (${prevEnd.toFixed(2)}→${h.start.toFixed(2)}) — intentional hold?`, h.id);
    if (prevEnd - h.start > 0.04) add("info", "timing.overlap", `${h.id} overlaps previous scene by ${(prevEnd - h.start).toFixed(2)}s (fine only for a deliberate cross-transition)`, h.id);
    prevEnd = Math.max(prevEnd, h.start + h.dur);
    const s = sb ? sb.scenes.find((x) => x.id === h.id) : null;
    if (!sb) { /* adopted project: no storyboard to compare */ } else if (!s) add("warn", "struct.unplanned", "scene not in storyboard", h.id);
    else if (h.dur < s.duration - 0.15 || h.dur > s.duration + 0.75) add("warn", "struct.duration", `storyboard says ${s.duration}s (+ up to 0.75s of transition overlap allowed), host is ${h.dur}s`, h.id);
  });
  (sb ? sb.scenes : []).forEach((s) => { if (!hosts.find((h) => h.id === s.id)) add("error", "struct.unbuilt", "storyboard scene not mounted in index.html", s.id); });
  if (hosts.length && rootDur && Math.abs(prevEnd - rootDur) > 0.1) add("warn", "timing.rootdur", `scenes end at ${prevEnd.toFixed(2)}s but root data-duration is ${rootDur}s (early end holds last frame; overrun is cut)`);
  // 4. source scan
  const { F: sf, prims } = scanSource(P, fmt, d); F.push(...sf);
  X.gateExtra(P, add);
  // user-supplied files: imported assets must be used; reference analyses must be finished
  {
    const srcAll = [html, ...(fs.existsSync(path.join(P.dir, "compositions")) ? fs.readdirSync(path.join(P.dir, "compositions")).filter((x) => x.endsWith(".html")).map((x) => fs.readFileSync(path.join(P.dir, "compositions", x), "utf8")) : [])].join(" ");
    for (const a of (rj(path.join(P.mh, "assets.json"), { files: [] }).files || [])) if (!["doc", "other"].includes(a.kind) && !srcAll.includes(a.path)) add("warn", "assets.unused", `imported ${a.kind} "${a.name}" is not used by any composition (the user supplied it: use it, or say why not in a decision)`);
    const rdir = path.join(P.mh, "references");
    if (fs.existsSync(rdir)) for (const fn of fs.readdirSync(rdir).filter((x) => x.endsWith(".analysis.json"))) if (JSON.stringify(rj(path.join(rdir, fn))).includes("TODO")) add("warn", "refs.incomplete", `reference analysis ${fn} still has placeholders: open the reference frames and fill it in`);
  }
  // 5. locked scene drift
  const man = P.manifest();
  const touchedSince = new Set(readLines(P.revisions).filter((r) => !man.lockedAt || r.at >= man.lockedAt).flatMap((r) => r.touched || []));
  for (const [id, m] of Object.entries(man.scenes || {})) {
    const p = path.join(P.dir, m.file);
    if (!fs.existsSync(p)) { add("warn", "rev.removed", "locked scene file no longer exists", id); continue; }
    if (hash(p) !== m.hash && !touchedSince.has(id)) add("warn", "rev.drift", "scene changed since `mh lock` but is not in any revision logged since then — log it with `mh revise` or restore it", id);
  }
  // 6. evidence
  let evidence = "none";
  const fdir = path.join(P.mh, "frames");
  const frameFiles = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter((x) => /\.(png|jpg)$/.test(x)) : [];
  if (frameFiles.length) {
    const cdir = path.join(P.dir, "compositions");
    const newestSrc = Math.max(...[...(fs.existsSync(cdir) ? fs.readdirSync(cdir) : []).map((x) => fs.statSync(path.join(P.dir, "compositions", x)).mtimeMs), fs.statSync(path.join(P.dir, "index.html")).mtimeMs]);
    const oldestFrame = Math.min(...frameFiles.map((x) => fs.statSync(path.join(fdir, x)).mtimeMs));
    evidence = oldestFrame >= newestSrc ? "fresh" : "stale";
  }
  const fst = rj(path.join(fdir, "frame-stats.json"));
  if (fst && evidence === "fresh") for (const [name, e] of Object.entries(fst.stats || {})) {
    const tm = /-at-([d.]+)s/.exec(name), ft = tm ? +tm[1] : -1, nearBoundary = hosts.some((h) => h.start > 0 && Math.abs(ft - h.start) < 0.8);
    if (e < fst.thresholds.empty && nearBoundary) add("info", "frame.empty.transition", name + ": near-empty but within 0.8s of a scene boundary (probably mid-transition)");
    else if (e < fst.thresholds.empty) add("warn", "frame.empty", name + ": near-empty frame (" + e + "% strong-edge pixels). Open it: a blank/transition moment, or a scene that failed to draw?");
    else if (e < fst.thresholds.sparse) add(((d?.designSystem?.density) || "rich") === "minimal" || !d ? "info" : "warn", "frame.sparse", name + ": sparse frame (" + e + "% strong-edge pixels): little visible structure at this moment");
  }
  if (evidence !== "fresh") add(CFG.depth[P.state.depth].frameEvidence === "required" ? "error" : "warn", "evidence." + evidence, evidence === "none" ? "no preview frames captured — any statement about appearance is source-based only" : "frames are older than the latest source edit — re-run `mh frames`");
  // checklist auto-fill
  const cl = rj(path.join(P.mh, "checklist.json"), { items: {} });
  const has = (re) => F.some((x) => re.test(x.code) && x.level !== "info");
  const auto = {
    timing: has(/^timing\.|^struct\./) ? ["fail", F.filter((x) => /^timing\.|^struct\./.test(x.code)).map((x) => x.msg).join(" | ")] : ["pass", `hosts contiguous, ${hosts.length} scene(s) match storyboard`],
    technical: F.some((x) => x.level === "error") ? ["fail", `${F.filter((x) => x.level === "error").length} error(s) — see gate-report.json`] : ["pass", "hyperframes check + lint + structure: no errors"],
    "scene-purpose": has(/^plan\.sb\.(weak|dup|notice|field)/) ? ["fail", "see plan findings"] : ["pass", "every scene has purpose + viewerShouldNotice; none flagged generic"],
    arc: has(/^plan\.arc/) ? ["fail", "see plan.arc findings"] : ["pass", "roles open with hook/context and close with payoff/resolution/cta"],
  };
  for (const [k, q, how] of CHECKLIST) {
    const prev = cl.items[k]; const a = auto[k];
    cl.items[k] = { question: q, how, status: a ? a[0] : (prev?.status || "unreviewed"), evidence: a ? a[1] : (prev?.evidence || ""), basis: a ? "automatic" : (prev?.basis || "") };
  }
  wj(path.join(P.mh, "checklist.json"), cl);
  const counts = { error: 0, warn: 0, info: 0 }; F.forEach((x) => counts[x.level]++);
  const rep = { at: now(), visualEvidence: evidence, frameFiles: frameFiles.map((x) => path.join(fdir, x)), counts, primitivesByScene: prims, findings: F };
  wj(path.join(P.mh, "gate-report.json"), rep);
  const grouped = new Map();
  for (const x of F.filter((y) => y.level !== "info")) { const k = [x.level, x.code, x.scene, String(x.msg).replace(/ @[d.]+s/, "")].join("|"); (grouped.get(k) || grouped.set(k, { x, n: 0 }).get(k)).n++; }
  for (const { x, n } of grouped.values()) out(`${x.level.toUpperCase().padEnd(5)} ${x.code}${x.scene ? " [" + String(x.scene).split(/[\/]/).pop() + "]" : ""}${n > 1 ? " x" + n : ""}: ${String(x.msg).slice(0, 320)}`);
  out(`\n${counts.error} error(s), ${counts.warn} warning(s), ${counts.info} note(s). visual evidence: ${evidence}`);
  out("Checklist items still needing your judgement: " + Object.entries(cl.items).filter(([, v]) => v.status === "unreviewed").map(([k]) => k).join(", ") + "\n  → mh checklist <slug> set <id> pass|fail|n/a --note \"specific evidence\" [--basis visual|source]");
  process.exitCode = counts.error ? 1 : 0;
};

C.checklist = (pos, f) => {
  const [slug, sub, id] = pos; const P = proj(slug); const p = path.join(P.mh, "checklist.json"); const cl = rj(p);
  if (!cl) die("run `mh gate` first");
  if (sub === "set") {
    if (!cl.items[id]) die("unknown item " + id + ": " + Object.keys(cl.items).join(", "));
    const st = pos[3]; if (!["pass", "fail", "n/a"].includes(st)) die("status must be pass|fail|n/a");
    if (!f.note) die("--note with specific evidence is required");
    const basis = f.basis || "source";
    if (basis === "visual") { const gr = rj(path.join(P.mh, "gate-report.json")); if (gr?.visualEvidence !== "fresh") die("basis=visual needs fresh frames (`mh frames`, then look at them). Use --basis source for source-only judgement."); }
    cl.items[id] = { ...cl.items[id], status: st, evidence: f.note, basis }; wj(p, cl);
    append(P.decisions, { type: "checklist", id, status: st, basis, note: f.note });
  }
  for (const [k, v] of Object.entries(cl.items)) out(`${k.padEnd(14)} ${v.status.padEnd(10)} ${v.basis ? "(" + v.basis + ") " : ""}${v.evidence || ""}`);
};

C.handoff = (pos, f) => {
  const P = proj(pos[0]);
  if (P.state.phase !== "handoff") die(`phase is "${P.state.phase}"; run mh advance until handoff (verify must pass)`);
  const cl = rj(path.join(P.mh, "checklist.json")), gr = rj(path.join(P.mh, "gate-report.json"));
  const fails = Object.entries(cl.items).filter(([, v]) => v.status === "fail");
  if (fails.length && !f["accept-fails"]) die(`checklist has failing items: ${fails.map(([k]) => k).join(", ")}. Fix them, or pass --accept-fails "reason" to hand off with them disclosed.`);
  C.lock([P.dir]);
  const md = [`# Handoff — ${P.slug}`, "", `Format ${P.state.format}, depth ${P.state.depth}. Revisions used: ${P.state.revisions}.`, "",
    `**Open in HyperFrames Studio:** run \`npx ${HF} preview "${P.dir}"\` (or \`mh studio ${P.slug}\`). Preview and final render are yours to run there; the harness does not render.`, "",
    `## Evidence level`, `- Visual evidence: **${gr.visualEvidence}** (${gr.visualEvidence === "fresh" ? "snapshot frames were captured and inspected after the last edit" : "NO fresh frames; appearance claims below are from source/plan only"})`, "",
    `## Checklist (actual findings)`, ...Object.entries(cl.items).map(([k, v]) => `- **${k}** — ${v.status} (${v.basis}): ${v.evidence}`), "",
    `## Gate counts`, `${gr.counts.error} errors, ${gr.counts.warn} warnings`, ...gr.findings.filter((x) => x.level === "warn").map((x) => `- ${x.code}${x.scene ? " [" + x.scene + "]" : ""}: ${x.msg}`),
    f["accept-fails"] ? `\n## Accepted failures\n${f["accept-fails"]}` : ""].join("\n");
  fs.writeFileSync(path.join(P.dir, "HANDOFF.md"), md + "\n");
  const rv = X.writeReviewMd(P, gr, cl); if (rv) out("REVIEW.md written (creative calls, measured vs looked at, weakest shot, notes).");
  append(P.decisions, { type: "handoff", acceptFails: f["accept-fails"] || null });
  out(`HANDOFF.md written.\nStudio: npx ${HF} preview "${P.dir}"   (mh studio ${P.slug} starts it in the background)`);
};

C.studio = (pos) => {
  const P = proj(pos[0]);
  const r = hf(["preview", P.dir, "--background", "--no-open", "--json"], P.dir);
  out(r.stdout + r.stderr);
};

C["direction-md"] = (pos) => {
  const P = proj(pos[0]); const d = P.direction(), sb = P.storyboard();
  const L = [`# Creative direction — ${P.slug}`, "", `**Concept.** ${d.concept}`, "", `**Arc.** ${d.narrativeArc.beginning} → ${d.narrativeArc.middle} → ${d.narrativeArc.end}. Takeaway: ${d.narrativeArc.viewerTakeaway}`, "",
    "## Design system", "```json", JSON.stringify(d.designSystem, null, 2), "```", "", "## Consistency rules", ...d.consistencyRules.map((x) => "- " + x), "", "## Anti-patterns", ...d.antiPatterns.map((x) => "- " + x), "",
    "## Storyboard", ...sb.scenes.flatMap((s, i) => [`### ${i + 1}. ${s.title} (${s.duration}s, ${s.role})`, `- Why it exists: ${s.purpose}`, `- Viewer should notice: ${s.viewerShouldNotice}`, `- Focal point: ${s.focalPoint} · layout: ${s.layout}`, `- Hero move: ${s.heroMove} (${s.motionPurpose}: ${s.motionWhy})`, `- Text: ${(s.text || []).join(" / ")}`, `- Out: ${s.transitionOut?.type || "end"} — ${s.transitionOut?.motivation || ""}`, ""])];
  fs.writeFileSync(path.join(P.dir, "DIRECTION.md"), L.join("\n")); out("DIRECTION.md written");
};

C["sync-lib"] = (pos) => {
  // refresh a project's copy of the motion library (projects carry their own copy so they stay self-contained)
  const dirs = pos[0] ? [proj(pos[0]).dir] : fs.readdirSync(path.join(ROOT, "projects")).map((x) => path.join(ROOT, "projects", x)).filter((x) => fs.existsSync(path.join(x, ".mh")) && fs.existsSync(path.join(x, "assets", "mh-motion.js")));
  for (const d of dirs) for (const f of ["mh-motion.js", "mh-motion.css", "mh-world.js", "mh-world.css"]) fs.copyFileSync(path.join(ROOT, "motion-lib", f), path.join(d, "assets", f));
  out(`synced motion-lib into ${dirs.length} project(s)`);
};

C.preset = (pos) => {
  const P = proj(pos[0]); const name = pos[1]; const dir = path.join(ROOT, "motion-lib/presets");
  if (!name) die("usage: mh preset <slug> <name>   presets: " + fs.readdirSync(dir).map((x) => x.replace(/\.json$/, "")).join(", "));
  const pr = rj(path.join(dir, name + ".json")); if (!pr) die("unknown preset " + name);
  const d = P.direction(); d.designSystem = pr.designSystem; wj(path.join(P.mh, "direction.json"), d);
  append(P.decisions, { type: "preset", name });
  out("preset " + name + " written to direction.json designSystem. Still yours to write: concept, narrative arc, consistencyRules, antiPatterns; adapt accentRule and hierarchy to this subject. Then mh tokens.");
};

C.tokens = (pos) => {
  // write design-system tokens into the project's :root so scenes can use var(--mh-*)
  const P = proj(pos[0]); const d = P.direction().designSystem, fmt = P.fmt();
  const pal = { muted: d.palette.ink, surface: d.palette.ground, line: "rgba(0,0,0,.18)", ...d.palette };
  const vars = Object.entries(pal).map(([k, v]) => "  --mh-" + k + ":" + v + ";").join("\n");
  const fonts = '  --mh-font-display:"' + d.typography.display.family + '",sans-serif;\n  --mh-font-body:"' + d.typography.body.family + '",sans-serif;' + (d.typography.data ? '\n  --mh-font-mono:"' + d.typography.data.family + '",monospace;' : "");
  const css = ":root{\n" + vars + "\n" + fonts + "\n  --mh-margin:" + d.composition.margin + "px;\n  --mh-safe-x:" + fmt.safeX + "px;\n  --mh-safe-y:" + fmt.safeY + "px;\n}\n";
  fs.writeFileSync(path.join(P.dir, "assets/mh-tokens.css"), `/* generated from .mh/direction.json by mh tokens — do not hand-edit; change the design system and re-run */\n` + css);
  out("assets/mh-tokens.css written; link it AFTER mh-motion.css in index.html (and it applies inside scenes too).");
};

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !C[cmd]) {
  out(`mh <command>\n  new adopt status lint review-plan decide advance revise lock cues ref import frames gate checklist handoff studio direction-md tokens preset sync-lib
  quality: storylines describe note review-done ban assertions compare capture\nSee AGENTS.md for the workflow.`);
  process.exit(cmd ? 1 : 0);
}
const { pos, flags } = parseArgs(rest);
C[cmd](pos, flags);
