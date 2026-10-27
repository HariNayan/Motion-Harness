#!/usr/bin/env node
// Motion harness dashboard: a local, zero-dependency web app.
// Connects to OpenCode the way Leadsmith does (no HTTP API): it runs the CLI headless,
//   opencode run --format json --agent motion-director [--model provider/model]
// from the motion-harness folder (so .opencode/agents, tools and permissions apply), sends the prompt on stdin,
// and turns the JSON event lines into a live log. Projects are read from projects/*/.mh/.
// It never renders: "Open in Studio" starts the HyperFrames preview; render/export stay in Studio.
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PUBLIC = path.join(HERE, "public");
const DATA = process.env.MH_DASH_DATA || path.join(HERE, "data");
const PORT = +(process.env.MH_DASH_PORT || 4177);
const OPENCODE = process.env.MH_OPENCODE_BIN || "opencode"; // override for tests
const IS_WIN = process.platform === "win32";
fs.mkdirSync(path.join(DATA, "jobs"), { recursive: true });

const rj = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const wj = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2));
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const MODEL = /^[\w.@-]+\/[\w.:@/+-]+$/;
const INBOX = path.join(ROOT, "inbox");
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|scr|ps1|vbs|lnk|dll|sh)$/i;
const MAX_FILE = 4 * 1024 ** 3; // 4 GB per file: reference videos and raw footage can be large
const KINDS = [["video", /\.(mp4|mov|m4v|webm|mkv|avi)$/i], ["image", /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i], ["audio", /\.(mp3|wav|m4a|aac|ogg|flac)$/i], ["font", /\.(woff2?|ttf|otf)$/i], ["doc", /\.(pdf|txt|md|csv|json|docx?|pptx?|xlsx?)$/i]];
const kindOf = (n) => (KINDS.find(([, re]) => re.test(n)) || ["other"])[0];
const safeName = (n) => path.basename(String(n)).replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "file";
const UPID = /^[a-f0-9]{8}$/;
fs.mkdirSync(INBOX, { recursive: true });
function inboxFile(id) { // the single file inside inbox/<id>/
  if (!UPID.test(id)) return null; const d = path.join(INBOX, id);
  try { const n = fs.readdirSync(d)[0]; return n ? { id, name: n, abs: path.join(d, n), rel: "inbox/" + id + "/" + n, size: fs.statSync(path.join(d, n)).size, kind: kindOf(n) } : null; } catch { return null; }
}
const settingsPath = path.join(DATA, "settings.json");
const settings = () => ({ model: "", ...rj(settingsPath, {}) });

/* ---------------------------------------------------------------- opencode */
function run(cmd, args, opts = {}) {
  // fixed, validated args only; shell:true is needed on Windows for the npm .cmd shim
  return spawnSync(cmd, args, { encoding: "utf8", shell: opts.shell === undefined ? IS_WIN : opts.shell, timeout: opts.timeout || 60000, cwd: opts.cwd || ROOT, windowsHide: true, env: { ...process.env, ...(opts.env || {}) } });
}
const strip = (s) => String(s || "").replace(/\x1b\[[0-9;]*m/g, "");

let connCache = { at: 0, v: null };
function connection() {
  if (Date.now() - connCache.at < 20000 && connCache.v && connCache.v.model === settings().model) return connCache.v;
  const v = connectionNow(); connCache = { at: Date.now(), v }; return v;
}
function connectionNow() {
  const v = run(OPENCODE, ["--version"], { timeout: 15000 });
  const found = v.status === 0;
  const auth = rj(path.join(os.homedir(), ".local", "share", "opencode", "auth.json"), {});
  const kind = { oauth: "subscription", api: "API key" };
  const providers = Object.entries(auth).map(([id, e]) => ({ id, how: kind[e && e.type] || "credential" })); // names only, never keys
  const env = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"].filter((k) => process.env[k]).map((k) => ({ id: k.replace(/_API_KEY$/, "").toLowerCase(), how: "environment variable" }));
  const agentDir = path.join(ROOT, ".opencode", "agent");
  return {
    found, version: found ? strip(v.stdout).trim() : null,
    hint: found ? null : "OpenCode was not found on PATH. Install it with `npm install -g opencode-ai`, then run `opencode auth login`.",
    providers: [...providers, ...env.filter((e) => !providers.some((p) => p.id === e.id))],
    agentReady: fs.existsSync(path.join(agentDir, "motion-director.md")),
    model: settings().model,
  };
}

let modelCache = { at: 0, list: [] };
function models(force) {
  if (!force && Date.now() - modelCache.at < 5 * 60000 && modelCache.list.length) return modelCache.list;
  const out = run(OPENCODE, ["models"], { timeout: 60000 });
  const list = strip(out.stdout).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[\w.@-]+\/\S+$/.test(l));
  if (list.length) modelCache = { at: Date.now(), list };
  return list;
}

/* -------------------------------------------------------------------- jobs */
const jobs = new Map(); // id -> {meta, log[], subs:Set, proc}
const jobFile = (id) => path.join(DATA, "jobs", id + ".json");
function saveJob(j) { wj(jobFile(j.meta.id), { meta: j.meta, log: j.log }); }
function loadJobs() {
  for (const f of fs.readdirSync(path.join(DATA, "jobs")).filter((x) => x.endsWith(".json"))) {
    const o = rj(path.join(DATA, "jobs", f)); if (!o) continue;
    if (o.meta.status === "running") { o.meta.status = "interrupted"; o.log.push({ t: Date.now(), kind: "error", text: "Dashboard restarted while this job was running." }); }
    jobs.set(o.meta.id, { meta: o.meta, log: o.log, subs: new Set(), proc: null });
  }
}
function emit(j, kind, text) {
  const e = { t: Date.now(), kind, text }; j.log.push(e);
  for (const res of j.subs) res.write(`data: ${JSON.stringify(e)}\n\n`);
}
function short(v, n = 110) { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/** Turn one `opencode run --format json` event into dashboard log entries (shapes as used by Leadsmith's adapter). */
function parseEvent(j, ev) {
  const part = ev.part || {};
  if (ev.sessionID && !j.meta.sessionId) { j.meta.sessionId = ev.sessionID; }
  if (ev.type === "tool_use") {
    const st = part.state || {}, name = String(part.tool || "").replace(/^mh_/, "mh · ");
    const inp = st.input || {};
    const detail = inp.slug || inp.command || inp.filePath || inp.file_path || inp.path || inp.name || short(inp, 80);
    emit(j, st.status === "error" ? "toolerr" : "tool", `${name} ${short(detail, 90)}${st.status === "error" ? "  ✗ " + short(st.error || "", 160) : ""}`);
  } else if (ev.type === "text" && String(part.text || "").trim()) {
    emit(j, "text", part.text.trim());
  } else if (ev.type === "step_finish") {
    j.meta.cost = (j.meta.cost || 0) + Number(part.cost || 0);
  } else if (ev.type === "error") {
    const err = ev.error || {}; j.meta.error = (err.data && err.data.message) || err.message || short(err, 200); emit(j, "error", j.meta.error);
  }
}

function composePrompt(b) {
  const lines = [];
  if (b.kind === "revise") {
    lines.push(`Revise the existing project "${b.slug}" (projects/${b.slug}). Follow AGENTS.md: mh_status, read .mh/decisions.jsonl and .mh/revisions.jsonl, mh_revise naming only the scenes you will touch, then mh_gate, mh_frames and open the frames you changed. Do not render.`, "", "Requested change:", b.brief);
  } else {
    lines.push("Create a new motion graphics project from the brief below and take it all the way to handoff. Follow AGENTS.md end to end.", "",
      `- Project slug: ${b.slug}`, `- Format: ${b.format}`, `- Planning depth: ${b.depth}`);
    lines.push(b.preset === "night-sky"
      ? "- Design system: apply the `night-sky` preset with mh_preset (persistent world, HUD, captions, a hero object in every scene; density rich)."
      : "- Design system: choose and justify your own (do not default to a dark navy void, glow or centred headlines); every scene still needs a hero object.");
    lines.push("", "Brief:", b.brief, "", "Rules: no rendering or export (the user renders in HyperFrames Studio). Do not claim a visual check unless you opened fresh frames. If you use captions without audio, label the timing as synthetic. Finish with the Studio path, evidence level, gate warnings and what you could not verify.");
  }
  if ((b.attachments || []).length) {
    lines.push("", "Files supplied by the user. After the project exists, import EACH one with mh_importfile (path exactly as written) using the role shown. Follow AGENTS.md, section \"Files the user supplies\".");
    for (const a of b.attachments) lines.push(`- ${a.rel}  [role: ${a.role}] (${a.kind}, ${(a.size / 1048576).toFixed(1)} MB)${a.note ? "  user note: " + a.note : ""}`);
    lines.push("A reference is for look, pacing and structure (never copy it). A raw asset is real material the user wants IN the video: use it, do not redraw it.");
  }
  return lines.join("\n");
}

function startJob(b) {
  const id = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 6);
  const model = b.model && MODEL.test(b.model) ? b.model : "";
  const j = { meta: { id, kind: b.kind, slug: b.slug, model, status: "running", startedAt: Date.now(), cost: 0, sessionId: null, title: short(b.brief.replace(/\s+/g, " "), 80), attachments: (b.attachments || []).map((a) => ({ name: a.name, role: a.role, kind: a.kind, size: a.size })) }, log: [], subs: new Set(), proc: null };
  jobs.set(id, j);
  const args = ["run", "--format", "json", "--agent", "motion-director", ...(model ? ["--model", model] : [])];
  emit(j, "info", `opencode ${args.join(" ")}   (cwd: motion-harness)`);
  let proc;
  try { proc = spawn(OPENCODE, args, { cwd: ROOT, shell: IS_WIN, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: process.env }); }
  catch (e) { j.meta.status = "failed"; emit(j, "error", "Could not start OpenCode: " + e.message); saveJob(j); return j; }
  j.proc = proc;
  proc.on("error", (e) => { j.meta.status = "failed"; emit(j, "error", "Could not start OpenCode: " + e.message); saveJob(j); });
  proc.stdin.end(composePrompt(b));
  let buf = "", err = "";
  proc.stdout.on("data", (d) => {
    buf += d.toString("utf8"); let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { emit(j, "raw", strip(line)); continue; }
      if (ev && typeof ev === "object") parseEvent(j, ev);
    }
    saveJob(j);
  });
  proc.stderr.on("data", (d) => { err += d.toString("utf8"); });
  proc.on("close", (code) => {
    if (buf.trim()) emit(j, "raw", strip(buf.trim()));
    j.proc = null;
    if (j.cancelled) { j.meta.status = "cancelled"; emit(j, "info", "Stopped by you."); }
    else if (code !== 0 || j.meta.error) {
      j.meta.status = "failed";
      let msg = j.meta.error || strip(err).trim().split(/\r?\n/).slice(-6).join("\n") || `OpenCode exited with code ${code}`;
      if (/auth|login|log in|sign in|credential|api key/i.test(msg)) msg += "\nRun `opencode auth login` in a terminal to add a model provider.";
      emit(j, "error", msg);
    } else { j.meta.status = "done"; emit(j, "info", "Finished."); }
    j.meta.finishedAt = Date.now(); saveJob(j);
    for (const res of j.subs) { res.write(`event: end\ndata: {}\n\n`); res.end(); } j.subs.clear();
  });
  saveJob(j);
  return j;
}

function cancelJob(j) {
  if (!j.proc) return false;
  j.cancelled = true;
  if (IS_WIN) spawnSync("taskkill", ["/PID", String(j.proc.pid), "/T", "/F"], { windowsHide: true });
  else j.proc.kill("SIGTERM");
  return true;
}

/* ---------------------------------------------------------------- projects */
const mh = (args, timeout) => run(process.execPath, [path.join(ROOT, "harness", "mh.mjs"), ...args], { timeout: timeout || 600000, shell: false });
function projectDirs() {
  const d = path.join(ROOT, "projects");
  return fs.existsSync(d) ? fs.readdirSync(d).filter((s) => fs.existsSync(path.join(d, s, ".mh", "state.json"))) : [];
}
function readLines(p) { try { return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } }
function bestThumb(fr, pics) {
  // the frame with the most visible structure (from frame-stats.json) makes a better thumbnail than a blank first frame
  const st = rj(path.join(fr, "frame-stats.json"), { stats: {} }).stats || {};
  const ranked = pics.filter((f) => st[f] != null).sort((x, y) => st[y] - st[x]);
  return ranked[0] || pics[0] || null;
}
function projectSummary(slug) {
  const mhd = path.join(ROOT, "projects", slug, ".mh");
  const st = rj(path.join(mhd, "state.json"), {}), gr = rj(path.join(mhd, "gate-report.json")), sb = rj(path.join(mhd, "storyboard.json"));
  const dir = rj(path.join(mhd, "direction.json"));
  const fr = path.join(mhd, "frames");
  const pics = fs.existsSync(fr) ? fs.readdirSync(fr).filter((f) => /^(beat|frame)-.*.png$/.test(f)).sort() : [];
  const mt = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
  const updated = Math.max(mt(path.join(mhd, "state.json")), mt(path.join(mhd, "gate-report.json")), mt(path.join(mhd, "decisions.jsonl")));
  return { slug, thumb: bestThumb(fr, pics), updated, density: (dir && dir.designSystem && dir.designSystem.density) || null, format: st.format, depth: st.depth, phase: st.phase, adopted: !!st.adopted, revisions: st.revisions || 0,
    title: dir && dir.concept ? short(dir.concept, 120) : st.source || "", scenes: sb && sb.scenes ? sb.scenes.length : null,
    gate: gr ? { at: gr.at, errors: gr.counts.error, warnings: gr.counts.warn, evidence: gr.visualEvidence } : null };
}
function assetsOf(slug) {
  const base = path.join(ROOT, "projects", slug);
  const files = (rj(path.join(base, ".mh", "assets.json"), { files: [] }).files || []);
  if (!files.length) return [];
  let src = ""; try { src = fs.readFileSync(path.join(base, "index.html"), "utf8"); } catch {}
  const cd = path.join(base, "compositions"); if (fs.existsSync(cd)) for (const x of fs.readdirSync(cd).filter((n) => n.endsWith(".html"))) src += fs.readFileSync(path.join(cd, x), "utf8");
  return files.map((a) => ({ ...a, used: src.includes(a.path) }));
}
function referencesOf(slug) {
  const dir = path.join(ROOT, "projects", slug, ".mh", "references");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith(".analysis.json")).map((fn) => {
    const a = rj(path.join(dir, fn), {}), name = fn.replace(/\.analysis\.json$/, "");
    return { name, kind: a.kind, complete: !JSON.stringify(a).includes("TODO"), note: a.userNote || "", observed: a.observed || null, rules: a.designRules || [], frames: ((a.observed && a.observed.sampledFrames) || []) };
  });
}
function projectDetail(slug) {
  const mhd = path.join(ROOT, "projects", slug, ".mh"), fr = path.join(mhd, "frames");
  const frames = fs.existsSync(fr) ? fs.readdirSync(fr).filter((f) => /\.(png|jpg)$/.test(f)).sort((a, b) => (/^(review|contact)/.test(a) ? -1 : 0) - (/^(review|contact)/.test(b) ? -1 : 0) || a.localeCompare(b)) : [];
  const gr = rj(path.join(mhd, "gate-report.json"));
  return { ...projectSummary(slug), state: rj(path.join(mhd, "state.json")), brief: (fs.existsSync(path.join(mhd, "brief.md")) ? fs.readFileSync(path.join(mhd, "brief.md"), "utf8") : ""),
    direction: rj(path.join(mhd, "direction.json")), storyboard: rj(path.join(mhd, "storyboard.json")), checklist: rj(path.join(mhd, "checklist.json")),
    findings: gr ? gr.findings.filter((f) => f.level !== "info") : [], frames, frameStats: rj(path.join(fr, "frame-stats.json")),
    decisions: readLines(path.join(mhd, "decisions.jsonl")).slice(-60), revisionLog: readLines(path.join(mhd, "revisions.jsonl")),
    assets: assetsOf(slug),
    references: referencesOf(slug),
    handoff: fs.existsSync(path.join(ROOT, "projects", slug, "HANDOFF.md")) };
}

/* -------------------------------------------------------------------- http */
const SERVE = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8" };
function serveFile(req, res, abs) {
  let st; try { st = fs.statSync(abs); } catch { return send(res, 404, { error: "not found" }); }
  if (!st.isFile()) return send(res, 404, { error: "not found" });
  const ext = path.extname(abs).toLowerCase(), type = SERVE[ext] || MIME[ext] || "application/octet-stream";
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m && (m[1] || m[2])) {
    let a = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), b = m[1] && m[2] ? +m[2] : st.size - 1; b = Math.min(b, st.size - 1);
    if (a > b) { res.writeHead(416, { "content-range": `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${st.size}`, "content-length": b - a + 1 });
    return fs.createReadStream(abs, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": st.size, "cache-control": "no-store" });
  fs.createReadStream(abs).pipe(res);
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let s = ""; req.on("data", (d) => { s += d; if (s.length > 2e5) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  // local-only app: refuse requests whose Host is not loopback (DNS-rebinding guard)
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || "")) return send(res, 403, { error: "forbidden" });
  // CSRF guard: a web page you visit must not be able to start jobs or upload files here. Browsers always send Origin on
  // cross-site POSTs; our own UI is same-origin (loopback), so anything else is refused.
  if (req.method !== "GET" && req.method !== "HEAD" && req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.origin)) { req.resume(); return send(res, 403, { error: "cross-origin request refused" }); }
  try {
    if (req.method === "GET" && p === "/api/connection") return send(res, 200, connection());
    if (req.method === "GET" && p === "/api/models") return send(res, 200, { models: models(url.searchParams.get("refresh") === "1"), selected: settings().model });
    if (req.method === "POST" && p === "/api/settings") {
      const b = await readBody(req); if (b.model !== "" && !MODEL.test(b.model || "")) return send(res, 400, { error: "model must look like provider/model" });
      wj(settingsPath, { ...settings(), model: b.model }); return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && p === "/api/projects") return send(res, 200, projectDirs().map(projectSummary).sort((a, b) => a.slug.localeCompare(b.slug)));
    let m;
    if (req.method === "GET" && (m = /^\/api\/projects\/([a-z0-9-]+)$/.exec(p))) return projectDirs().includes(m[1]) ? send(res, 200, projectDetail(m[1])) : send(res, 404, { error: "no such project" });
    if (req.method === "GET" && (m = /^\/api\/projects\/([a-z0-9-]+)\/frames\/([\w.\-]+\.(?:png|jpg))$/.exec(p))) {
      const f = path.join(ROOT, "projects", m[1], ".mh", "frames", m[2]);
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), MIME[path.extname(f)]) : send(res, 404, { error: "no frame" });
    }
    if (req.method === "POST" && (m = /^\/api\/projects\/([a-z0-9-]+)\/action$/.exec(p))) {
      if (!projectDirs().includes(m[1])) return send(res, 404, { error: "no such project" });
      const b = await readBody(req), slug = m[1];
      const table = { lint: ["lint", slug], gate: ["gate", slug], frames: ["frames", slug], lock: ["lock", slug], studio: ["studio", slug], "direction-md": ["direction-md", slug] };
      if (!table[b.action]) return send(res, 400, { error: "unknown action (no render action exists by design)" });
      const out = mh(table[b.action]); const text = strip(out.stdout + out.stderr).split(/\r?\n/).filter((l) => !/^\[INFO\]|browserGpu/.test(l)).join("\n").trim();
      let studioUrl = null; if (b.action === "studio") { const mm = /"studioUrl":"([^"]+)"/.exec(text); studioUrl = mm ? mm[1] : null; }
      return send(res, 200, { ok: out.status === 0, output: text.slice(-6000), studioUrl });
    }
    if (req.method === "POST" && p === "/api/uploads") {
      const name = safeName(url.searchParams.get("name") || "");
      if (BLOCKED_EXT.test(name)) { req.resume(); return send(res, 400, { error: "That file type is not accepted (executables and scripts are blocked)." }); }
      const len = +(req.headers["content-length"] || 0);
      if (len > MAX_FILE) { req.resume(); return send(res, 413, { error: "File is larger than 4 GB." }); }
      const id = Math.random().toString(16).slice(2, 10).padEnd(8, "0"), dir = path.join(INBOX, id), abs = path.join(dir, name);
      fs.mkdirSync(dir, { recursive: true });
      let got = 0, failed = false; const ws = fs.createWriteStream(abs);
      const fail = (code, msg) => { if (failed) return; failed = true; ws.destroy(); fs.rmSync(dir, { recursive: true, force: true }); if (!res.headersSent) send(res, code, { error: msg }); };
      req.on("data", (d) => { got += d.length; if (got > MAX_FILE) { fail(413, "File is larger than 4 GB."); req.destroy(); } });
      req.on("aborted", () => fail(499, "upload aborted")); req.on("error", () => fail(500, "upload failed")); ws.on("error", () => fail(500, "could not write file"));
      ws.on("finish", () => { if (!failed) { const f = inboxFile(id); send(res, 200, f ? { id, name: f.name, size: f.size, kind: f.kind, rel: f.rel } : { error: "empty upload" }); } });
      req.pipe(ws); return;
    }
    if (req.method === "DELETE" && (m = /^\/api\/uploads\/([a-f0-9]{8})$/.exec(p))) { fs.rmSync(path.join(INBOX, m[1]), { recursive: true, force: true }); return send(res, 200, { ok: true }); }
    if (req.method === "GET" && (m = /^\/api\/projects\/([a-z0-9-]+)\/file\/(.+)$/.exec(p))) {
      // serve only inside assets/source, .mh/references and .mh/assets of that project
      if (!projectDirs().includes(m[1])) return send(res, 404, { error: "no such project" });
      const base = path.join(ROOT, "projects", m[1]), rel = decodeURIComponent(m[2]), abs = path.resolve(base, rel);
      const okRoots = [path.join(base, "assets", "source"), path.join(base, ".mh", "references"), path.join(base, ".mh", "assets")];
      if (!okRoots.some((r) => abs.startsWith(r + path.sep)) || /\.analysis\.json$/.test(abs)) return send(res, 403, { error: "forbidden" });
      return serveFile(req, res, abs);
    }
    if (req.method === "POST" && p === "/api/jobs") {
      const b = await readBody(req);
      if (!b.brief || String(b.brief).trim().length < 10) return send(res, 400, { error: "Write a brief (at least a sentence)." });
      if ([...jobs.values()].some((j) => j.meta.status === "running")) return send(res, 409, { error: "A job is already running. Stop it or wait for it to finish." });
      const atts = [];
      for (const a of (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 40)) {
        const f = a && inboxFile(String(a.id)); if (!f) return send(res, 400, { error: "An attached file is no longer available. Remove it and attach it again." });
        atts.push({ ...f, role: a.role === "reference" ? "reference" : "asset", note: String(a.note || "").slice(0, 300) });
      }
      const kind = b.kind === "revise" ? "revise" : "new";
      let slug = String(b.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (kind === "new") {
        if (!slug) slug = "video-" + Date.now().toString(36);
        if (!SLUG.test(slug)) return send(res, 400, { error: "Project name: 2-40 letters, digits or dashes." });
        if (projectDirs().includes(slug)) return send(res, 409, { error: `Project "${slug}" already exists.` });
      } else if (!projectDirs().includes(slug)) return send(res, 404, { error: "no such project to revise" });
      const c = connection(); if (!c.found) return send(res, 503, { error: c.hint });
      const format = ["horizontal", "vertical", "square"].includes(b.format) ? b.format : "horizontal", depth = ["draft", "standard", "high"].includes(b.depth) ? b.depth : "standard";
      const j = startJob({ kind, slug, brief: String(b.brief).trim().slice(0, 8000), format, depth, preset: b.preset === "night-sky" ? "night-sky" : "none", model: b.model || settings().model, attachments: atts });
      return send(res, 200, j.meta);
    }
    if (req.method === "GET" && p === "/api/jobs") return send(res, 200, [...jobs.values()].map((j) => j.meta).sort((a, b) => b.startedAt - a.startedAt).slice(0, 40));
    if ((m = /^\/api\/jobs\/([\w-]+)(\/stream|\/cancel)?$/.exec(p))) {
      const j = jobs.get(m[1]); if (!j) return send(res, 404, { error: "no such job" });
      if (!m[2] && req.method === "GET") return send(res, 200, { meta: j.meta, log: j.log });
      if (m[2] === "/cancel" && req.method === "POST") return send(res, 200, { ok: cancelJob(j) });
      if (m[2] === "/stream" && req.method === "GET") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        for (const e of j.log) res.write(`data: ${JSON.stringify(e)}\n\n`);
        if (j.meta.status !== "running") { res.write(`event: end\ndata: {}\n\n`); return res.end(); }
        j.subs.add(res); req.on("close", () => j.subs.delete(res)); return;
      }
    }
    // static UI
    if (req.method === "GET") {
      const f = path.join(PUBLIC, p === "/" ? "index.html" : p.replace(/\.\./g, ""));
      if (f.startsWith(PUBLIC) && fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || "application/octet-stream");
    }
    send(res, 404, { error: "not found" });
  } catch (e) { send(res, 500, { error: String(e && e.message || e) }); }
});

for (const d of fs.readdirSync(INBOX)) { try { const p = path.join(INBOX, d); if (/^[a-f0-9]{8}$/.test(d) && Date.now() - fs.statSync(p).mtimeMs > 3 * 864e5) fs.rmSync(p, { recursive: true, force: true }); } catch {} }
loadJobs();
server.listen(PORT, "127.0.0.1", () => console.log(`Motion harness dashboard: http://127.0.0.1:${PORT}`));
