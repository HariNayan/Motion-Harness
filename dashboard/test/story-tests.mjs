// Storyline-mode / brand-URL / continue-job tests (shares the stub-opencode server from run-tests.mjs).
import fs from "node:fs";
import path from "node:path";

export async function storyTests({ BASE, J, ok, until, root }) {
  const finish = async (id) => until(async () => { const j = (await J("/api/jobs/" + id)).j; return j.meta.status !== "running" ? j : null; });
  const text = (j) => j.log.map((e) => e.text).join("\n");

  let r = await J("/api/jobs", { kind: "new", brief: "A short film about tides for students, please", slug: "stub-ask", pickStoryline: true, brandUrl: "https://example.com" });
  ok(r.s === 200, "job with storyline mode and brand URL accepted");
  let j = await finish(r.j.id), t = text(j);
  ok(/Do NOT pick one/.test(t) && /STOP/.test(t), "interactive mode tells the agent to write three storylines and stop");
  ok(/Brand source: https:\/\/example\.com\. After mh_create run mh_capture/.test(t), "brand website is passed with the capture instruction");

  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides for students, please", slug: "stub-auto" });
  j = await finish(r.j.id);
  ok(/pick your recommendation yourself with mh_storylinespick/.test(text(j)), "default mode lets the agent pick and disclose the others");

  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides for students, please", slug: "stub-bad", brandUrl: "javascript:alert(1)" });
  ok(r.s === 400, "non-http brand URL rejected");
  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides for students, please", slug: "stub-bad2", brandUrl: "https://a.com/x y" });
  ok(r.s === 400, "brand URL with whitespace rejected");


  // outcome honesty: exit code 0 is not success
  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides NOCREATE for the stub", slug: "stub-nocreate" });
  j = await finish(r.j.id);
  ok(j.meta.status === "incomplete" && /No project "stub-nocreate" was created/.test(text(j)), "a run that created no project is 'incomplete', not done");
  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides TOOLERRLAST for the stub", slug: "stub-toolerr" });
  j = await finish(r.j.id);
  ok(j.meta.status === "incomplete" && /stopped right after a failed tool call/.test(text(j)), "a run that ends on a failed tool call is 'incomplete'");
  for (const d of fs.readdirSync(path.join(root, "projects")).filter((x) => x.startsWith("stub-"))) fs.rmSync(path.join(root, "projects", d), { recursive: true, force: true });

  // a run that stops mid-workflow is not done, and Continue resumes the same OpenCode session
  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides STOPEARLY for the stub", slug: "stub-early" });
  j = await finish(r.j.id);
  ok(j.meta.status === "incomplete" && /"brief" phase, before handoff/.test(text(j)), "a run that stops in the brief phase is 'incomplete', not done");
  const rs = await J(`/api/jobs/${j.meta.id}/resume`, {});
  ok(rs.s === 200 && rs.j.kind === "resume" && rs.j.resumedFrom === j.meta.id, "continue starts a job tied to the stopped run");
  const rj2 = await finish(rs.j.id);
  ok(/You stopped before finishing/.test(text(rj2)) && /Do not start over/.test(text(rj2)) && rj2.meta.status === "done", "the continue prompt tells the agent not to start over, and the run finishes");
  const again2 = await J(`/api/jobs/${rj2.meta.id}/resume`, {});
  ok(again2.s === 409 && /already finished/.test(again2.j.error), "a finished run cannot be continued");
  r = await J("/api/jobs", { kind: "new", brief: "A short film about tides for students", slug: "stub-pick", pickStoryline: true });
  j = await finish(r.j.id);
  ok(j.meta.status === "done", "storyline-pick mode is done once three storylines exist");
  for (const d of fs.readdirSync(path.join(root, "projects")).filter((x) => x.startsWith("stub-"))) fs.rmSync(path.join(root, "projects", d), { recursive: true, force: true });

  // rerun: same request, fresh project name when the first project exists, never while something runs
  r = await J("/api/jobs", { kind: "new", brief: "A rerun test film about tides for students", slug: "stub-rr", depth: "high", format: "vertical", preset: "night-sky", model: "fake/model-b" });
  const first = await finish(r.j.id);
  const list = (await J("/api/jobs")).j;
  ok(list.every((x) => x.request === undefined), "the run list does not ship every brief");
  const rq = await J(`/api/jobs/${first.meta.id}/request`);
  ok(rq.s === 200 && rq.j.request.brief === "A rerun test film about tides for students" && rq.j.request.depth === "high" && rq.j.request.format === "vertical" && rq.j.request.model === "fake/model-b", "a run keeps its brief, options and model");
  const again = await J(`/api/jobs/${first.meta.id}/rerun`, {});
  ok(again.s === 200 && again.j.slug === "stub-rr-2" && again.j.model === "fake/model-b", "run again reuses the request and picks a free project name (stub-rr existed)");
  const second = await finish(again.j.id);
  ok(/Project slug: stub-rr-2/.test(text(second)) && /Planning depth: high/.test(text(second)) && /A rerun test film about tides/.test(text(second)), "the rerun prompt carries the same brief and options");
  r = await J("/api/jobs", { kind: "new", brief: "SLOW job so a rerun can be refused while it runs", slug: "stub-rr-slow" });
  const busy = await J(`/api/jobs/${first.meta.id}/rerun`, {});
  ok(busy.s === 409, "run again is refused while another job is running");
  await J(`/api/jobs/${r.j.id}/cancel`, {}); await finish(r.j.id);
  for (const d of fs.readdirSync(path.join(root, "projects")).filter((x) => x.startsWith("stub-"))) fs.rmSync(path.join(root, "projects", d), { recursive: true, force: true });

  // enhance: a tool-less rewrite that creates nothing and carries the dashboard settings
  r = await J("/api/enhance", { brief: "short" });
  ok(r.s === 400, "enhance refuses a prompt that is too short");
  r = await J("/api/enhance", { brief: "A film about tides for students", format: "vertical", depth: "high", preset: "night-sky", brandUrl: "https://example.com" });
  ok(r.s === 200 && /^ENHANCED BRIEF/.test(r.j.brief), "enhance returns the rewritten brief");
  ok(/format vertical, planning depth high/.test(r.j.brief) && /brand taken from https:\/\/example\.com/.test(r.j.brief) && /Request:\nA film about tides/.test(r.j.brief), "enhance sends the request with format, depth, look and brand");
  ok(!fs.readdirSync(path.join(root, "projects")).some((x) => x.startsWith("video-") && /stub|tides/.test(x)), "enhance creates no project");
  r = await J("/api/enhance", { brief: "A film about tides ENHERR for students" });
  ok(r.s === 502 && /api key/i.test(r.j.error) && /opencode auth login/.test(r.j.error), "enhance surfaces a provider error with the sign-in hint");
  r = await J("/api/enhance", { brief: "A film about tides ENHSHORT for students" });
  ok(r.s === 502 && /no usable brief/.test(r.j.error), "enhance rejects an empty answer instead of replacing the prompt with it");
  r = await J("/api/enhance", { brief: "A film about tides for students", attachments: [{ id: "deadbeef", role: "reference" }] });
  ok(r.s === 200 && !/Attached files/.test(r.j.brief), "enhance ignores attachments that no longer exist");

  // continue needs a real project with storylines: use a throwaway folder that looks like one
  const dir = path.join(root, "projects", "zz-story-test", ".mh"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ slug: "zz-story-test", format: "horizontal", depth: "high", phase: "direction" }));
  fs.writeFileSync(path.join(dir, "storylines.json"), JSON.stringify({ recommended: "b", reason: "x", picked: null, storylines: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] }));
  try {
    r = await J("/api/jobs", { kind: "continue", slug: "zz-story-test", pick: "z" });
    ok(r.s === 400, "continue with an unknown storyline id rejected");
    r = await J("/api/jobs", { kind: "continue", slug: "zz-story-test", pick: "c", model: "fake/model-a" });
    ok(r.s === 200 && r.j.kind === "continue", "continue job accepted for a real storyline id");
    j = await finish(r.j.id); t = text(j);
    ok(/picked "c"/.test(t) && /mh_storylinespick/.test(t) && /Do not render/.test(t), "continue prompt carries the picked id and the next steps");
    const d = (await J("/api/projects/zz-story-test")).j;
    ok(d.storylines && d.storylines.storylines.length === 3 && "review" in d && "brand" in d, "project detail exposes storylines, review and brand");
  } finally { fs.rmSync(path.join(root, "projects", "zz-story-test"), { recursive: true, force: true }); }
}
