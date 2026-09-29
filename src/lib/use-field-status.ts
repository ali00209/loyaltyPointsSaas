"use client";

import { useCallback, useState } from "react";
import type { ZodType } from "zod";
import {
  toFieldStatuses,
  type FieldIssue,
  type FieldStatuses,
} from "./form-status";

/**
 * Per-field validation status for one schema. Errors stay hidden until a field is
 * blurred, so a half-typed email never turns red; `revealAll` shows every field
 * at once, which is what a submit should do.
 *
 * Only `error` is ever produced. `warning` and `success` are not derivable from
 * zod and need a rule layer that does not exist yet.
 *
 * `extra` carries field errors the schema cannot express and overrides the
 * schema result for the fields it names. Two callers: the `details` array from a
 * `parseBody` 400 (unique constraints, cross-table rules), and wizard-only
 * invariants that never reach the server.
 */
export function useFieldStatus<S extends ZodType>(
  schema: S,
  values: unknown,
  extra?: FieldIssue[] | null,
) {
  const [blurred, setBlurred] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [revealed, setRevealed] = useState(false);

  // Recomputed per render on purpose: `values` is a fresh object on most renders
  // anyway, so memoizing on it would only hide the recompute.
  const errors: FieldStatuses = (() => {
    const result = schema.safeParse(values);
    const local = result.success ? {} : toFieldStatuses(result.error);
    return extra?.length
      ? { ...local, ...toFieldStatuses({ details: extra }) }
      : local;
  })();

  // Not memoized on purpose: `errors` is rebuilt above every render, so a
  // useCallback here would have an unstable dep and never hit.
  const statusFor = (key: string) =>
    revealed || blurred.has(key) ? errors[key] : undefined;

  return {
    /** Pass as `status` to an Astryx input. `undefined` renders no status. */
    statusFor,
    /** Wire to the input's blur. */
    onBlur: useCallback(
      (key: string) =>
        setBlurred((prev) => (prev.has(key) ? prev : new Set(prev).add(key))),
      [],
    ),
    /** Call before mutating, so a failed parse marks every field. */
    revealAll: useCallback(() => setRevealed(true), []),
    /** Call after a successful submit. */
    reset: useCallback(() => {
      setRevealed(false);
      setBlurred(new Set<string>());
    }, []),
  };
}
