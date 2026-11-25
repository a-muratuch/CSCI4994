import type { EstimateInput } from "../domain";
export { isUuid as uuid } from "../ids.ts";

export function validateEstimate(value: unknown): {
  input?: EstimateInput;
  error?: string;
} {
  const fail = {
    error:
      "Provide 1–20 valid pricing lines, scope lists and terms within the field limits.",
  };
  if (!value || typeof value !== "object") return fail;
  const lines = Reflect.get(value, "lines");
  const inclusions = Reflect.get(value, "inclusions");
  const exclusions = Reflect.get(value, "exclusions");
  const terms = Reflect.get(value, "terms");
  if (
    !Array.isArray(lines) ||
    lines.length < 1 ||
    lines.length > 20 ||
    typeof terms !== "string" ||
    !terms.trim() ||
    terms.trim().length > 2000
  )
    return fail;
  const clean: EstimateInput["lines"] = [];
  for (const line of lines) {
    if (!line || typeof line !== "object") return fail;
    const label = Reflect.get(line, "label"),
      amount = Reflect.get(line, "amountCents");
    if (
      typeof label !== "string" ||
      !label.trim() ||
      label.trim().length > 150 ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      amount > 999999999
    )
      return fail;
    clean.push({ label: label.trim(), amountCents: amount });
  }
  const scope = (items: unknown): string[] | null =>
    Array.isArray(items) &&
    items.length >= 1 &&
    items.length <= 20 &&
    items.every(
      (x) =>
        typeof x === "string" && x.trim().length >= 1 && x.trim().length <= 500,
    )
      ? items.map((x) => x.trim())
      : null;
  const included = scope(inclusions),
    excluded = scope(exclusions);
  if (!included || !excluded) return fail;
  const total = clean.reduce((sum, line) => sum + line.amountCents, 0);
  if (total <= 0 || total > 999999999)
    return {
      error:
        "The total must be greater than zero and no more than $9,999,999.99.",
    };
  return {
    input: {
      lines: clean,
      inclusions: included,
      exclusions: excluded,
      terms: terms.trim(),
    },
  };
}

export function estimateFieldErrors(value: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!value || typeof value !== "object")
    return { form: "Enter an estimate." };
  const lines = Reflect.get(value, "lines");
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 20)
    errors.lines = "Use 1–20 pricing lines.";
  else
    lines.forEach((line, i) => {
      const label = line?.label,
        amount = line?.amountCents;
      if (
        typeof label !== "string" ||
        !label.trim() ||
        label.trim().length > 150
      )
        errors[`line-label-${i}`] = "Enter a description of 1–150 characters.";
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999999999)
        errors[`line-price-${i}`] =
          "Enter a non-negative amount with up to two decimal places.";
    });
  for (const key of ["inclusions", "exclusions"]) {
    const items = Reflect.get(value, key);
    if (
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20 ||
      items.some(
        (x) => typeof x !== "string" || !x.trim() || x.trim().length > 500,
      )
    )
      errors[key] = "Enter 1–20 items, up to 500 characters each.";
  }
  const terms = Reflect.get(value, "terms");
  if (typeof terms !== "string" || !terms.trim() || terms.trim().length > 2000)
    errors.terms = "Enter terms of 1–2,000 characters.";
  return errors;
}

/** One list item per line, trimmed, blank lines dropped. */
export function splitLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export type EstimateDefaults = {
  inclusions: string[];
  exclusions: string[];
  terms: string;
};

/**
 * Standard inclusions, exclusions and terms (Phase 8B) from a form with one
 * list item per line. Uses the same limits as an estimate.
 */
export function validateEstimateDefaults(
  value: unknown,
): { input: EstimateDefaults } | { errors: Record<string, string> } {
  const text = (key: string) => {
    const field =
      value && typeof value === "object" ? Reflect.get(value, key) : undefined;
    return typeof field === "string" ? field : "";
  };
  const input = {
    inclusions: splitLines(text("inclusions")),
    exclusions: splitLines(text("exclusions")),
    terms: text("terms").trim(),
  };
  const { inclusions, exclusions, terms } = estimateFieldErrors(input);
  const errors = Object.fromEntries(
    Object.entries({ inclusions, exclusions, terms }).filter(([, e]) => e),
  );
  return Object.keys(errors).length ? { errors } : { input };
}
