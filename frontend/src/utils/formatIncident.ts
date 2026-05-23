/** Display root cause as plain text even if stored as raw JSON. */
export function formatRootCause(raw: string | undefined | null): string {
  if (!raw) return "Root cause analysis pending.";
  const text = raw.trim();
  if (!text.startsWith("{")) return text;

  try {
    const parsed = JSON.parse(text) as { root_cause?: string };
    if (typeof parsed.root_cause === "string") return parsed.root_cause;
  } catch {
    /* partial JSON */
  }

  const match = text.match(/"root_cause"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (match) return match[1].replace(/\\"/g, '"');

  return text;
}
