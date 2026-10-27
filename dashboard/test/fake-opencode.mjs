// Stand-in for `opencode` used only by dashboard tests: no model, no network, no tokens.
import fs from "node:fs";
const a = process.argv.slice(2);
if (a[0] === "--version") { console.log("9.9.9-fake"); process.exit(0); }
if (a[0] === "models") { console.log("fake/model-a\nfake/model-b"); process.exit(0); }
if (a[0] === "run") {
  const prompt = fs.readFileSync(0, "utf8");
  const out = (o) => console.log(JSON.stringify(o));
  if (a.includes("brief-writer")) { // the Enhance button: no tools, only text
    if (/ENHERR/.test(prompt)) { out({ type: "error", error: { data: { message: "invalid api key" } } }); process.exit(1); }
    if (/ENHSHORT/.test(prompt)) { out({ type: "text", part: { text: "ok" } }); process.exit(0); }
    out({ type: "text", part: { text: "ENHANCED BRIEF\nOne line: tides film.\nBeats: 1) moon pulls water.\n--- received ---\n" + prompt } }); process.exit(0);
  }
  out({ type: "step_start", sessionID: "ses_fake1", part: {} });
  out({ type: "tool_use", sessionID: "ses_fake1", part: { tool: "mh_create", state: { status: "completed", input: { slug: "fake-film", format: "horizontal" } } } });
  out({ type: "tool_use", sessionID: "ses_fake1", part: { tool: "mh_gate", state: { status: "error", input: { slug: "fake-film" }, error: "boom" } } });
  out({ type: "text", sessionID: "ses_fake1", part: { text: "PROMPT-SEEN: " + prompt } });
  // behave like a real run: the project folder exists unless the test says the agent never got that far
  const slugM = /Project slug: ([a-z0-9-]+)/.exec(prompt);
  if (slugM && !/NOCREATE/.test(prompt)) { fs.mkdirSync("projects/" + slugM[1] + "/.mh", { recursive: true }); const phase = /STOPEARLY/.test(prompt) ? "brief" : "handoff"; fs.writeFileSync("projects/" + slugM[1] + "/.mh/state.json", JSON.stringify({ phase })); if (/the user will choose/.test(prompt)) fs.writeFileSync("projects/" + slugM[1] + "/.mh/storylines.json", JSON.stringify({ storylines: [{ id: "a" }, { id: "b" }, { id: "c" }] })); }
  if (/You stopped before finishing/.test(prompt)) { const m = /projects\/([a-z0-9-]+)\)/.exec(prompt); if (m) fs.writeFileSync("projects/" + m[1] + "/.mh/state.json", JSON.stringify({ phase: "handoff" })); }
  if (/TOOLERRLAST/.test(prompt)) { out({ type: "tool_use", sessionID: "ses_fake1", part: { tool: "mh_gate", state: { status: "error", input: { slug: "x" }, error: "boom" } } }); process.exit(0); }
  if (/SLOW/.test(prompt)) { setInterval(() => {}, 1000); }
  else if (/FAIL/.test(prompt)) { out({ type: "error", error: { data: { message: "invalid api key" } } }); process.exit(1); }
  else { out({ type: "step_finish", part: { cost: 0.0123 } }); process.exit(0); }
}
