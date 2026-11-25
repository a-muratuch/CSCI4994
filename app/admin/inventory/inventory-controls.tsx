"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHydrated } from "@/lib/use-hydrated";
import {
  saveCatalogItem,
  savePricing,
  saveTruckCapacity,
} from "@/lib/inventory/actions";
import { inventoryRooms, type CatalogItem } from "@/lib/requests/inventory";
import type { PricingSettings } from "@/lib/estimates/suggestion";
import { controlClass } from "../admin-ui";

/** Shared submit/feedback behaviour for the small forms on this page. */
function useSave() {
  const [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const hydrated = useHydrated();
  const feedback = useRef<HTMLParagraphElement>(null);
  function run(
    action: () => Promise<{ ok: boolean; message?: string }>,
    after?: () => void,
  ) {
    start(async () => {
      const result = await action().catch(() => ({
        ok: false,
        message: "The change could not be confirmed. Reload and try again.",
      }));
      setMessage(result.message ?? "");
      if (result.ok) after?.();
      requestAnimationFrame(() => feedback.current?.focus());
    });
  }
  const status = (
    <p
      ref={feedback}
      role="status"
      tabIndex={-1}
      className="text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      {message}
    </p>
  );
  return { run, status, disabled: pending || !hydrated, pending };
}

function Field({
  id,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-describedby={hint ? id + "-hint" : undefined}
        className="min-h-11 md:text-base"
        {...props}
      />
      {hint && (
        <p
          id={id + "-hint"}
          className="text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function PricingForm({ settings }: { settings: PricingSettings }) {
  const id = useId();
  const { run, status, disabled, pending } = useSave();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    run(() => savePricing(data));
  }
  return (
    <form
      aria-label="Pricing settings"
      noValidate
      onSubmit={submit}
      className="space-y-4"
    >
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <Field
          id={id + "hourly"}
          name="workerHourly"
          label="Hourly rate per mover ($)"
          inputMode="decimal"
          defaultValue={dollars(settings.workerHourlyCents)}
          required
        />
        <Field
          id={id + "truck"}
          name="truckFee"
          label="Truck fee per trip ($)"
          inputMode="decimal"
          defaultValue={dollars(settings.truckFeeCents)}
          required
        />
        <Field
          id={id + "mile"}
          name="perMile"
          label="Rate per mile driven ($)"
          inputMode="decimal"
          defaultValue={dollars(settings.perMileCents)}
          required
        />
        <Field
          id={id + "pace"}
          name="cubicFeetPerWorkerHour"
          label="Cubic feet per mover per hour"
          type="number"
          min={5}
          max={500}
          defaultValue={settings.cubicFeetPerWorkerHour}
          hint="How much one mover loads and unloads in an hour."
          required
        />
        <Field
          id={id + "minimum"}
          name="minimumHours"
          label="Minimum billed hours"
          type="number"
          min={1}
          max={12}
          step={0.5}
          defaultValue={settings.minimumHours}
          required
        />
        <Field
          id={id + "speed"}
          name="travelMph"
          label="Average driving speed (mph)"
          type="number"
          min={10}
          max={80}
          defaultValue={settings.travelMph}
          required
        />
        <Field
          id={id + "road"}
          name="roadFactor"
          label="Road factor"
          type="number"
          min={1}
          max={2}
          step={0.01}
          defaultValue={settings.roadFactor}
          hint="Multiplies the straight-line ZIP distance to approximate road miles (about 1.2)."
          required
        />
        {settings.turnaroundMinutes != null && (
          <Field
            id={id + "turnaround"}
            name="turnaroundMinutes"
            label="Turnaround between jobs (minutes)"
            type="number"
            min={0}
            max={180}
            defaultValue={settings.turnaroundMinutes}
            hint="Added to driving time when checking whether a crew can reach its next job (paperwork, break, fuel)."
            required
          />
        )}
      </fieldset>
      <Button type="submit" className="min-h-11" disabled={disabled}>
        {pending ? "Saving…" : "Save pricing"}
      </Button>
      {status}
    </form>
  );
}

export function CapacityForm({
  truck,
}: {
  truck: { id: string; name: string; capacityCubicFeet: number | null };
}) {
  const id = useId();
  const { run, status, disabled, pending } = useSave();
  return (
    <form
      aria-label={`Capacity for ${truck.name}`}
      noValidate
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const value = String(
          new FormData(event.currentTarget).get("capacity") ?? "",
        );
        run(() => saveTruckCapacity(truck.id, value));
      }}
    >
      {/* Long truck names wrap above a fixed-width field so Save buttons align. */}
      <Label htmlFor={id + "capacity"} className="[overflow-wrap:anywhere]">
        {truck.name} capacity (cu ft)
      </Label>
      <div className="flex items-center gap-3">
        <Input
          id={id + "capacity"}
          name="capacity"
          type="number"
          min={50}
          max={5000}
          inputMode="numeric"
          placeholder="Not set"
          defaultValue={truck.capacityCubicFeet ?? ""}
          disabled={disabled}
          className="min-h-11 w-36 md:text-base"
        />
        <Button
          type="submit"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {status}
    </form>
  );
}

export function CatalogItemForm({ item }: { item?: CatalogItem }) {
  const id = useId();
  const { run, status, disabled, pending } = useSave();
  return (
    <form
      aria-label={item ? `Edit ${item.name}` : "Add catalog item"}
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          data = new FormData(form);
        run(
          () =>
            saveCatalogItem(item?.id ?? null, {
              name: data.get("name"),
              room: data.get("room"),
              cubicFeet: data.get("cubicFeet"),
              weightLb: data.get("weightLb"),
              active: data.get("active") === "on",
            }),
          () => {
            if (!item) form.reset();
          },
        );
      }}
    >
      <fieldset
        disabled={disabled}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Field
          id={id + "name"}
          name="name"
          label="Item name"
          maxLength={100}
          defaultValue={item?.name ?? ""}
          required
        />
        <div className="space-y-2">
          <Label htmlFor={id + "room"}>Room</Label>
          <select
            id={id + "room"}
            name="room"
            defaultValue={item?.room ?? "Other"}
            className={controlClass}
          >
            {inventoryRooms.map((room) => (
              <option key={room}>{room}</option>
            ))}
          </select>
        </div>
        <Field
          id={id + "size"}
          name="cubicFeet"
          label="Size (cu ft)"
          type="number"
          min={0.1}
          max={500}
          step={0.1}
          defaultValue={item?.cubicFeet ?? ""}
          required
        />
        <Field
          id={id + "weight"}
          name="weightLb"
          label="Weight (lb)"
          type="number"
          min={0}
          max={3000}
          defaultValue={item?.weightLb ?? ""}
          required
        />
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <label
          className="flex min-h-11 items-center gap-3"
          htmlFor={id + "active"}
        >
          <input
            id={id + "active"}
            name="active"
            type="checkbox"
            defaultChecked={item?.active ?? true}
            disabled={disabled}
            className="size-4 accent-primary"
          />
          Offered to customers
        </label>
        <Button
          type="submit"
          variant={item ? "outline" : "default"}
          className="min-h-11"
          disabled={disabled}
        >
          {pending ? "Saving…" : item ? "Save item" : "Add item"}
        </Button>
      </div>
      {status}
    </form>
  );
}
