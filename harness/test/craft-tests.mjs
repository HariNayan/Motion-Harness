// Unit tests for harness/craft.mjs (the quality mechanics). No model, no browser. Run: node harness/test/craft-tests.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { craft } from "../craft.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG = JSON.parse(fs.readFileSync(path.join(HERE, "..", "..", "harness.config.json"), "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mh-craft-"));
const rj = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const wj = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2)); };
const readLines = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const append = (p, o) => fs.appendFileSync(p, JSON.stringify(o) + "\n");
let outText = ""; const out = (s = "") => { outText += s + "\n"; };
const die = (s) => { throw new Error(s); };

const scenes = [{ id: "s1", duration: 3 }, { id: "s2", duration: 3 }];
const mkP = (depth) => {
  const dir = fs.mkdtempSync(path.join(tmp, "p-")), mh = path.join(dir, ".mh"); fs.mkdirSync(mh, { recursive: true });
  const P = { dir, mh, slug: "t", state: { depth, format: "horizontal", phase: "direction" }, decisions: path.join(mh, "decisions.jsonl"), storyboard: () => ({ scenes }), direction: () => ({ antiPatterns: [] }), saveState(s) { this.state = s; } };
  return P;
};
let P = mkP("high");
const X = craft({ ROOT: tmp, CFG, rj, wj, now: () => "2026-01-01T00:00:00Z", append, out, die, proj: () => P, hf: () => ({ stdout: "", stderr: "", code: 1 }), readLines });

let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const lint = (sc) => { const F = []; X.lintExtra(P, {}, sc, (level, code, msg, scene) => F.push({ level, code, scene, msg })); return F; };
const has = (F, code, level) => F.some((f) => f.code === code && (!level || f.level === level));

// copy and hook
let F = lint([{ id: "s1", text: ["Introducing the seamless way to unlock more", "one two three four five six seven eight nine ten eleven"], duration: 3 }, { id: "s2", text: ["Done in seconds"], duration: 3 }]);
ok(has(F, "copy.banned", "error"), "banned marketing words are an error");
ok(has(F, "copy.long", "warn"), "a line over 10 words warns");
ok(has(F, "copy.unmeasured", "warn"), '"in seconds" warns unless measured');
ok(has(F, "hook.opener", "warn"), 'a first line starting "Introducing" warns');
ok(has(F, "hook.missing", "warn"), "first scene without first2s warns");
F = lint([{ id: "s1", text: ["Tides turn twice a day"], first2s: "Black screen with a fade-in logo", duration: 3 }]);
ok(has(F, "hook.weak", "warn"), "a logo/black first two seconds warns");
F = lint([{ id: "s1", text: ["Tides turn twice a day"], first2s: "The Moon already crosses the sky above a gold-rimmed Earth", duration: 3, assertions: [{ kind: "bogus" }] }]);
ok(has(F, "assert.kind", "error") && !has(F, "hook.missing"), "unknown assertion kind errors; a real first2s clears the hook warning");

// storylines
const mk = (id, device, form) => ({ id, name: "N" + id, device, form, world: "w", summary: "s", first2s: "f", beats: "b", look: "l", sound: "s" });
F = lint([{ id: "s1", text: ["x"], first2s: "y z", duration: 3 }]);
ok(has(F, "story.missing", "error"), "high depth without storylines.json is an error");
wj(path.join(P.mh, "storylines.json"), { recommended: "a", reason: "r", picked: null, storylines: [mk("a", "The result first", "One continuous take"), mk("b", "The result first", "One continuous take"), mk("c", "A number lands", "Cut on the beat")] });
F = lint([{ id: "s1", text: ["x"], first2s: "y z", duration: 3 }]);
ok(has(F, "story.same", "error"), "two storylines with the same device AND form are one film");
wj(path.join(P.mh, "storylines.json"), { recommended: "c", reason: "r", picked: null, storylines: [mk("a", "The result first", "One continuous take"), mk("b", "Life before and after", "Match cuts"), mk("c", "A number lands", "Cut on the beat")] });
F = lint([{ id: "s1", text: ["x"], first2s: "y z", duration: 3 }]);
ok(!F.some((f) => f.level === "error" && f.code.startsWith("story.")), "three different storylines pass");
ok(X.advanceChecks(P, "direction").some((m) => /no storyline picked/.test(m)), "leaving the direction phase needs a picked storyline");
X.commands.storylines(["t", "pick", "c"], {});
ok(X.advanceChecks(P, "direction").length === 0 && fs.existsSync(path.join(P.dir, "STORYLINES.md")), "after picking, direction can advance and STORYLINES.md exists");
let threw = ""; try { X.commands.storylines(["t", "pick", "zzz"], {}); } catch (e) { threw = e.message; }
ok(/unknown id/.test(threw), "picking an unknown id is refused");
P.state.storylinesWaived = "old project"; fs.rmSync(path.join(P.mh, "storylines.json"));
ok(X.advanceChecks(P, "direction").length === 0, "a waived project is not blocked");
P = mkP("draft"); ok(!lint([{ id: "s1", text: ["x"], first2s: "y z", duration: 3 }]).some((f) => f.code.startsWith("story.")), "draft depth does not ask for storylines");

// review gating
P = mkP("high");
ok(X.advanceChecks(P, "verify").some((m) => /review not recorded/.test(m)), "verify needs a recorded review");
X.commands.note(["t", "add"], { sev: "P0", t: "4.2", where: "#a", problem: "unreadable", fix: "enlarge to 40px", keep: "layout" });
ok(X.advanceChecks(P, "verify").some((m) => /open P0/.test(m)), "an open P0 blocks");
threw = ""; try { X.commands["review-done"](["t"], { weakest: "w", summary: "s", unchecked: "sound" }); } catch (e) { threw = e.message; }
ok(/open P0/.test(threw), "review-done refuses while a P0 is open");
X.commands.note(["t", "resolve", "n1"], { how: "fixed", why: "enlarged" });
threw = ""; try { X.commands["review-done"](["t"], { weakest: "w", summary: "s", unchecked: "sound" }); } catch (e) { threw = e.message; }
ok(/beat descriptions/.test(threw), "high depth needs a stranger-eyes description for every scene");
X.commands.describe(["t"], { t: 1, text: "A gold TWO beside a blue Earth." }); X.commands.describe(["t"], { t: 4, text: "Two panels around an Earth." });
X.commands["review-done"](["t"], { weakest: "the callout leader", summary: "Chose the orbit story", unchecked: "sound was not heard" });
ok(X.advanceChecks(P, "verify").length === 0, "with a closed review, verify can advance");
const gr = { counts: { error: 0, warn: 1 }, visualEvidence: "fresh", findings: [{ level: "warn", code: "x.y", msg: "m" }] };
const cl = { items: { opening: { basis: "visual", status: "pass", evidence: "e" } } };
const rp = X.writeReviewMd(P, gr, cl), md = fs.readFileSync(rp, "utf8");
ok(/Weakest shot\nthe callout leader/.test(md) && /Nobody checked:\*\* sound was not heard/.test(md) && /n1 \| P0/.test(md) && /fixed: enlarged/.test(md), "REVIEW.md carries the weakest shot, what nobody checked and the notes");
X.commands.ban(["t", "floating", "cards"], {}); ok(rj(path.join(P.mh, "direction.json"), null) !== null, "ban writes the anti-pattern");

// source scan
const logs = []; const files = [["index", "index.html"], ["s1", "s1.html"], ["s2", "s2.html"]];
const src = { s1: 'tl.fromTo("#a",{},{ease:"back.out(1.7)"})', s2: "x" };
X.scanExtra(files, (id) => src[id], (level, code, msg, scene) => logs.push({ level, code, scene }));
ok(logs.some((l) => l.code === "motion.bounce" && l.scene === "s1"), "bounce easing in a scene warns");
const many = Array.from({ length: 14 }, () => 'a({ease:"power2.out"})').join(";");
const logs2 = []; X.scanExtra(files, (id) => (id === "s1" ? many : "x"), (level, code) => logs2.push(code));
ok(logs2.includes("motion.oneease"), "14 tweens on one ease warn that one curve everywhere reads as generated");

// palette sampling from real pixels (needs ffmpeg)
const img = path.join(tmp, "c.png");
const g = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=0xffb300:s=64x64:d=1", "-frames:v", "1", img]);
if (g.status === 0) { const pal = X.samplePalette([img]); ok(pal.length >= 1 && /^#f[ef][ab][0-3]/i.test(pal[0].hex) , `palette is measured from pixels (${pal[0] && pal[0].hex} for #ffb300)`); }
else console.log("SKIP palette (ffmpeg not available)");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : "\nall passed"); process.exit(fails ? 1 : 0);
