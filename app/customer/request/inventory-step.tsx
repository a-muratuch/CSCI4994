"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inventoryLimits,
  inventoryRooms,
  inventoryTotals,
  type CatalogItem,
  type InventoryLine,
  type InventoryRoom,
} from "@/lib/requests/inventory";
import { controlClass } from "../customer-ui";

/** Running totals shown to customers and in the review step. */
export function InventorySummary({
  lines,
}: {
  lines: readonly InventoryLine[];
}) {
  const totals = inventoryTotals(lines);
  return (
    <p className="text-sm">
      <strong>{totals.items}</strong> item{totals.items === 1 ? "" : "s"} ·{" "}
      <strong>{totals.cubicFeet}</strong> cu ft · about{" "}
      <strong>{totals.weightLb.toLocaleString("en-US")}</strong> lb
    </p>
  );
}

/**
 * Optional inventory list. Catalog items are grouped by room; customers can
 * also describe an item that is not listed. Sizes are approximate.
 */
export function InventoryStep({
  catalog,
  lines,
  onChange,
  disabled,
}: {
  catalog: readonly CatalogItem[];
  lines: readonly InventoryLine[];
  onChange: (lines: InventoryLine[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [custom, setCustom] = useState({
    label: "",
    room: "Other" as InventoryRoom,
    cubicFeet: "",
    weightLb: "",
  });
  const [message, setMessage] = useState("");
  const full = lines.length >= inventoryLimits.lines;

  function add(line: InventoryLine) {
    // Adding the same catalog item again increases its quantity instead.
    const existing = line.catalogId
      ? lines.findIndex((l) => l.catalogId === line.catalogId)
      : -1;
    if (existing >= 0) {
      const next = [...lines];
      next[existing] = {
        ...next[existing],
        quantity: Math.min(
          inventoryLimits.quantity,
          next[existing].quantity + line.quantity,
        ),
      };
      onChange(next);
    } else if (full) {
      setMessage(`Use up to ${inventoryLimits.lines} lines.`);
      return;
    } else onChange([...lines, line]);
    setMessage(`Added ${line.quantity} × ${line.label}.`);
  }

  function addCatalog() {
    const item = catalog.find((c) => c.id === selected);
    const count = Number(quantity);
    if (!item || !Number.isInteger(count) || count < 1 || count > 99) {
      setMessage("Choose an item and a quantity from 1 to 99.");
      return;
    }
    add({
      catalogId: item.id,
      label: item.name,
      room: item.room,
      quantity: count,
      cubicFeet: item.cubicFeet,
      weightLb: item.weightLb,
    });
    setSelected("");
    setQuantity("1");
  }

  function addCustom() {
    const cubicFeet = Number(custom.cubicFeet),
      weightLb = Number(custom.weightLb || "0");
    if (
      !custom.label.trim() ||
      !(cubicFeet >= 0.5 && cubicFeet <= inventoryLimits.customCubicFeet) ||
      !(
        Number.isInteger(weightLb) &&
        weightLb >= 0 &&
        weightLb <= inventoryLimits.customWeightLb
      )
    ) {
      setMessage(
        `Describe the item, its size (0.5–${inventoryLimits.customCubicFeet} cu ft) and weight (0–${inventoryLimits.customWeightLb} lb).`,
      );
      return;
    }
    add({
      catalogId: null,
      label: custom.label.trim().slice(0, inventoryLimits.label),
      room: custom.room,
      quantity: 1,
      cubicFeet: Math.round(cubicFeet * 10) / 10,
      weightLb,
    });
    setCustom({ label: "", room: custom.room, cubicFeet: "", weightLb: "" });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">
        Optional. Listing your larger items and boxes helps us suggest the crew,
        truck and time. Sizes are approximate.
      </p>
      <fieldset className="space-y-3 rounded-lg border p-4" disabled={disabled}>
        <legend className="px-1 text-sm font-semibold">
          Add a listed item
        </legend>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor={id + "item"}>Item</Label>
            <select
              id={id + "item"}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className={controlClass}
            >
              <option value="">Select an item</option>
              {inventoryRooms.map((room) => {
                const items = catalog.filter((c) => c.room === room);
                return items.length ? (
                  <optgroup key={room} label={room}>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (~{item.cubicFeet} cu ft)
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id + "quantity"}>Quantity</Label>
            <Input
              id={id + "quantity"}
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="min-h-11 md:text-base"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={addCatalog}
          >
            Add item
          </Button>
        </div>
      </fieldset>

      <details className="rounded-lg border p-4">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold">
          Item not listed? Describe it
        </summary>
        <fieldset
          className="mt-3 grid gap-3 sm:grid-cols-2"
          disabled={disabled}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={id + "label"}>Item name</Label>
            <Input
              id={id + "label"}
              maxLength={inventoryLimits.label}
              value={custom.label}
              onChange={(e) => setCustom({ ...custom, label: e.target.value })}
              className="min-h-11 md:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id + "room"}>Room</Label>
            <select
              id={id + "room"}
              value={custom.room}
              onChange={(e) =>
                setCustom({ ...custom, room: e.target.value as InventoryRoom })
              }
              className={controlClass}
            >
              {inventoryRooms.map((room) => (
                <option key={room}>{room}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id + "size"}>Approximate size (cu ft)</Label>
            <Input
              id={id + "size"}
              type="number"
              min={0.5}
              max={inventoryLimits.customCubicFeet}
              step={0.5}
              inputMode="decimal"
              aria-describedby={id + "size-hint"}
              value={custom.cubicFeet}
              onChange={(e) =>
                setCustom({ ...custom, cubicFeet: e.target.value })
              }
              className="min-h-11 md:text-base"
            />
            <p id={id + "size-hint"} className="text-xs text-muted-foreground">
              A medium moving box is about 3 cu ft; an armchair about 20.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id + "weight"}>
              Approximate weight (lb, optional)
            </Label>
            <Input
              id={id + "weight"}
              type="number"
              min={0}
              max={inventoryLimits.customWeightLb}
              inputMode="numeric"
              value={custom.weightLb}
              onChange={(e) =>
                setCustom({ ...custom, weightLb: e.target.value })
              }
              className="min-h-11 md:text-base"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={addCustom}
            >
              Add described item
            </Button>
          </div>
        </fieldset>
      </details>

      <p role="status" className="text-sm">
        {message}
      </p>

      <section aria-labelledby={id + "list"} className="space-y-3">
        <h3 id={id + "list"} className="font-semibold">
          Your inventory
        </h3>
        <InventorySummary lines={lines} />
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items added yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {lines.map((line, index) => (
              <li
                key={(line.catalogId ?? "custom") + index}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{line.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.room} · {line.cubicFeet} cu ft each
                  </p>
                </div>
                <Label htmlFor={`${id}q${index}`} className="sr-only">
                  Quantity of {line.label}
                </Label>
                <Input
                  id={`${id}q${index}`}
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  disabled={disabled}
                  value={line.quantity}
                  onChange={(e) => {
                    const value = Math.trunc(Number(e.target.value));
                    if (!(value >= 1 && value <= 99)) return;
                    const next = [...lines];
                    next[index] = { ...line, quantity: value };
                    onChange(next);
                  }}
                  className="min-h-11 w-20 md:text-base"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={disabled}
                  onClick={() => {
                    onChange(lines.filter((_, i) => i !== index));
                    setMessage(`Removed ${line.label}.`);
                  }}
                >
                  Remove<span className="sr-only"> {line.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
