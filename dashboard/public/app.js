/* Motion Harness dashboard UI. Vanilla JS, hash routes, no build step. Talks only to its own local server. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const ago = (t) => { const s = Math.max(1, Math.round((Date.now() - t) / 1000)); if (s < 60) return s + "s ago"; const m = Math.round(s / 60); if (m < 60) return m + "m ago"; const h = Math.round(m / 60); if (h < 24) return h + "h ago"; return Math.round(h / 24) + "d ago"; };

/* ------------------------------------------------------------------ icons */
const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 3v4M17 5h4M5 17v4M3 19h4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  alert: '<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.4L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>', palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.4H17a5 5 0 0 0 5-5C22 6 17.5 2 12 2z"/>',
  paperclip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  music: '<path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>', play: '<path d="M7 4v16l13-8z"/>', camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>',
};
const icon = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const paintIcons = (root = document) => $$("[data-icon]", root).forEach((e) => { if (!e.firstChild) { e.innerHTML = icon(e.dataset.icon); e.style.display = "inline-flex"; } });

/* ------------------------------------------------------------- UI helpers */
function toast(msg, bad) { const t = document.createElement("div"); t.className = "toast" + (bad ? " bad" : ""); t.textContent = msg; $("#toasts").appendChild(t); setTimeout(() => t.remove(), bad ? 7000 : 4000); }
const badge = (txt, tone = "", dot = true) => `<span class="badge ${tone}">${dot ? '<span class="dot"></span>' : ""}${esc(txt)}</span>`;
const PHASE = { brief: ["Brief", ""], direction: ["Direction", "blue"], storyboard: ["Storyboard", "blue"], review: ["Plan review", "violet"], build: ["Building", "amber"], verify: ["Verifying", "amber"], handoff: ["Ready for Studio", "green"] };
const phaseBadge = (p, adopted) => { if (adopted) return badge("HyperFrames example", "violet"); const [t, tone] = PHASE[p] || [p, ""]; return badge(t, tone); };
const gateBadges = (g) => !g ? badge("Gate not run", "") : [badge(g.errors ? `${g.errors} error${g.errors > 1 ? "s" : ""}` : "No errors", g.errors ? "red" : "green"), g.warnings ? badge(`${g.warnings} warning${g.warnings > 1 ? "s" : ""}`, "amber") : ""].join(" ");
const evBadge = (e) => badge(e === "fresh" ? "Frames fresh" : e === "stale" ? "Frames stale" : "No frames", e === "fresh" ? "green" : e === "stale" ? "amber" : "");
const thumbHTML = (p) => p.thumb ? `<img class="thumb" loading="lazy" src="/api/projects/${esc(p.slug)}/frames/${esc(p.thumb)}" alt="">` : `<span class="thumb">${icon("film")}</span>`;
const JOB = { running: ["Running", "blue"], done: ["Done", "green"], failed: ["Failed", "red"], cancelled: ["Stopped", ""], interrupted: ["Interrupted", "amber"] };
const jobBadge = (s) => badge((JOB[s] || [s, ""])[0], (JOB[s] || ["", ""])[1]);

const S = { conn: null, projects: [], jobs: [], es: null };
const fmtSize = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const kindIcon = (k) => ({ video: "film", image: "image", audio: "music" }[k] || "file");
const guessKind = (n) => /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(n) ? "video" : /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(n) ? "image" : /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(n) ? "audio" : "other";

/* Attach files: uploads go to the harness inbox/ folder (streamed, with progress). Each file is a Reference
   (look, pacing, structure: analysed, never copied) or a Raw asset (real material to use in the video). */
function mountAttach(zone, listEl, btn, input) {
  const items = [];
  const draw = () => {
    listEl.hidden = !items.length;
    listEl.innerHTML = items.map((a, i) => `<div class="att" data-i="${i}">${icon(kindIcon(a.kind))}<div class="grow"><div class="nm">${esc(a.name)}</div>
      <div class="${a.error ? "bad" : "faint"}">${a.error ? esc(a.error) : a.id ? fmtSize(a.size) : "Uploading " + a.pct + "%"}</div>${a.id || a.error ? "" : `<div class="bar"><i style="width:${a.pct}%"></i></div>`}</div>
      <select class="chipsel role" aria-label="Role of ${esc(a.name)}" ${a.id ? "" : "disabled"}><option value="reference" ${a.role === "reference" ? "selected" : ""}>Reference</option><option value="asset" ${a.role === "asset" ? "selected" : ""}>Raw asset</option></select>
      <button class="btn ghost sm rm" aria-label="Remove ${esc(a.name)}">${icon("x", "sm")}</button></div>`).join("");
    paintIcons(listEl);
    $$(".att", listEl).forEach((row) => {
      const a = items[+row.dataset.i];
      $(".role", row).addEventListener("change", (e) => { a.role = e.target.value; });
      $(".rm", row).addEventListener("click", () => { if (a.xhr && !a.id) a.xhr.abort(); if (a.id) fetch("/api/uploads/" + a.id, { method: "DELETE" }).catch(() => {}); items.splice(items.indexOf(a), 1); draw(); });
    });
  };
  const upload = (file) => {
    const kind = guessKind(file.name), a = { name: file.name, size: file.size, kind, role: kind === "video" ? "reference" : "asset", pct: 0, id: null, error: null };
    items.push(a); draw();
    const xhr = new XMLHttpRequest(); a.xhr = xhr;
    xhr.open("POST", "/api/uploads?name=" + encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) { a.pct = Math.round((100 * e.loaded) / e.total); const bar = $(`.att[data-i="${items.indexOf(a)}"] .bar i`, listEl); if (bar) bar.style.width = a.pct + "%"; } };
    xhr.onload = () => { let j = {}; try { j = JSON.parse(xhr.responseText); } catch {} if (xhr.status === 200 && j.id) { a.id = j.id; a.kind = j.kind; a.size = j.size; a.name = j.name; } else a.error = j.error || "Upload failed"; draw(); };
    xhr.onerror = () => { a.error = "Upload failed"; draw(); };
    xhr.send(file);
  };
  const add = (files) => [...files].forEach(upload);
  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { add(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); zone.classList.add("drag"); } }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { if (ev === "dragleave" && zone.contains(e.relatedTarget)) return; zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); add(e.dataTransfer.files); } });
  return { get: () => items.filter((a) => a.id).map((a) => ({ id: a.id, role: a.role })), busy: () => items.some((a) => !a.id && !a.error), count: () => items.length };
}
let page = null;

/* ---------------------------------------------------------------- data */
async function refreshAll() {
  const [c, p, j] = await Promise.all([api("/api/connection").catch(() => null), api("/api/projects").catch(() => []), api("/api/jobs").catch(() => [])]);
  S.conn = c; S.projects = p; S.jobs = j;
  $("#count-projects").textContent = p.length || "";
  const running = j.filter((x) => x.status === "running").length;
  $("#count-runs").textContent = running ? running : "";
  paintHealth();
}
function paintHealth() {
  const c = S.conn || {};
  const rows = [];
  rows.push(c.found ? ["green", `OpenCode ${c.version} connected`] : ["red", "OpenCode not found"]);
  rows.push((c.providers || []).length ? ["green", `${c.providers.length} model provider${c.providers.length > 1 ? "s" : ""}`] : ["amber", "No model provider yet"]);
  rows.push(c.agentReady ? ["green", "motion-director ready"] : ["red", "Agent file missing"]);
  $("#health").innerHTML = rows.map(([c2, t]) => `<a href="#/settings"><span class="dot ${c2}"></span><span class="tx">${esc(t)}</span></a>`).join("");
}

/* -------------------------------------------------------------- shell */
function setTop(crumb, actions = "") { $("#topbar").innerHTML = `<div class="crumb">${crumb}</div><div class="actions">${actions}</div>`; paintIcons($("#topbar")); }
function setPage(html, cls = "page") { $("#main").innerHTML = cls ? `<div class="${cls}">${html}</div>` : html; paintIcons($("#main")); $("#main").scrollTop = 0; }
function setNav(name) { $$("#nav a").forEach((a) => a.classList.toggle("active", a.dataset.page === name)); }

function applyTheme(t) {
  try { localStorage.setItem("mh-theme", t); } catch (e) {}
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  $$("[data-theme-set]").forEach((b) => { const on = b.dataset.themeSet === t; b.classList.toggle("active", on); b.setAttribute("aria-checked", on); });
}
$$("[data-theme-set]").forEach((b) => b.addEventListener("click", () => applyTheme(b.dataset.themeSet)));
let stored = "system"; try { stored = localStorage.getItem("mh-theme") || "system"; } catch (e) {} applyTheme(stored);

/* ------------------------------------------------------------- router */
const mine = () => { const s = routeSeq; return () => s === routeSeq; }; // false once the user has navigated elsewhere
const routes = [
  [/^#\/home$|^$|^#?\/?$/, renderHome], [/^#\/projects$/, renderProjects], [/^#\/projects\/([a-z0-9-]+)(?:\/(\w+))?$/, renderProject],
  [/^#\/runs(?:\/([\w-]+))?$/, renderRuns], [/^#\/settings$/, renderSettings],
];
let routeSeq = 0;
async function route() {
  routeSeq++;
  if (S.es) { S.es.close(); S.es = null; }
  setPage(`<div class="empty">Loading…</div>`);
  const h = location.hash || "#/home";
  for (const [re, fn] of routes) { const m = re.exec(h); if (m) { try { await fn(...m.slice(1)); } catch (e) { setPage(`<div class="card"><div class="empty">${esc(e.message)}</div></div>`); } paintIcons(); return; } }
  location.hash = "#/home";
}
window.addEventListener("hashchange", route);

/* ----------------------------------------------------------------- home */
async function renderHome() {
  const alive = mine(); setNav("home"); setTop(`${icon("home")}Home`);
  await refreshAll(); if (!alive()) return;
  const P = S.projects, ready = P.filter((p) => p.phase === "handoff").length;
  const gated = P.filter((p) => p.gate), clean = gated.filter((p) => !p.gate.errors).length, fresh = P.filter((p) => p.gate && p.gate.evidence === "fresh").length;
  const done = S.jobs.filter((j) => j.status === "done").length, cost = S.jobs.reduce((a, j) => a + (j.cost || 0), 0);
  const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const running = S.jobs.find((j) => j.status === "running");
  setPage(`
    <h1 class="hello">${greet}</h1>
    <p class="hello-sub">${running ? `OpenCode is working on <b>${esc(running.slug)}</b>.` : P.length ? `${ready} of ${P.length} projects ready for HyperFrames Studio.` : "Describe a video and OpenCode will plan, build and check it."}</p>
    <div class="prompt">
      <textarea id="brief" placeholder="Make a 30-second explainer on why aircraft read −32 °C at cruise, for student pilots. Dense, with a gauge and a flight path."></textarea>
      <div class="atts" id="atts" hidden></div>
      <input type="file" id="file-in" multiple hidden>
      <div class="foot">
        <button class="btn ghost sm" id="attach-btn" type="button">${icon("paperclip")}Attach reference video or files</button>
        <span class="note">Drop files on this box · nothing is rendered here</span>
        <input class="name" id="slug" type="text" placeholder="Project name" spellcheck="false" aria-label="Project name (optional)">
        <select class="chipsel" id="format" aria-label="Format"><option value="horizontal">16:9</option><option value="vertical">9:16</option><option value="square">1:1</option></select>
        <select class="chipsel" id="depth" aria-label="Planning depth"><option value="draft">Draft</option><option value="standard" selected>Standard</option><option value="high">High depth</option></select>
        <select class="chipsel" id="preset" aria-label="Look"><option value="night-sky">Dense world</option><option value="none">Own design</option></select>
        <button class="btn primary" id="create" ${running ? "disabled title='A run is in progress'" : ""}>${icon("sparkles")}Create</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="k">${icon("folder")}Projects</div><div class="v tnum">${P.length}</div><div class="s">${ready} ready for Studio</div></div>
      <div class="stat"><div class="k">${icon("check")}Quality gate</div><div class="v tnum">${clean}<small> / ${gated.length}</small></div><div class="s">${gated.length ? "gated projects with no errors" : "no project gated yet"}</div></div>
      <div class="stat"><div class="k">${icon("image")}Frame evidence</div><div class="v tnum">${fresh}</div><div class="s">projects with fresh preview frames</div></div>
      <div class="stat"><div class="k">${icon("activity")}OpenCode runs</div><div class="v tnum">${done}</div><div class="s">${cost ? "$" + cost.toFixed(2) + " of usage" : "finished"}</div></div>
    </div>
    <div class="cols">
      <div class="card"><header>${icon("folder")}Recent projects<a class="more" href="#/projects">View all</a></header>
        ${P.length ? [...P].sort((a, b) => b.updated - a.updated).slice(0, 6).map((p) => `<div class="row" data-go="#/projects/${esc(p.slug)}">${thumbHTML(p)}<div class="grow"><div class="t">${esc(p.slug)}</div><div class="s">${esc(p.title)}</div></div>${phaseBadge(p.phase, p.adopted)}</div>`).join("") : `<div class="empty">No projects yet. Write a brief above.</div>`}</div>
      <div class="card"><header>${icon("activity")}Recent runs<a class="more" href="#/runs">View all</a></header>
        ${S.jobs.length ? S.jobs.slice(0, 6).map((j) => `<div class="row" data-go="#/runs/${esc(j.id)}"><div class="grow"><div class="t">${esc(j.kind === "revise" ? "Revise: " : "Create: ")}${esc(j.slug)}</div><div class="s">${ago(j.startedAt)}${j.cost ? " · $" + j.cost.toFixed(2) : ""}</div></div>${jobBadge(j.status)}</div>`).join("") : `<div class="empty">No runs yet.</div>`}</div>
    </div>`);
  bindGo(); homeAtt = mountAttach($(".prompt"), $("#atts"), $("#attach-btn"), $("#file-in")); $("#create").addEventListener("click", createFromHome);
  $("#brief").addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") createFromHome(); });
}
function bindGo() { $$("[data-go]").forEach((e) => e.addEventListener("click", () => { location.hash = e.dataset.go; })); }
let homeAtt = null;
async function createFromHome() {
  if (homeAtt && homeAtt.busy()) return toast("Wait for the uploads to finish", true);
  const btn = $("#create"); btn.disabled = true;
  try {
    const meta = await api("/api/jobs", { kind: "new", brief: $("#brief").value, format: $("#format").value, depth: $("#depth").value, preset: $("#preset").value, slug: $("#slug").value, model: S.conn && S.conn.model, attachments: homeAtt ? homeAtt.get() : [] });
    toast(`Started ${meta.slug}`); location.hash = "#/runs/" + meta.id;
  } catch (e) { toast(e.message, true); btn.disabled = false; }
}

/* ------------------------------------------------------------- projects */
async function renderProjects() {
  const alive = mine(); setNav("projects"); setTop(`${icon("folder")}Projects`, `<a class="btn primary" href="#/home">${icon("sparkles")}New video</a>`);
  await refreshAll(); if (!alive()) return;
  const P = S.projects;
  setPage(`<div class="toolbar"><input type="search" id="q" placeholder="Search projects" aria-label="Search projects"><select id="fphase" class="chipsel"><option value="">All phases</option>${Object.entries(PHASE).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></div>
    <div class="card"><div class="scroll-x"><table class="t"><thead><tr><th>Project</th><th>Format</th><th>Phase</th><th>Quality gate</th><th>Frames</th><th>Revisions</th><th>Updated</th></tr></thead><tbody id="ptb"></tbody></table></div></div>`);
  const draw = () => {
    const q = $("#q").value.toLowerCase(), ph = $("#fphase").value;
    const rows = P.filter((p) => (!ph || p.phase === ph) && (!q || (p.slug + " " + p.title).toLowerCase().includes(q)));
    $("#ptb").innerHTML = rows.length ? rows.map((p) => `<tr data-go="#/projects/${esc(p.slug)}"><td><div class="actions" style="flex-wrap:nowrap">${thumbHTML(p)}<div><div style="font-weight:500">${esc(p.slug)}</div><div class="muted" style="max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.title)}</div></div></div></td>
      <td>${esc(p.format)}${p.adopted ? ` ${badge("HyperFrames example", "violet", false)}` : ""}</td><td>${phaseBadge(p.phase, p.adopted)}</td><td><span class="badges">${gateBadges(p.gate)}</span></td><td>${evBadge(p.gate && p.gate.evidence)}</td><td class="tnum">${p.revisions}</td><td class="muted">${p.updated ? ago(p.updated) : ""}</td></tr>`).join("") : `<tr><td colspan="7" class="empty">No projects match.</td></tr>`;
    bindGo();
  };
  $("#q").addEventListener("input", draw); $("#fphase").addEventListener("change", draw); draw();
}

/* -------------------------------------------------------------- project */
async function renderProject(slug, tab) {
  const alive = mine(); tab = tab || "overview"; setNav("projects");
  const d = await api("/api/projects/" + slug); if (!alive()) return;
  setTop(`<a href="#/projects">Projects</a><span class="sep">/</span>${icon("film")}${esc(slug)}`,
    `<button class="btn" data-act="gate">${icon("check")}Quality gate</button><button class="btn" data-act="frames">${icon("camera")}Capture frames</button><button class="btn primary" data-act="studio">${icon("external")}Open in Studio</button>`);
  $$("#topbar [data-act]").forEach((b) => b.addEventListener("click", () => runAction(slug, b)));
  const sc = d.storyboard ? d.storyboard.scenes : [], cl = d.checklist ? Object.values(d.checklist.items) : [];
  const tabs = [["overview", "Overview"], ["storyboard", "Storyboard", sc.length], ["quality", "Quality", d.findings.length], ["frames", "Frames", d.frames.length], ["files", "Files", (d.references || []).length + (d.assets || []).length], ["history", "History", d.revisionLog.length]];
  const pal = d.direction && d.direction.designSystem && d.direction.designSystem.palette;
  const hero = d.frames.find((f) => /^review-beats/.test(f)) || d.frames.find((f) => /^contact/.test(f));
  const body = {
    overview: () => `<div class="cols">
      <div>
        <div class="card"><header>${icon("image")}Preview frames</header>${hero ? `<a href="/api/projects/${esc(slug)}/frames/${esc(hero)}" target="_blank"><img style="display:block;width:100%" src="/api/projects/${esc(slug)}/frames/${esc(hero)}" alt=""></a>` : `<div class="empty">No frames yet. Capture frames to look at the project.</div>`}</div>
        ${d.adopted ? "" : `<div class="card"><header>${icon("sparkles")}Revise with OpenCode</header><div class="composer"><textarea id="rev" rows="3" placeholder="What should change? e.g. make the number scene land harder, keep every other scene as is."></textarea><div class="atts" id="r-atts" hidden></div><input type="file" id="r-file" multiple hidden><div class="foot"><button class="btn ghost sm" id="r-attach" type="button">${icon("paperclip")}Attach files</button><span class="note">The agent logs a revision and touches only the scenes it names.</span><button class="btn primary" id="rev-go">${icon("sparkles")}Send</button></div></div></div>`}
      </div>
      <div>
        <div class="card"><header>Details</header><div class="props">
          <div class="p"><span class="k">${icon("tag")}Phase</span><span>${phaseBadge(d.phase, d.adopted)}</span></div>
          <div class="p"><span class="k">${icon("target")}Quality gate</span><span class="badges">${gateBadges(d.gate)}</span></div>
          <div class="p"><span class="k">${icon("image")}Frame evidence</span><span>${evBadge(d.gate && d.gate.evidence)}</span></div>
          <div class="p"><span class="k">${icon("layers")}Format</span><span>${esc(d.format)}</span></div>
          <div class="p"><span class="k">${icon("hash")}Depth</span><span>${esc(d.depth)} · ${d.revisions} revision${d.revisions === 1 ? "" : "s"}</span></div>
          <div class="p"><span class="k">${icon("film")}Scenes</span><span>${sc.length || "—"}${d.storyboard && d.storyboard.layers ? ` + ${d.storyboard.layers.length} persistent layers` : ""}</span></div>
          <div class="p"><span class="k">${icon("palette")}Density</span><span>${esc(d.density || "—")}</span></div></div></div>
        ${d.direction && d.direction.concept ? `<div class="card"><header>${icon("sparkles")}Concept</header><div class="pad">${esc(d.direction.concept)}</div>${pal ? `<div class="pad" style="padding-top:0">${Object.entries(pal).filter(([, v]) => /^#/.test(v)).map(([k, v]) => `<span style="white-space:nowrap;margin-right:12px"><span class="sw" style="background:${esc(v)}"></span>${esc(k)}</span>`).join("")}</div>` : ""}</div>` : ""}
      </div></div>`,
    storyboard: () => sc.length ? `<div class="card"><div class="scenes">${sc.map((s, i) => `<div class="scene"><div><span class="n">${i + 1}</span><b>${esc(s.title)}</b></div><div class="badges" style="margin-top:8px">${badge(s.role, "violet", false)}${badge(s.duration + "s", "", false)}${badge(s.layout, "", false)}</div>
      <dl><dt>Why it exists</dt><dd>${esc(s.purpose)}</dd><dt>Hero object</dt><dd>${esc(s.heroObject || "—")}</dd><dt>Viewer should notice</dt><dd>${esc(s.viewerShouldNotice)}</dd><dt>Hero move</dt><dd>${esc(s.heroMove)} <span class="faint">(${esc(s.motionPurpose)})</span></dd></dl></div>`).join("")}</div></div>` : `<div class="card"><div class="empty">No storyboard (this project was adopted, not planned through the harness).</div></div>`,
    quality: () => `<div class="card"><header>${icon("alert")}Gate findings</header>${d.findings.length ? d.findings.map((f) => `<div class="find">${badge(f.level, f.level === "error" ? "red" : "amber", false)}<div><div class="c">${esc(f.code)}${f.scene ? ` <span class="faint">· ${esc(String(f.scene).split(/[\\/]/).pop())}</span>` : ""}</div><div class="muted">${esc(String(f.msg).slice(0, 420))}</div></div></div>`).join("") : `<div class="empty">${d.gate ? "No findings: the last gate was clean." : "The gate has not run yet."}</div>`}</div>
      ${cl.length ? `<div class="card"><header>${icon("check")}Checklist</header>${cl.map((x) => `<div class="find">${badge(x.status, x.status === "pass" ? "green" : x.status === "fail" ? "red" : "amber", false)}<div><div class="c">${esc(x.question)}</div><div class="muted">${esc(x.evidence || "")}${x.basis ? ` <span class="faint">(${esc(x.basis)})</span>` : ""}</div></div></div>`).join("")}</div>` : ""}`,
    frames: () => `<div class="card"><header>${icon("image")}Preview frames<span class="more">stills from hyperframes snapshot, not a render</span></header>${d.frames.length ? `<div class="gallery">${d.frames.map((f) => `<a href="/api/projects/${esc(slug)}/frames/${esc(f)}" target="_blank" class="${/^(review-beats|contact)/.test(f) ? "wide" : ""}"><img loading="lazy" src="/api/projects/${esc(slug)}/frames/${esc(f)}" alt=""><span>${esc(f)}${d.frameStats && d.frameStats.stats[f] != null ? ` · ${d.frameStats.stats[f]}% edges` : ""}</span></a>`).join("")}</div>` : `<div class="empty">No frames yet.</div>`}</div>`,
    files: () => filesTab(d, slug),
    history: () => `<div class="card"><header>${icon("clock")}Revisions</header>${d.revisionLog.length ? d.revisionLog.map((r) => `<div class="find">${badge("#" + r.n, "violet", false)}<div><div class="c">${esc(r.reason)}</div><div class="muted">touched ${esc((r.touched || []).join(", "))}${r.preserved && r.preserved.length ? ` · preserved ${r.preserved.length}` : ""}</div></div></div>`).join("") : `<div class="empty">No revisions logged.</div>`}</div>
      <div class="card"><header>Decision log</header>${d.decisions.length ? d.decisions.slice().reverse().map((x) => `<div class="find"><span class="faint tnum" style="min-width:56px">${esc((x.at || "").slice(11, 19))}</span><div><span class="c">${esc(x.type)}</span> <span class="muted">${esc(x.what || x.note || (x.to ? "→ " + x.to : "") || x.findings || "")}</span></div></div>`).join("") : `<div class="empty">Nothing yet.</div>`}</div>`,
  };
  setPage(`<div class="ptitle"><h1>${esc(slug)}</h1>${phaseBadge(d.phase, d.adopted)}</div><div class="muted">${esc(d.title)}</div><pre class="out" id="act-out" hidden></pre>
    <div class="tabs">${tabs.map(([k, l, n]) => `<button data-tab="${k}" class="${k === tab ? "on" : ""}">${l}${n ? `<span class="n">${n}</span>` : ""}</button>`).join("")}</div>${body[tab]()}`);
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => { location.hash = `#/projects/${slug}${b.dataset.tab === "overview" ? "" : "/" + b.dataset.tab}`; }));
  const ratt = $("#r-attach") ? mountAttach($(".composer"), $("#r-atts"), $("#r-attach"), $("#r-file")) : null;
  const rg = $("#rev-go"); if (rg) rg.addEventListener("click", async () => { if (ratt && ratt.busy()) return toast("Wait for the uploads to finish", true); rg.disabled = true; try { const m = await api("/api/jobs", { kind: "revise", slug, brief: $("#rev").value, model: S.conn && S.conn.model, attachments: ratt ? ratt.get() : [] }); location.hash = "#/runs/" + m.id; } catch (e) { toast(e.message, true); rg.disabled = false; } });
}
/* Files tab: the user's reference files (with analysis state) and raw assets (with "used in video" state) */
function filesTab(d, slug) {
  const F = (rel) => `/api/projects/${esc(slug)}/file/${String(rel).split("/").map(encodeURIComponent).join("/")}`;
  const refs = d.references || [], assets = d.assets || [];
  const refCard = (r) => {
    const o = r.observed, isVid = r.kind === "video";
    const cuts = o && o.detectedCutsSec ? o.detectedCutsSec : [];
    return `<div class="card"><header>${icon(isVid ? "film" : "image")}${esc(r.name)}<span class="badges" style="margin-left:8px">${badge("Reference", "violet", false)}${badge(r.complete ? "Analysed" : "Analysis not finished", r.complete ? "green" : "amber")}</span></header>
      ${isVid ? `<div class="pad"><video controls preload="metadata" style="width:100%;max-height:340px;background:#000;border-radius:8px" src="${F(".mh/references/" + r.name)}"></video>
        <div class="muted" style="margin-top:8px">${o ? `${o.width}×${o.height} · ${o.fps} fps · ${o.durationSec}s${o.hasAudio ? " · with audio" : ""} · ${cuts.length} cut${cuts.length === 1 ? "" : "s"} detected${cuts.length ? " at " + cuts.slice(0, 14).join("s, ") + "s" : ""} <span class="faint">(approximate)</span>` : ""}</div></div>
        <div class="gallery">${(r.frames || []).map((f) => `<a href="${F(".mh/references/" + f)}" target="_blank"><img loading="lazy" src="${F(".mh/references/" + f)}" alt=""></a>`).join("")}</div>`
      : `<div class="pad"><img style="max-width:100%;max-height:360px;border-radius:8px" src="${F(".mh/references/" + r.name)}" alt=""></div>`}
      ${r.note ? `<div class="pad muted" style="padding-top:0">Your note: ${esc(r.note)}</div>` : ""}
      ${r.rules.length ? `<div class="pad" style="padding-top:0"><b>Rules taken from it</b><ul style="margin:6px 0 0 18px;padding:0">${r.rules.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div>`;
  };
  const thumb = (x) => x.kind === "image" ? `<img class="thumb" src="${F(x.path)}" alt="">` : x.previews && x.previews[0] ? `<img class="thumb" src="${F(".mh/" + x.previews[0])}" alt="">` : `<span class="thumb">${icon(kindIcon(x.kind))}</span>`;
  const used = (x) => ["doc", "other"].includes(x.kind) ? badge("Source material", "") : x.used ? badge("Used", "green") : badge("Not used yet", "amber");
  return `${refs.map(refCard).join("")}
    <div class="card"><header>${icon("paperclip")}Raw assets</header>${assets.length ? `<div class="scroll-x"><table class="t"><thead><tr><th>File</th><th>Type</th><th>Details</th><th>In the video</th></tr></thead><tbody>${assets.map((x) => `<tr><td><div class="actions" style="flex-wrap:nowrap">${thumb(x)}<div><div style="font-weight:500">${esc(x.name)}</div><div class="faint">${esc(x.path)}</div></div></div></td><td>${esc(x.kind)}</td><td class="muted">${fmtSize(x.sizeBytes)}${x.width ? " · " + x.width + "×" + x.height : ""}${x.durationSec ? " · " + x.durationSec + "s" : ""}${x.note ? "<br>" + esc(x.note) : ""}</td><td>${used(x)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No raw assets imported. Attach files when you create or revise a project.</div>`}</div>`;
}

async function runAction(slug, btn) {
  const act = btn.dataset.act, label = btn.innerHTML, out = $("#act-out");
  btn.disabled = true; btn.innerHTML = act === "studio" ? "Starting…" : "Running…";
  try {
    const r = await api(`/api/projects/${slug}/action`, { action: act });
    if (act === "studio") { if (r.studioUrl) { window.open(r.studioUrl, "_blank"); toast("HyperFrames Studio is running"); } else toast("Studio did not report a URL", true); }
    else { await route(); const o = $("#act-out"); if (o) { o.hidden = false; o.textContent = r.output || "(no output)"; } toast(act === "gate" ? "Quality gate finished" : "Frames captured"); }
  } catch (e) { toast(e.message, true); if (out) { out.hidden = false; out.textContent = e.message; } }
  finally { btn.disabled = false; btn.innerHTML = label; paintIcons(); }
}

/* ----------------------------------------------------------------- runs */
const logLine = (e) => `<div class="${esc(e.kind)}">${esc(e.kind === "tool" ? "→ " + e.text : e.text)}</div>`;
async function renderRuns(id) {
  const alive = mine(); setNav("runs"); setTop(`${icon("activity")}OpenCode runs`, `<a class="btn primary" href="#/home">${icon("sparkles")}New run</a>`);
  await refreshAll(); if (!alive()) return;
  const list = S.jobs; id = id || (list[0] && list[0].id);
  setPage(`<div class="panes"><div class="plist">${list.length ? list.map((j) => `<a class="run ${j.id === id ? "on" : ""}" href="#/runs/${esc(j.id)}"><div class="t">${esc(j.kind === "revise" ? "Revise: " : "Create: ")}${esc(j.slug)}</div><div class="m">${jobBadge(j.status)}<span>${ago(j.startedAt)}</span>${j.cost ? `<span>· $${j.cost.toFixed(2)}</span>` : ""}</div></a>`).join("") : `<div class="empty">No runs yet.<br><a href="#/home">Create your first video</a></div>`}</div><div class="pdetail" id="rd"></div></div>`, "");
  if (!id) { $("#rd").innerHTML = `<div class="empty">Runs appear here with their live steps.</div>`; return; }
  const j = await api("/api/jobs/" + id); if (!alive()) return;
  const m = j.meta, finished = m.status !== "running";
  $("#rd").innerHTML = `<h1 style="font-size:20px;letter-spacing:-0.02em">${esc(m.kind === "revise" ? "Revise " : "Create ")}${esc(m.slug)}</h1>
    <div class="actions" style="margin:6px 0 0">${jobBadge(m.status)}<span class="muted" id="rmeta">Started ${ago(m.startedAt)}${m.model ? " · " + esc(m.model) : " · default model"}${m.cost ? " · $" + m.cost.toFixed(2) + " of usage" : ""}</span>
      <button class="btn sm danger" id="stop" ${finished ? "hidden" : ""}>${icon("stop", "sm")}Stop</button><a class="btn sm" id="openp" href="#/projects/${esc(m.slug)}" ${finished && m.status === "done" ? "" : "hidden"}>${icon("folder", "sm")}Open project</a></div>
    ${(m.attachments || []).length ? `<div class="badges" style="margin-top:10px">${m.attachments.map((x) => badge(`${x.name} · ${x.role === "reference" ? "reference" : "raw asset"}`, x.role === "reference" ? "violet" : "blue", false)).join("")}</div>` : ""}
    <div class="result" id="result" hidden>${icon("sparkles")}<div id="rtext"></div></div>
    <div class="h-sec">${icon("activity")}Steps</div><div class="steps" id="steps"></div>`;
  paintIcons($("#rd"));
  const steps = $("#steps"); let lastText = "";
  const add = (e) => { steps.insertAdjacentHTML("beforeend", logLine(e)); steps.scrollTop = steps.scrollHeight; if (e.kind === "text") lastText = e.text; if (e.kind === "error") showResult(e.text, true); };
  const showResult = (t, bad) => { $("#result").hidden = false; $("#rtext").textContent = t; if (bad) $("#result").style.borderColor = "var(--red-bd)"; };
  if (finished) j.log.forEach(add); // a running job replays its log over the event stream instead
  if (finished) { if (lastText && m.status === "done") showResult(lastText); return; }
  $("#stop").addEventListener("click", async () => { await api(`/api/jobs/${id}/cancel`, {}); });
  const es = new EventSource(`/api/jobs/${id}/stream`); S.es = es;
  es.onmessage = (ev) => add(JSON.parse(ev.data));
  es.addEventListener("end", async () => { es.close(); S.es = null; if (lastText) showResult(lastText); await refreshAll(); if (location.hash.startsWith("#/runs")) route(); });
}

/* ------------------------------------------------------------- settings */
async function renderSettings() {
  const alive = mine(); setNav("settings"); setTop(`${icon("settings")}Connection`);
  await refreshAll(); if (!alive()) return; const c = S.conn || {};
  const m = await api("/api/models").catch(() => ({ models: [], selected: "" })); if (!alive()) return;
  setPage(`<div style="max-width:760px">
    <div class="card"><header>${icon("activity")}OpenCode</header><div class="props">
      <div class="p"><span class="k">Status</span><span>${c.found ? badge("Connected · " + c.version, "green") : badge("Not found", "red")}</span></div>
      <div class="p"><span class="k">Providers</span><span class="badges">${(c.providers || []).length ? c.providers.map((p) => badge(`${p.id} · ${p.how}`, "", false)).join("") : badge("None yet", "amber")}</span></div>
      <div class="p"><span class="k">Agent</span><span>${c.agentReady ? badge("motion-director ready", "green") : badge("missing .opencode/agent/motion-director.md", "red")}</span></div>
      <div class="p"><span class="k">Model</span><span style="display:flex;gap:8px"><select id="model"><option value="">OpenCode default model</option>${m.models.map((x) => `<option ${x === m.selected ? "selected" : ""}>${esc(x)}</option>`).join("")}</select><button class="btn" id="mrefresh">${icon("refresh")}Refresh</button></span></div></div>
      <div class="pad muted">${c.found ? "Runs use your own OpenCode providers and quota, and nothing is sent until you press Create or Send." : esc(c.hint || "")}<br>To add a provider, open a terminal and run <code>opencode auth login</code>, then refresh.</div></div>
    <div class="card"><header>${icon("lock")}How this app talks to OpenCode</header><div class="pad muted">It runs <code>opencode run --format json --agent motion-director</code> from the motion-harness folder (no server API), sends your brief on stdin and shows the steps live. Agents, tools and the no-render permissions come from <code>.opencode/</code> and <code>opencode.jsonc</code>. Rendering and export are done in HyperFrames Studio.</div></div></div>`);
  $("#model").addEventListener("change", async (e) => { try { await api("/api/settings", { model: e.target.value }); S.conn.model = e.target.value; toast("Model saved"); } catch (x) { toast(x.message, true); } });
  $("#mrefresh").addEventListener("click", async () => { await api("/api/models?refresh=1").catch(() => {}); route(); });
}

/* -------------------------------------------------------------- palette */
function openPalette() {
  const items = [["#/home", "Home", "home"], ["#/projects", "Projects", "folder"], ["#/runs", "OpenCode runs", "activity"], ["#/settings", "Connection", "settings"], ...S.projects.map((p) => [`#/projects/${p.slug}`, p.slug, "film"])];
  const root = $("#modal-root"); let sel = 0, cur = items;
  root.innerHTML = `<div class="scrim"><div class="pal"><input id="pq" placeholder="Jump to a page or project" autocomplete="off"><div class="list" id="pl"></div></div></div>`;
  const draw = () => { $("#pl").innerHTML = cur.map((it, i) => `<div class="item ${i === sel ? "on" : ""}" data-i="${i}">${icon(it[2])}${esc(it[1])}</div>`).join("") || `<div class="empty">No match</div>`; $$("#pl .item").forEach((e) => e.addEventListener("click", () => go(+e.dataset.i))); };
  const go = (i) => { if (cur[i]) location.hash = cur[i][0]; close(); }; const close = () => { root.innerHTML = ""; };
  $(".scrim", root).addEventListener("mousedown", (e) => { if (e.target.classList.contains("scrim")) close(); });
  $("#pq").addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); cur = items.filter((it) => it[1].toLowerCase().includes(q)); sel = 0; draw(); });
  $("#pq").addEventListener("keydown", (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowDown") { sel = Math.min(cur.length - 1, sel + 1); draw(); e.preventDefault(); } else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); } else if (e.key === "Enter") go(sel); });
  draw(); paintIcons(root); $("#pq").focus();
}
$("#quick").addEventListener("click", openPalette);
window.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); } });

paintIcons(); route();
