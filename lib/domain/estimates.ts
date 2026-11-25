import type { EstimateInput } from "./types";
export function estimateTotal(input: EstimateInput) {
  return input.lines.reduce((sum, line) => sum + line.amountCents, 0);
}
export function parseCents(value: string): number | null {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function estimateError(input: EstimateInput): string | undefined {
  if (
    !input.lines.length ||
    input.lines.length > 20 ||
    input.lines.some(
      (l) =>
        !l.label.trim() ||
        l.label.length > 150 ||
        !Number.isSafeInteger(l.amountCents) ||
        l.amountCents < 0 ||
        l.amountCents > 999999999,
    )
  )
    return "Provide 1–20 labeled prices, each from $0 to $9,999,999.99, with at most two decimal places.";
  if (
    !Number.isSafeInteger(estimateTotal(input)) ||
    estimateTotal(input) <= 0 ||
    estimateTotal(input) > 999999999
  )
    return "The total must be greater than zero and no more than $9,999,999.99.";
  if (
    [input.inclusions, input.exclusions].some(
      (items) =>
        !items.length ||
        items.length > 20 ||
        items.some((x) => !x.trim() || x.length > 500),
    ) ||
    !input.terms.trim() ||
    input.terms.length > 2000
  )
    return "Provide inclusions, exclusions (write None if applicable), and terms within the field limits.";
}
