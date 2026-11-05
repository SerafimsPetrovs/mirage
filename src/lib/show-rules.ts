// Pure rules for interactive series ("the series the internet writes"). Unit-tested in logic.test.ts.

/** Price for "get your name into the series". */
export const CAMEO_PRICE = 150;
/** Open (pending/approved) cameo requests per viewer per series. */
export const CAMEO_MAX_OPEN = 3;
export const CAMEO_NAME_MAX = 24;
/** New poll after each published episode stays open this long. */
export const SHOW_POLL_HOURS = 24;

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.\-]{1,23}$/u;
// Minimal slur / spam guard — names are also moderated by an admin before they air.
const BAD = /(хуй|хуе|пизд|ебат|ебан|бляд|сука|пидор|нацис|nigg|fuck|cunt|nazi|http|www\.|\.com|\.ru|t\.me|@)/i;

export type CameoNameProblem = "empty" | "format" | "banned";

export function normalizeCameoName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export function cameoNameProblem(raw: string): CameoNameProblem | null {
  const name = normalizeCameoName(raw);
  if (!name) return "empty";
  if (name.length > CAMEO_NAME_MAX || !NAME_RE.test(name)) return "format";
  if (BAD.test(name)) return "banned";
  return null;
}

export type ScriptDraft = {
  title: string;
  summary: string;
  scenes: { prompt: string; text: string }[];
  question: string;
  optionA: string;
  optionB: string;
  caption: string;
};

/** Pulls the first JSON object out of an LLM answer (models like to wrap JSON in prose / code fences). */
export function parseScriptJson(raw: string): ScriptDraft | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const scenes = Array.isArray(j.scenes)
      ? (j.scenes as Record<string, unknown>[]).slice(0, 8).map((s) => ({ prompt: str(s?.prompt, 600), text: str(s?.text, 1200) })).filter((s) => s.prompt || s.text)
      : [];
    const d: ScriptDraft = {
      title: str(j.title, 120),
      summary: str(j.summary, 1000),
      scenes,
      question: str(j.question, 200),
      optionA: str(j.optionA, 80),
      optionB: str(j.optionB, 80),
      caption: str(j.caption, 600),
    };
    return d.title && d.scenes.length && d.question && d.optionA && d.optionB ? d : null;
  } catch {
    return null;
  }
}

/** Human-editable text form of a draft (stored in ShowScript.content). */
export function scriptToText(d: Pick<ScriptDraft, "summary" | "scenes">) {
  return [
    d.summary,
    "",
    ...d.scenes.flatMap((s, i) => [`СЦЕНА ${i + 1}`, `PROMPT: ${s.prompt}`, s.text, ""]),
  ]
    .join("\n")
    .trim();
}

/** Video prompts from an (edited) script text: every line starting with "PROMPT:". */
export function promptsFromScript(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^PROMPT:/i.test(l))
    .map((l) => l.replace(/^PROMPT:\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}
