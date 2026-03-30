export function formatJsonPretty(raw: string):
  | { ok: true; text: string }
  | { ok: false; message: string } {
  const t = raw.trim();
  if (t === "") {
    return { ok: true, text: "" };
  }
  try {
    const parsed = JSON.parse(t) as unknown;
    return { ok: true, text: JSON.stringify(parsed, null, 2) };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export function isValidJson(text: string): boolean {
  const t = text.trim();
  if (t === "") {
    return true;
  }
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

export function jsonValidationMessage(text: string): string | null {
  const t = text.trim();
  if (t === "") {
    return null;
  }
  try {
    JSON.parse(t);
    return null;
  } catch {
    return "JSON not valid";
  }
}
