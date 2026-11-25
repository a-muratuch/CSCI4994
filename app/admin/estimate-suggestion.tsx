"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { heroActionClass } from "@/components/hero-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  suggestEstimate,
  type SuggestionInput,
} from "@/lib/estimates/suggestion";

export type { SuggestionInput };

/**
 * Shows the inventory-based suggestion and lets the administrator override the
 * distance. "Use" copies the priced lines into the draft; nothing is saved
 * until the administrator saves the draft.
 */
export function EstimateSuggestion({
  input,
  disabled,
  onUse,
}: {
  input: SuggestionInput;
  disabled: boolean;
  onUse: (lines: { label: string; amountCents: number }[]) => void;
}) {
  const id = useId();
  const [miles, setMiles] = useState(
    input.estimatedMiles === null ? "" : String(input.estimatedMiles),
  );
  const [message, setMessage] = useState("");
  const parsedMiles =
    miles.trim() === ""
      ? null
      : Number.isFinite(Number(miles))
        ? Number(miles)
        : null;
  const milesInvalid =
    miles.trim() !== "" &&
    !(parsedMiles !== null && parsedMiles >= 0 && parsedMiles <= 3500);
  const suggestion = suggestEstimate({
    lines: input.lines,
    settings: input.settings,
    trucks: input.trucks,
    miles: milesInvalid ? null : parsedMiles,
  });

  return (
    <section
      aria-labelledby={id + "title"}
      className="space-y-4 rounded-2xl bg-primary p-5 text-primary-foreground"
    >
      <h3
        id={id + "title"}
        className="text-xs font-semibold tracking-[0.08em] text-brand-on-primary uppercase"
      >
        Suggested pricing
        <span className="sr-only"> from the customer’s inventory</span>
      </h3>
      {!suggestion ? (
        <p className="text-sm text-primary-foreground/80">
          The customer did not list an inventory. Prepare the pricing manually.
        </p>
      ) : (
        <>
          <div className="max-w-xs space-y-2">
            <Label htmlFor={id + "miles"}>One-way distance (miles)</Label>
            <Input
              id={id + "miles"}
              type="number"
              min={0}
              max={3500}
              inputMode="numeric"
              value={miles}
              disabled={disabled}
              aria-invalid={milesInvalid}
              aria-describedby={id + "miles-hint"}
              onChange={(e) => {
                setMiles(e.target.value);
                setMessage("");
              }}
              // The panel sits inside the estimate form: Enter here must not
              // save the draft.
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              className="bg-background text-foreground md:text-base"
            />
            <p
              id={id + "miles-hint"}
              className="text-xs leading-5 text-primary-foreground/70"
            >
              {milesInvalid
                ? "Enter 0–3,500 miles."
                : input.estimatedMiles === null
                  ? "ZIP codes were not available. Enter the driving distance."
                  : `About ${input.estimatedMiles} mi, estimated from the ZIP codes. Replace it with the exact driving distance if known.`}
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-primary-foreground/85">
            {suggestion.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <table className="w-full text-sm">
            <caption className="sr-only">Suggested pricing lines</caption>
            <tbody>
              {suggestion.lines.map((line) => (
                <tr
                  key={line.label}
                  className="border-b border-primary-foreground/15"
                >
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {line.label}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(line.amountCents)}
                  </td>
                </tr>
              ))}
              <tr>
                <th scope="row" className="py-2 pr-3 text-left">
                  Suggested total
                </th>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {formatMoney(suggestion.totalCents)}
                </td>
              </tr>
            </tbody>
          </table>
          <Button
            type="button"
            className={heroActionClass}
            disabled={disabled}
            onClick={() => {
              onUse(suggestion.lines);
              setMessage(
                "Suggested lines copied into the draft. Review them before saving.",
              );
            }}
          >
            Use suggested lines
          </Button>
        </>
      )}
      <p role="status" className="text-sm text-primary-foreground">
        {message}
      </p>
    </section>
  );
}
