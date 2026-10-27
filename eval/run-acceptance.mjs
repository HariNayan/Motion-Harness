#!/usr/bin/env node
// Acceptance report: runs the harness gate over every project (or reads the last gate report) and writes
// eval/ACCEPTANCE-REPORT.md with ACTUAL findings. It computes no scores and never renders.
//   node eval/run-acceptance.mjs            # read existing .mh/gate-report.json files
//   node eval/run-acceptance.mjs --regate   # re-run `mh gate` on every project first (slow: launches Chrome)
//   node eval/run-acceptance.mjs --frames   # also re-capture review frames before gating
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = new Set(process.argv.slice(2));
const mh = (args) => spawnSync(process.execPath, [path.join(ROOT, "harness/mh.mjs"), ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const rj = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };

const projects = fs.readdirSync(path.join(ROOT, "projects")).filter((d) => fs.existsSync(path.join(ROOT, "projects", d, ".mh/state.json")));
const lines = [`# Acceptance report`, "", `Generated ${new Date().toISOString()} by eval/run-acceptance.mjs. Findings are copied from each project's .mh/gate-report.json; nothing here is a score.`, ""];
const summary = [];

for (const slug of projects) {
  const dir = path.join(ROOT, "projects", slug);
  const state = rj(path.join(dir, ".mh/state.json"));
  if (flags.has("--frames")) mh(["frames", slug]);
  if (flags.has("--regate") || flags.has("--frames")) mh(["gate", slug]);
  const gr = rj(path.join(dir, ".mh/gate-report.json"));
  const cl = rj(path.join(dir, ".mh/checklist.json"));
  const plan = state.adopted ? null : rj(path.join(dir, ".mh/plan-lint.json"));
  const rev = fs.existsSync(path.join(dir, ".mh/revisions.jsonl")) ? fs.readFileSync(path.join(dir, ".mh/revisions.jsonl"), "utf8").split("\n").filter(Boolean).length : 0;
  const origin = state.adopted ? `adopted: ${state.source}` : "built through the harness workflow";
  lines.push(`## ${slug}`, "", `- Origin: ${origin}`, `- Format: ${state.format}; phase: ${state.phase}; revisions logged: ${rev}`);
  if (!gr) { lines.push("- Gate: **not run**", ""); summary.push([slug, state.format, origin, "not run", "-", "-"]); continue; }
  lines.push(`- Gate (${gr.at}): ${gr.counts.error} error(s), ${gr.counts.warn} warning(s), ${gr.counts.info} note(s)`, `- Visual evidence: **${gr.visualEvidence}**${gr.visualEvidence === "fresh" ? ` (${gr.frameFiles.length} frame files in .mh/frames; a human or agent must still open them)` : ""}`);
  if (cl) {
    const c = Object.values(cl.items).reduce((a, v) => ((a[v.status] = (a[v.status] || 0) + 1), a), {});
    lines.push(`- Checklist: ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  }
  const rest = gr.findings.filter((f) => f.level !== "info");
  if (rest.length) { lines.push("", "Findings:"); for (const f of rest) lines.push(`- ${f.level.toUpperCase()} \`${f.code}\`${f.scene ? ` [${String(f.scene).split(/[\\/]/).pop()}]` : ""}: ${String(f.msg).slice(0, 300)}`); }
  lines.push("");
  summary.push([slug, state.format, origin, `${gr.counts.error}`, `${gr.counts.warn}`, gr.visualEvidence]);
}

const head = ["| project | format | origin | gate errors | gate warnings | visual evidence |", "| --- | --- | --- | --- | --- | --- |", ...summary.map((r) => `| ${r.join(" | ")} |`)];
lines.splice(3, 0, ...head, "");
fs.writeFileSync(path.join(ROOT, "eval/ACCEPTANCE-REPORT.md"), lines.join("\n"));
console.log(head.join("\n"));
console.log("\nwrote eval/ACCEPTANCE-REPORT.md");
