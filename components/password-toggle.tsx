"use client";

/**
 * "Show"/"Hide" text button that sits inside a password input (give the input
 * `pr-16` and wrap both in a `relative` element). The accessible name names
 * the field, e.g. "Show password", and changes with the state.
 */
export function PasswordToggle({
  shown,
  field,
  controls,
  disabled,
  onToggle,
}: {
  shown: boolean;
  /** Lower-case field name used in the accessible name. */
  field: string;
  controls: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${shown ? "Hide" : "Show"} ${field}`}
      aria-controls={controls}
      disabled={disabled}
      onClick={onToggle}
      className="absolute top-0 right-0 inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    >
      {shown ? "Hide" : "Show"}
    </button>
  );
}
