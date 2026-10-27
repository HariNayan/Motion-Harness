// craft.mjs: the quality mechanics learned from how Claude Code + the HyperFrames skill produce good motion graphics.
//   storylines  three genuinely different films, one picked (skill: story.md)
//   copy/hook   banned marketing words, line length, a real first two seconds (story.md 3 and 6)
//   motion      bounce only on objects, more than one ease (motion.md)
//   review      stranger-eyes beat descriptions, P0/P1/P2 notes, a delivery note REVIEW.md (review.md)
//   references  measured palette, side-by-side compare against the reference (recreating-references)
//   assertions  storyboard intent written as <scene>.motion.json so `hyperframes check` verifies it (motion.md)
//   capture     brand intake from a website (look.md)
// mh.mjs passes in its helpers; nothing here renders.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function craft({ ROOT, CFG, rj, wj, now, append, out, die, proj, hf, readLines }) {
  const STORY_FIELDS = ["id", "name", "device", "form", "world", "summary", "first2s", "beats", "look", "sound"];
  const BANNED_COPY = /\b(unlock|seamless(ly)?|supercharge[ds]?|game[- ]?changer|revolutioni[sz]e[sd]?|effortless(ly)?)\b/i;
  const ASSERT_KINDS = ["appearsBy", "before", "staysInFrame", "keepsMoving"];
  const SEV = ["P0", "P1", "P2"];
  const storyFile = (P) => path.join(P.mh, "storylines.json");
  const reviewFile = (P) => path.join(P.mh, "review.json");
  const readReview = (P) => rj(reviewFile(P), { descriptions: [], notes: [], done: null });
  const needStory = (P) => CFG.depth[P.state.depth].storylines || "off";
  const wc = (s) => String(s).split(/\s+/).filter(Boolean).length;

  /* ----------------------------------------------------------- plan lint additions */
  function lintStorylines(P, add) {
    if (P.state.adopted) return;
    if (P.state.storylinesWaived) { add("info", "story.waived", `storylines waived: ${P.state.storylinesWaived}`); return; }
    const need = needStory(P), st = rj(storyFile(P));
    if (!st) { if (need === "required") add("error", "story.missing", "write .mh/storylines.json: THREE different films (own world, device and form), a recommendation, then mh storylines pick"); else if (need === "recommended") add("warn", "story.missing", "no storylines.json: depth recommends three different storylines before the design direction"); return; }
    const L = Array.isArray(st.storylines) ? st.storylines : [];
    if (L.length !== 3) { add("error", "story.count", `${L.length} storylines: write exactly three`); return; }
    L.forEach((x, i) => { for (const k of STORY_FIELDS) if (!x[k] || /\bTODO\b/.test(String(x[k]))) add("error", "story.field", `storyline ${i + 1} (${x.id || "?"}): "${k}" is empty`); });
    const key = (s) => String(s || "").toLowerCase().trim();
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      if (key(L[i].device) === key(L[j].device) && key(L[i].form) === key(L[j].form)) add("error", "story.same", `storylines ${L[i].id} and ${L[j].id} share device AND form: they are one film, not two`);
      else if (key(L[i].device) === key(L[j].device) || key(L[i].form) === key(L[j].form)) add("warn", "story.similar", `storylines ${L[i].id} and ${L[j].id} share a device or a form: make them differ more`);
    }
    if (!st.recommended || !L.some((x) => x.id === st.recommended)) add("error", "story.recommend", "recommended must be the id of one storyline");
    if (!st.reason) add("error", "story.reason", "give the reason for the recommendation in one clause");
    if (st.picked && !L.some((x) => x.id === st.picked)) add("error", "story.picked", "picked is not one of the storyline ids");
  }
  function lintExtra(P, d, sc, add) {
    lintStorylines(P, add);
    sc.forEach((s, i) => {
      (s.text || []).forEach((t) => {
        const n = wc(t);
        if (n > 10) add("warn", "copy.long", `text line has ${n} words (titles <= 6, explainer lines <= 10): "${String(t).slice(0, 48)}"`, s.id);
        if (BANNED_COPY.test(t)) add("error", "copy.banned", `banned marketing word in "${String(t).slice(0, 48)}" (unlock, seamless, supercharge, game-changer, revolutionize, effortless)`, s.id);
        if (/\bin seconds\b/i.test(t)) add("warn", "copy.unmeasured", '"in seconds" is only allowed when it was measured', s.id);
      });
      if (i === 0) {
        if (/^\s*(introducing|meet|welcome)\b/i.test((s.text || [])[0] || "")) add("warn", "hook.opener", 'first line is never "Introducing", "Meet" or "Welcome": open on the subject working or the need', s.id);
        if (!s.first2s) add("warn", "hook.missing", "first scene needs first2s: exactly what is on screen in the first two seconds (frame 0 is the thumbnail: never black, never a logo alone)", s.id);
        else if (/^\s*(a\s+)?(logo|black|blank|empty|fade)/i.test(s.first2s)) add("warn", "hook.weak", "the first two seconds are the densest of the film: not a logo, black or an empty fade", s.id);
      }
      (s.assertions || []).forEach((a, k) => { if (!ASSERT_KINDS.includes(a.kind)) add("error", "assert.kind", `assertion ${k + 1}: kind must be one of ${ASSERT_KINDS.join("/")}`, s.id); });
    });
  }

  /* ----------------------------------------------------------- source scan additions */
  function scanExtra(files, readSrc, add) {
    const explicit = [];
    for (const [id] of files) {
      if (id === "index") continue;
      const src = readSrc(id);
      if (/(elastic\.out|back\.out|bounce\.(out|in))/.test(src)) add("warn", "motion.bounce", "bounce/spring easing found: it belongs on physical objects only, never on text, UI or numbers (a counter must not overshoot its value)", id);
      for (const m of src.matchAll(/ease\s*:\s*["']([^"']+)["']/g)) explicit.push(m[1]);
    }
    if (explicit.length >= 12 && new Set(explicit).size <= 1) add("warn", "motion.oneease", `${explicit.length} tweens all use the same ease ("${explicit[0]}"): one curve everywhere is the flat default that reads as generated; vary it by role (long-tail arrivals, in-out camera moves, accelerating exits)`);
  }

  /* --------------------------------------------------------------- gate additions */
  function gateExtra(P, add) {
    if (P.state.adopted) return;
    const r = readReview(P);
    r.notes.filter((n) => n.status === "open").forEach((n) => add(n.sev === "P0" ? "error" : n.sev === "P1" ? "warn" : "info", "review." + n.sev.toLowerCase(), `${n.id} t=${n.t} ${n.where}: ${n.problem}`));
    if (P.state.phase === "verify" && CFG.depth[P.state.depth].frameEvidence !== "optional" && !r.done) add("warn", "review.notdone", "run mh review-done (weakest shot, creative calls, what nobody checked) before handoff");
  }
  function advanceChecks(P, phase) {
    const fails = [];
    if (P.state.adopted) return fails;
    if (phase === "direction") {
      const st = rj(storyFile(P)), need = needStory(P);
      if (!P.state.storylinesWaived) {
        if (need === "required" && !st) fails.push("story.missing: write .mh/storylines.json (three different films) first");
        if (st) {
          const msgs = []; lintStorylines(P, (lv, code, msg) => { if (lv === "error") msgs.push(`${code}: ${msg}`); }); fails.push(...msgs);
          if (!st.picked) fails.push("no storyline picked yet: mh storylines pick <slug> <id> (the user's choice, or your recommendation when running unattended)");
        }
      }
    }
    if (phase === "verify" && CFG.depth[P.state.depth].frameEvidence !== "optional") {
      const r = readReview(P), need = (P.storyboard() || { scenes: [] }).scenes.length;
      if (!r.done) fails.push("review not recorded: describe each beat (mh describe), file notes, then mh review-done");
      if (r.notes.some((n) => n.sev === "P0" && n.status === "open")) fails.push("open P0 review note(s): fix or justify them");
      if (CFG.depth[P.state.depth].frameEvidence === "required" && r.descriptions.length < need) fails.push(`${r.descriptions.length}/${need} stranger-eyes beat descriptions (mh describe --t <s> --text "…")`);
    }
    return fails;
  }

  /* ------------------------------------------------------------------ REVIEW.md */
  function writeReviewMd(P, gr, cl) {
    const r = readReview(P); if (!r.done) return null;
    const st = rj(storyFile(P)), dec = readLines(P.decisions).filter((x) => x.type === "decision");
    const picked = st && st.storylines ? st.storylines.find((x) => x.id === st.picked) : null;
    const L = [`# Review: ${P.slug}`, "", "## Creative calls"];
    if (picked) L.push(`- **Storyline built:** ${picked.name} (${picked.device} × ${picked.form}). ${st.picked === st.recommended ? "It was the recommendation." : `Recommended was ${st.recommended}; this one was picked.`}`);
    if (st && st.storylines) for (const x of st.storylines.filter((y) => y.id !== st.picked)) L.push(`- Not built: **${x.name}** (${x.device} × ${x.form}): ${x.summary}`);
    L.push(`- ${r.done.summary}`); dec.slice(-10).forEach((x) => L.push(`- ${x.what}${x.why ? ` (${x.why})` : ""}`));
    L.push("", "## What was measured, what was looked at", `- **Measured:** gate ${gr.counts.error} error(s), ${gr.counts.warn} warning(s); visual evidence ${gr.visualEvidence}.`);
    const vis = Object.entries(cl.items).filter(([, v]) => v.basis === "visual").map(([k]) => k);
    L.push(`- **Looked at:** ${r.descriptions.length} beat frame(s) described below; checklist items judged from frames: ${vis.join(", ") || "none"}.`);
    r.descriptions.forEach((x) => L.push(`  - t=${x.t}s: ${x.text}`));
    L.push(`- **Nobody checked:** ${r.done.unchecked}`);
    L.push("", "## Weakest shot", r.done.weakest, "", "## Review notes");
    if (!r.notes.length) L.push("No P0/P1/P2 notes were filed.");
    else { L.push("| id | sev | t | where | problem → change | status |", "| --- | --- | --- | --- | --- | --- |"); r.notes.forEach((n) => L.push(`| ${n.id} | ${n.sev} | ${n.t} | ${n.where} | ${n.problem} → ${n.fix} (keep: ${n.keep || "—"}) | ${n.status}${n.why ? ": " + n.why : ""} |`)); }
    L.push("", "## Warnings kept on purpose");
    const kept = r.notes.filter((n) => n.how === "kept"); const warns = gr.findings.filter((x) => x.level === "warn");
    if (!kept.length && !warns.length) L.push("None.");
    kept.forEach((n) => L.push(`- ${n.id}: ${n.why}`)); warns.forEach((x) => L.push(`- ${x.code}${x.scene ? " [" + String(x.scene).split(/[\\/]/).pop() + "]" : ""}: ${String(x.msg).slice(0, 200)}`));
    fs.writeFileSync(path.join(P.dir, "REVIEW.md"), L.join("\n") + "\n");
    return path.join(P.dir, "REVIEW.md");
  }

  /* ---------------------------------------------------------------- palette */
  function samplePalette(files, n = 6) {
    const bins = new Map();
    for (const f of files) {
      const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-vf", "scale=48:27:flags=area", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 8 << 20 });
      const b = r.stdout; if (!b || b.length < 3) continue;
      for (let i = 0; i + 2 < b.length; i += 3) { const k = ((b[i] >> 4) << 8) | ((b[i + 1] >> 4) << 4) | (b[i + 2] >> 4); const e = bins.get(k) || { c: 0, r: 0, g: 0, b: 0 }; e.c++; e.r += b[i]; e.g += b[i + 1]; e.b += b[i + 2]; bins.set(k, e); }
    }
    const total = [...bins.values()].reduce((a, e) => a + e.c, 0) || 1, out2 = [];
    for (const e of [...bins.values()].sort((x, y) => y.c - x.c)) {
      const c = [e.r / e.c, e.g / e.c, e.b / e.c].map(Math.round);
      if (out2.some((o) => Math.hypot(o.rgb[0] - c[0], o.rgb[1] - c[1], o.rgb[2] - c[2]) < 48)) continue;
      out2.push({ hex: "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""), rgb: c, share: +(100 * e.c / total).toFixed(1) });
      if (out2.length >= n) break;
    }
    return out2.map(({ hex, share }) => ({ hex, sharePercent: share }));
  }

  /* --------------------------------------------------------------- commands */
  const commands = {};

  commands.storylines = (pos, f) => {
    const [slug, sub, id] = pos; const P = proj(slug);
    if (sub === "pick") {
      const st = rj(storyFile(P)); if (!st) die("no storylines.json yet");
      const x = (st.storylines || []).find((y) => y.id === id); if (!x) die(`unknown id "${id}". Choose from: ${(st.storylines || []).map((y) => y.id).join(", ")}`);
      st.picked = id; wj(storyFile(P), st);
      const md = ["# Storylines", "", `**Picked: ${x.name}** (recommended: ${st.recommended}, ${st.reason})`, "", ...st.storylines.flatMap((y) => [`## ${y.id.toUpperCase()}. ${y.name}${y.id === id ? " ← picked" : ""}`, `- Device: ${y.device} · Form: ${y.form} · World: ${y.world}`, `- ${y.summary}`, `- First two seconds: ${y.first2s}`, `- Beats: ${y.beats}`, `- Look: ${y.look}`, `- Sound: ${y.sound}`, ""])];
      fs.writeFileSync(path.join(P.dir, "STORYLINES.md"), md.join("\n"));
      append(P.decisions, { type: "decision", what: `Picked storyline ${id}: ${x.name}`, why: id === st.recommended ? "the recommendation" : `chosen over the recommended ${st.recommended}`, scene: null });
      out(`picked ${id}: ${x.name}. STORYLINES.md written. Build the direction and storyboard from THIS storyline (its look, beats and first two seconds).`);
    } else if (sub === "waive") {
      if (!f.reason) die('usage: mh storylines waive <slug> --reason "…"');
      P.saveState({ ...P.state, storylinesWaived: f.reason }); append(P.decisions, { type: "decision", what: "Storylines waived", why: f.reason, scene: null }); out("waived");
    } else {
      const st = rj(storyFile(P)); if (!st) { out("no storylines.json"); return; }
      st.storylines.forEach((y) => out(`${y.id}${y.id === st.picked ? " *" : ""}${y.id === st.recommended ? " (recommended)" : ""}  ${y.name}  [${y.device} × ${y.form}]`));
    }
  };

  commands.describe = (pos, f) => {
    const P = proj(pos[0]); if (f.t == null || !f.text || f.t === true) die('usage: mh describe <slug> --t 4.2 --text "one sentence a stranger would say, naming every object"');
    const r = readReview(P); const t = +f.t;
    r.descriptions = r.descriptions.filter((x) => x.t !== t).concat({ t, text: String(f.text), at: now() }).sort((a, b) => a.t - b.t); wj(reviewFile(P), r);
    out(`described t=${t}s (${r.descriptions.length} beat description(s))`);
  };

  commands.note = (pos, f) => {
    const [slug, sub, id] = pos; const P = proj(slug), r = readReview(P);
    if (sub === "add") {
      if (!SEV.includes(f.sev) || !f.where || !f.problem || !f.fix) die('usage: mh note <slug> add --sev P0|P1|P2 --t 4.2 --where "#el or scene" --problem "…" --fix "the exact change" [--keep "what stays"]');
      const n = { id: "n" + (r.notes.length + 1), sev: f.sev, t: f.t ?? "film", where: f.where, problem: f.problem, fix: f.fix, keep: f.keep || "", status: "open", at: now() };
      r.notes.push(n); wj(reviewFile(P), r); out(`${n.id} filed: ${n.sev} t=${n.t} ${n.where}: ${n.problem} → ${n.fix}`);
    } else if (sub === "resolve") {
      const n = r.notes.find((x) => x.id === id); if (!n) die("unknown note " + id);
      if (!["fixed", "kept"].includes(f.how) || !f.why) die('usage: mh note <slug> resolve <id> --how fixed|kept --why "what changed, or why it stays on purpose"');
      Object.assign(n, { status: f.how === "fixed" ? "fixed" : "kept", how: f.how, why: f.why, resolvedAt: now() }); wj(reviewFile(P), r); out(`${id} ${n.status}`);
    } else {
      r.notes.forEach((n) => out(`${n.id} ${n.sev} ${n.status.padEnd(5)} t=${n.t} ${n.where}: ${n.problem} → ${n.fix}`));
      out(`${r.notes.filter((n) => n.status === "open").length} open of ${r.notes.length}; ${r.descriptions.length} beat description(s)`);
    }
  };

  commands["review-done"] = (pos, f) => {
    const P = proj(pos[0]), r = readReview(P);
    if (!f.weakest || !f.summary || !f.unchecked) die('usage: mh review-done <slug> --summary "the creative calls you made" --weakest "the weakest shot and what you would change" --unchecked "what nobody checked (e.g. sound was not heard)"');
    const openP0 = r.notes.filter((n) => n.sev === "P0" && n.status === "open"); if (openP0.length) die(`${openP0.length} open P0 note(s): ${openP0.map((n) => n.id).join(", ")}`);
    const need = (P.storyboard() || { scenes: [] }).scenes.length;
    if (r.descriptions.length < need) { const m = `${r.descriptions.length}/${need} beat descriptions`; if (CFG.depth[P.state.depth].frameEvidence === "required") die(m + " (required at this depth)"); out("note: " + m); }
    r.done = { summary: f.summary, weakest: f.weakest, unchecked: f.unchecked, at: now() }; wj(reviewFile(P), r);
    append(P.decisions, { type: "review-done" }); out("review recorded; REVIEW.md is written at handoff");
  };

  commands.ban = (pos, f) => {
    const P = proj(pos[0]), text = pos.slice(1).join(" ") || f.text; if (!text) die('usage: mh ban <slug> "a tell the frames showed"');
    const d = P.direction(); d.antiPatterns = [...(d.antiPatterns || []), text]; wj(path.join(P.mh, "direction.json"), d);
    append(P.decisions, { type: "decision", what: "Added to anti-patterns: " + text, why: "seen in the frames", scene: null }); out("added to antiPatterns (the BANNED line)");
  };

  commands.assertions = (pos) => {
    // `hyperframes check` reads ONE index.motion.json next to the root index.html (measured: a file next to a sub-composition is ignored)
    // and times are global film seconds; the storyboard states bySec per scene, so add the scene host's data-start.
    const P = proj(pos[0]), sb = P.storyboard(); const all = [];
    const html = fs.existsSync(path.join(P.dir, "index.html")) ? fs.readFileSync(path.join(P.dir, "index.html"), "utf8") : "";
    const startOf = (id) => { const m = new RegExp('<div\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html); const t = m && /data-start="([\d.]+)"/.exec(m[0]); return t ? +t[1] : 0; };
    for (const s of (sb && sb.scenes) || []) for (const a of s.assertions || []) {
      if (!ASSERT_KINDS.includes(a.kind)) die(`${s.id}: unknown assertion kind "${a.kind}"`);
      all.push(a.bySec != null ? { ...a, bySec: +(startOf(s.id) + a.bySec).toFixed(3) } : a);
    }
    const file = path.join(P.dir, "index.motion.json");
    if (!all.length) { out("no scene declares assertions (storyboard scenes[].assertions: appearsBy{selector,bySec} / before{a,b} / staysInFrame{selector} / keepsMoving{withinSelector})"); return; }
    wj(file, { assertions: all }); out(`index.motion.json: ${all.length} assertion(s) (scene-local bySec converted to film time). mh gate / hyperframes check verifies them on the seeked timeline and reports motion_appears_late etc.`);
  };

  commands.compare = (pos, f) => {
    const [slug, ref] = pos; const P = proj(slug);
    if (!ref || !f.at) die("usage: mh compare <slug> <reference video name> --at 1,3,5   (writes a side-by-side sheet: render | reference)");
    const rp = path.join(P.mh, "references", path.basename(ref)); if (!fs.existsSync(rp)) die("no such reference: " + ref);
    const od = path.join(P.mh, "compare"); fs.mkdirSync(od, { recursive: true });
    const r = hf(["snapshot", P.dir, "-o", od, "--at", String(f.at), "--against", rp, "--no-end", "--json"], P.dir);
    const files = fs.readdirSync(od).filter((x) => /\.(png|jpg)$/.test(x));
    if (!files.length) die("snapshot --against produced nothing: " + (r.stdout + r.stderr).slice(-300));
    out(`${files.length} file(s) in ${od}. Open the pair sheet(s) and compare ONE axis at a time (timing, colour, type, camera); fix one property with an absolute target, keep what already matches.\n` + files.map((x) => "  " + path.join(od, x)).join("\n"));
  };

  commands.capture = (pos) => {
    const [slug, url] = pos; const P = proj(slug);
    if (!url || !/^https?:\/\/[^\s]+$/.test(url)) die("usage: mh capture <slug> <https://site>   (takes the real brand: colours, fonts, copy, logos, screenshots)");
    const dirName = "capture-" + Date.now().toString(36);
    const r = hf(["capture", url, "-o", dirName, "--json", "--skip-vision"], P.mh);
    const cd = path.join(P.mh, dirName);
    if (!fs.existsSync(cd) || /BLOCKED\.md/.test(fs.readdirSync(cd).join(" "))) die("capture failed or was blocked: take no brand data from partial files.\n" + (r.stdout + r.stderr).slice(-400));
    const list = (d, depth = 0) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() && depth < 2 ? list(path.join(d, e.name), depth + 1).map((x) => e.name + "/" + x) : [e.name]);
    const files = list(cd).slice(0, 60);
    wj(path.join(P.mh, "brand.json"), { url, dir: dirName, capturedAt: now(), files });
    append(P.decisions, { type: "decision", what: "Captured brand from " + url, why: "real brand material beats invented", scene: null });
    out(`captured ${url} into .mh/${dirName}/ (${files.length} files). Look at the screenshots, read extracted/tokens.json and extracted/visible-text.txt, quote hex values and copy EXACTLY, and make only claims the source makes.\n` + files.slice(0, 40).map((x) => "  " + x).join("\n"));
  };

  return { commands, lintExtra, scanExtra, gateExtra, advanceChecks, writeReviewMd, samplePalette };
}
