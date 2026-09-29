import type { InputStatus } from "@astryxdesign/core";
import type { ZodError } from "zod";

/** Status per field, keyed by dotted path (the same key passed to `statusFor`). */
export type FieldStatuses = Record<string, InputStatus>;

/** Bucket for issues with no path: form-level `.refine`/`.strict`, unknown keys. */
export const FORM_KEY = "form";

export type FieldIssue = { field: string; message: string };

/**
 * Accepts either a client-side `ZodError` or the `{ details }` payload a
 * `parseBody` 400 carries, so one mapper serves pre-submit and post-submit.
 */
export function toFieldStatuses(
  source: ZodError | { details?: FieldIssue[] },
): FieldStatuses {
  const issues: FieldIssue[] =
    "issues" in source
      ? source.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }))
      : (source.details ?? []);

  const statuses: FieldStatuses = {};
  for (const { field, message } of issues) {
    const key = field || FORM_KEY;
    // First issue per field wins; later ones on the same field are noise.
    if (!statuses[key]) statuses[key] = { type: "error", message };
  }
  return statuses;
}
