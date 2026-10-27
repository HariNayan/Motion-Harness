// Motion-harness tools for OpenCode. Each export becomes a tool named mh_<export>.
// They are thin wrappers over harness/mh.mjs so the CLI stays the single source of truth
// (the same commands work from a terminal). None of them renders video.
import { tool } from "@opencode-ai/plugin"
import { spawnSync } from "node:child_process"
import path from "node:path"

const z = tool.schema

function run(directory: string, args: string[]): string {
  const script = path.join(directory, "harness", "mh.mjs")
  const r = spawnSync(process.execPath, [script, ...args], { cwd: directory, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim()
  const head = r.status === 0 ? "" : `[exit ${r.status}] `
  // keep tool output readable for smaller models; the full report is always in the project's .mh/ folder
  return head + (text.length > 12000 ? text.slice(0, 6000) + "\n…[truncated; see .mh/gate-report.json]…\n" + text.slice(-5000) : text)
}

const slug = z.string().describe("project slug (folder name under projects/)")

export const create = tool({
  description: "Create a new HyperFrames project with harness state (.mh/). Starts in the 'brief' phase.",
  args: {
    slug: z.string().describe("kebab-case project name"),
    format: z.enum(["horizontal", "vertical", "square"]).default("horizontal"),
    depth: z.enum(["draft", "standard", "high"]).default("standard").describe("planning depth / revision budget"),
  },
  async execute(a, ctx) {
    return run(ctx.directory, ["new", a.slug, "--format", a.format, "--depth", a.depth])
  },
})

export const status = tool({
  description: "Show the project's phase, plan-review count, revision budget and last gate result.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["status", a.slug]) },
})

export const lint = tool({
  description: "Lint the creative direction + storyboard (missing fields, read-time, density, repetition, pacing, banned defaults, contrast). Run before and after editing the plan.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["lint", a.slug]) },
})

export const reviewplan = tool({
  description: "Record one structured plan review pass: the weak scenes/repetition/pacing problems you found and what you changed. Required N times before build (N depends on depth).",
  args: { slug, findings: z.string(), resolved: z.string() },
  async execute(a, ctx) { return run(ctx.directory, ["review-plan", a.slug, "--findings", a.findings, "--resolved", a.resolved]) },
})

export const decide = tool({
  description: "Log a design/agent decision with its reason, so later revisions do not silently undo it.",
  args: { slug, what: z.string(), why: z.string().optional(), scene: z.string().optional() },
  async execute(a, ctx) {
    const args = ["decide", a.slug, "--what", a.what]
    if (a.why) args.push("--why", a.why)
    if (a.scene) args.push("--scene", a.scene)
    return run(ctx.directory, args)
  },
})

export const advance = tool({
  description: "Move to the next phase (brief>direction>storyboard>review>build>verify>handoff). Refuses with BLOCK lines when the current phase's requirements are unmet.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["advance", a.slug]) },
})

export const preset = tool({
  description: "Apply a design-system preset (e.g. 'night-sky': persistent world, HUD, captions, hero-object density) to direction.json. Overwrites designSystem; you still write concept, arc, rules and anti-patterns. Run mh_tokens afterwards.",
  args: { slug, name: z.string().default("night-sky") },
  async execute(a, ctx) { return run(ctx.directory, ["preset", a.slug, a.name]) },
})

export const tokens = tool({
  description: "Write assets/mh-tokens.css (colours, fonts, margins) from direction.json's design system. Re-run after changing the design system.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["tokens", a.slug]) },
})

export const cues = tool({
  description: "Inline beat/transcript timing (from `hyperframes beats` or a word-level transcript JSON) into assets/mh-cues.js so MH.audio can sync visuals. Only use with real timing data.",
  args: { slug, from: z.string().describe("path to beats or transcript JSON"), offset: z.number().optional() },
  async execute(a, ctx) {
    const args = ["cues", a.slug, "--from", a.from]
    if (a.offset != null) args.push("--offset", String(a.offset))
    return run(ctx.directory, args)
  },
})

export const frames = tool({
  description: "Capture preview still frames via `hyperframes snapshot` into .mh/frames/. This is the ONLY visual evidence. After calling it you must open the image files (read tool) before saying anything about how the video looks. Not a render.",
  args: { slug, at: z.string().optional().describe("comma-separated seconds, e.g. '1.5,4,7'; omit for the standard review set") },
  async execute(a, ctx) {
    const args = ["frames", a.slug]
    if (a.at) args.push("--at", a.at)
    return run(ctx.directory, args)
  },
})

export const gate = tool({
  description: "Run the quality gate: hyperframes check (lint/runtime/layout/contrast/craft), structure & timing, palette/font/size discipline, determinism, locked-scene drift, evidence freshness. Reports actual findings, no scores.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["gate", a.slug]) },
})

export const checklist = tool({
  description: "Show the 12-item quality checklist, or resolve one judgement item with a specific note. basis=visual is only accepted when fresh frames exist and you have looked at them.",
  args: {
    slug,
    id: z.string().optional().describe("item id to set (opening, narrative, variation, typography, transitions, clipping, assets, effects, ...)"),
    status: z.enum(["pass", "fail", "n/a"]).optional(),
    note: z.string().optional().describe("specific evidence: which frame/time/file you inspected and what you saw"),
    basis: z.enum(["visual", "source"]).optional(),
  },
  async execute(a, ctx) {
    if (!a.id) return run(ctx.directory, ["checklist", a.slug])
    return run(ctx.directory, ["checklist", a.slug, "set", a.id, a.status ?? "fail", "--note", a.note ?? "", "--basis", a.basis ?? "source"])
  },
})

export const lock = tool({
  description: "Snapshot scene file hashes so later edits to working scenes are detectable. Done automatically at handoff.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["lock", a.slug]) },
})

export const revise = tool({
  description: "Begin a targeted revision: logs the reason and which scenes you will touch; every other scene must stay unchanged. Counts against the revision budget.",
  args: { slug, reason: z.string(), scenes: z.string().describe("comma-separated scene ids (or 'index')"), replan: z.boolean().optional().describe("true to go back to the storyboard phase"), override: z.string().optional() },
  async execute(a, ctx) {
    const args = ["revise", a.slug, "--reason", a.reason, "--scenes", a.scenes]
    if (a.replan) args.push("--replan")
    if (a.override) args.push("--override", a.override)
    return run(ctx.directory, args)
  },
})

export const importfile = tool({
  description: "Import a file the user supplied (they are listed in the brief with their inbox paths) into a project. role=reference: a look/motion reference (video gets probed, sampled into frames and scene-cut times: open the frames, then fill the analysis); role=asset: raw material to use in the video (copied to assets/source/, probed, video gets preview frames). Only files under the harness inbox/ folder are accepted.",
  args: { slug, path: z.string().describe("inbox path exactly as listed in the brief"), role: z.enum(["reference", "asset"]), note: z.string().optional().describe("what the user said about this file") },
  async execute(a, ctx) {
    const args = ["import", a.slug, a.path, "--role", a.role]
    if (a.note) args.push("--note", a.note)
    return run(ctx.directory, args)
  },
})

export const refadd = tool({
  description: "Register a reference image/video and create its analysis template. Then look at the image and fill the analysis from what is actually visible. Stills cannot reveal animation timing.",
  args: { slug, file: z.string().describe("path to the reference image or video") },
  async execute(a, ctx) { return run(ctx.directory, ["ref", "add", a.slug, a.file]) },
})

export const reflint = tool({
  description: "Validate the reference analyses (no timing claims from stills, >=3 design rules, originality note).",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["ref", "lint", a.slug]) },
})

export const handoff = tool({
  description: "Write HANDOFF.md (evidence level, checklist, warnings) and print how to open the project in HyperFrames Studio. Requires phase 'handoff'. Does not render.",
  args: { slug, acceptFails: z.string().optional().describe("reason, only if you must hand off with failing checklist items") },
  async execute(a, ctx) {
    const args = ["handoff", a.slug]
    if (a.acceptFails) args.push("--accept-fails", a.acceptFails)
    return run(ctx.directory, args)
  },
})

export const studio = tool({
  description: "Start the HyperFrames Studio preview for the project in the background (no browser auto-open) so the user can review and render there.",
  args: { slug },
  async execute(a, ctx) { return run(ctx.directory, ["studio", a.slug]) },
})
