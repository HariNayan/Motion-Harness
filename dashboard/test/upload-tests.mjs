// Upload / attachment / guard tests, called from run-tests.mjs (shares its stub-opencode server).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

export async function uploadTests({ BASE, PORT, J, ok, until, root }) {
  const up = async (name, body) => { const q = await fetch(BASE + "/api/uploads?name=" + encodeURIComponent(name), { method: "POST", body }); return { s: q.status, j: await q.json().catch(() => ({})) }; };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const raw = (opts, body, ms = 3000) => new Promise((res) => {
    const q = http.request({ host: "127.0.0.1", port: PORT, agent: false, ...opts }, (r) => { r.resume(); res(r.statusCode); });
    q.on("error", () => res(0)); if (body !== undefined) q.write(body); q.end(); setTimeout(() => { q.destroy(); res(-1); }, ms);
  });

  const u1 = await up("logo (1).png", png);
  ok(u1.s === 200 && u1.j.kind === "image" && /^inbox\/[a-f0-9]{8}\/logo \(1\)\.png$/.test(u1.j.rel) && u1.j.size === png.length, "image upload stored in inbox with its original size");
  const u2 = await up("../../evil name.mp4", Buffer.alloc(2048, 1));
  ok(u2.s === 200 && !/\.\./.test(u2.j.rel) && u2.j.kind === "video", "path traversal in the upload name is neutralised");
  const u3 = await up("setup.exe", Buffer.alloc(10));
  ok(u3.s === 400, "executable upload refused");
  const big = await raw({ path: "/api/uploads?name=big.mov", method: "POST", headers: { "content-length": String(5 * 1024 ** 3) } }, "x", 1500);
  ok(big === 413, `file larger than 4 GB refused up front [got ${big}]`);
  const xo = await raw({ path: "/api/uploads?name=a.png", method: "POST", headers: { origin: "https://evil.example.com" } }, png);
  ok(xo === 403, `cross-origin upload refused (CSRF guard) [got ${xo}]`);
  const xj = await raw({ path: "/api/jobs", method: "POST", headers: { origin: "https://evil.example.com", "content-type": "text/plain" } }, JSON.stringify({ kind: "new", brief: "a brief that is long enough" }));
  ok(xj === 403, "cross-origin job start refused (text/plain simple request)");

  let r = await J("/api/jobs", { kind: "new", brief: "A short film using the attached material please", slug: "stub-att", attachments: [{ id: "deadbeef", role: "asset" }] });
  ok(r.s === 400, "unknown attachment id rejected");
  r = await J("/api/jobs", { kind: "new", brief: "A short film using the attached material please", slug: "stub-att", attachments: [{ id: u1.j.id, role: "reference" }, { id: u2.j.id, role: "asset" }] });
  ok(r.s === 200 && r.j.attachments.length === 2, "job accepted with two attachments");
  const done = await until(async () => { const j = (await J("/api/jobs/" + r.j.id)).j; return j.meta.status !== "running" ? j : null; });
  const text = done.log.map((e) => e.text).join("\n");
  ok(text.includes(`inbox/${u1.j.id}/logo (1).png  [role: reference]`) && new RegExp(`inbox/${u2.j.id}/[^\\n]*\\[role: asset\\]`).test(text), "prompt lists each file with its role and inbox path");
  ok(/mh_importfile/.test(text), "prompt tells the agent to import with mh_importfile");
  const del = await fetch(BASE + "/api/uploads/" + u1.j.id, { method: "DELETE" });
  ok(del.ok && !fs.existsSync(path.join(root, "inbox", u1.j.id)), "an upload can be removed");
  await fetch(BASE + "/api/uploads/" + u2.j.id, { method: "DELETE" });
  r = await J("/api/projects/ex-world-tides");
  ok(Array.isArray(r.j.assets) && Array.isArray(r.j.references), "project detail carries assets and references");
  const forb = await fetch(BASE + "/api/projects/ex-world-tides/file/direction.json");
  ok(forb.status === 403, "file route is limited to the assets and references folders");
}
