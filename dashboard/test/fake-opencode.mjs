// Stand-in for `opencode` used only by dashboard tests: no model, no network, no tokens.
import fs from "node:fs";
const a = process.argv.slice(2);
if (a[0] === "--version") { console.log("9.9.9-fake"); process.exit(0); }
if (a[0] === "models") { console.log("fake/model-a\nfake/model-b"); process.exit(0); }
if (a[0] === "run") {
  const prompt = fs.readFileSync(0, "utf8");
  const out = (o) => console.log(JSON.stringify(o));
  out({ type: "step_start", sessionID: "ses_fake1", part: {} });
  out({ type: "tool_use", sessionID: "ses_fake1", part: { tool: "mh_create", state: { status: "completed", input: { slug: "fake-film", format: "horizontal" } } } });
  out({ type: "tool_use", sessionID: "ses_fake1", part: { tool: "mh_gate", state: { status: "error", input: { slug: "fake-film" }, error: "boom" } } });
  out({ type: "text", sessionID: "ses_fake1", part: { text: "PROMPT-SEEN: " + prompt } });
  if (/SLOW/.test(prompt)) { setInterval(() => {}, 1000); }
  else if (/FAIL/.test(prompt)) { out({ type: "error", error: { data: { message: "invalid api key" } } }); process.exit(1); }
  else { out({ type: "step_finish", part: { cost: 0.0123 } }); process.exit(0); }
}
