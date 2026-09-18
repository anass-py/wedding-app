/** Supabase throws plain objects ({ message, code, details }), not Error instances. */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown };
    const m = o.message ?? o.error_description ?? o.details;
    if (typeof m === "string" && m) return m;
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through */
    }
  }
  return String(e);
}

/** A missing column/table means schema.sql has not been (re-)run on this Supabase project. */
export function isSchemaOutOfDate(e: unknown): boolean {
  const m = describeError(e);
  return /does not exist|could not find|schema cache|relation .* does not exist/i.test(m);
}
