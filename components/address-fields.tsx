"use client";
import type { Address } from "@/lib/requests/address";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function AddressFields({
  label,
  value,
  onChange,
  errors,
  disabled = false,
}: {
  disabled?: boolean;
  label: "Pickup" | "Destination";
  value: Address;
  onChange: (value: Address) => void;
  errors?: Partial<Record<keyof Address, string>>;
}) {
  return (
    <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
      <legend className="mb-3 font-semibold">{label} address</legend>
      {(["street", "city", "state", "zip"] as const).map((key) => (
        <div
          key={key}
          className={key === "street" ? "space-y-2 sm:col-span-2" : "space-y-2"}
        >
          <Label htmlFor={`${label}-${key}`}>
            {label} {key === "zip" ? "ZIP" : key}
          </Label>
          <Input
            id={`${label}-${key}`}
            autoComplete={`${label === "Pickup" ? "section-pickup shipping" : "section-destination shipping"} ${key === "street" ? "address-line1" : key === "city" ? "address-level2" : key === "state" ? "address-level1" : "postal-code"}`}
            className="min-h-11"
            value={value[key]}
            onChange={(event) =>
              onChange({
                ...value,
                [key]:
                  key === "state"
                    ? event.target.value.toUpperCase()
                    : event.target.value,
              })
            }
            maxLength={key === "zip" ? 10 : key === "state" ? 2 : 150}
            required
            aria-invalid={!!errors?.[key]}
            aria-describedby={
              errors?.[key] ? `${label}-${key}-error` : undefined
            }
          />
          {errors?.[key] && (
            <p
              id={`${label}-${key}-error`}
              className="text-sm text-destructive"
            >
              {errors[key]}
            </p>
          )}
        </div>
      ))}
    </fieldset>
  );
}
