"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { readAccount } from "@/lib/auth/account";
import { isUuid } from "@/lib/ids";
import { logFailure } from "@/lib/server-log";
import { serverSupabase } from "@/lib/supabase/server";
import { inventoryReady } from "./data";
import { schedulingReady } from "@/lib/jobs/schedule-options";
import {
  validateCapacity,
  validateCatalogItem,
  validatePricing,
} from "./validation";

type Result = ActionResult<{ message: string }>;

/** Administrator client after a verified stored-role check. The database checks again. */
async function adminClient() {
  const client = await serverSupabase(true);
  const { account } = await readAccount(client);
  if (account?.role !== "admin" || !(await inventoryReady()))
    throw new Error("Unavailable");
  return client;
}
function refreshed() {
  revalidatePath("/admin", "layout");
}

export async function saveCatalogItem(
  id: unknown,
  value: unknown,
): Promise<Result> {
  const input = validateCatalogItem(value);
  if ((id !== null && !isUuid(id)) || !input)
    return {
      ok: false,
      message:
        "Enter a name, room, size up to 500 cu ft and weight up to 3,000 lb.",
    };
  try {
    const client = await adminClient();
    const { error } = await client.rpc("save_inventory_item", {
      // Generated RPC types omit nullable arguments; SQL accepts null for a new item.
      p_id: id as string,
      p_name: input.name,
      p_room: input.room,
      p_cubic_feet: input.cubicFeet,
      p_weight_lb: input.weightLb,
      p_active: input.active,
    });
    if (error) {
      if (error.code !== "22023") logFailure("inventory:catalog-save", error);
      return {
        ok: false,
        message:
          error.code === "22023"
            ? "Check the values. Item names must be unique within a room."
            : "The item could not be saved.",
      };
    }
    refreshed();
    return { ok: true, message: id ? "Item saved." : "Item added." };
  } catch {
    return { ok: false, message: "Administrator access is required." };
  }
}

export async function savePricing(value: unknown): Promise<Result> {
  const input = validatePricing(value);
  if (!input)
    return {
      ok: false,
      message: "Check each pricing value is within its range.",
    };
  try {
    const client = await adminClient();
    const values = {
      p_worker_hourly_cents: input.workerHourlyCents,
      p_truck_fee_cents: input.truckFeeCents,
      p_cubic_feet_per_worker_hour: input.cubicFeetPerWorkerHour,
      p_minimum_hours: input.minimumHours,
      p_per_mile_cents: input.perMileCents,
      p_travel_mph: input.travelMph,
      p_road_factor: input.roadFactor,
    };
    // The turnaround argument exists only after the Phase 7B migration.
    const scheduling = await schedulingReady();
    if (scheduling && input.turnaroundMinutes === null)
      return { ok: false, message: "Enter the turnaround minutes." };
    const { error } = await client.rpc(
      "save_pricing_settings",
      scheduling
        ? { ...values, p_turnaround_minutes: input.turnaroundMinutes! }
        : (values as typeof values & { p_turnaround_minutes: number }),
    );
    if (error) {
      logFailure("inventory:pricing-save", error);
      return { ok: false, message: "Pricing could not be saved." };
    }
    refreshed();
    return {
      ok: true,
      message: "Pricing saved. New suggestions use these values.",
    };
  } catch {
    return { ok: false, message: "Administrator access is required." };
  }
}

export async function saveTruckCapacity(
  id: unknown,
  value: unknown,
): Promise<Result> {
  const capacity = validateCapacity(value);
  if (!isUuid(id) || capacity === undefined)
    return { ok: false, message: "Enter 50–5,000 cubic feet, or leave blank." };
  try {
    const client = await adminClient();
    const { error } = await client.rpc("set_truck_capacity", {
      p_id: id,
      // Null clears the capacity; generated types omit nullable arguments.
      p_capacity: capacity as number,
    });
    if (error) {
      logFailure("inventory:capacity-save", error);
      return { ok: false, message: "The capacity could not be saved." };
    }
    refreshed();
    return {
      ok: true,
      message: capacity ? "Capacity saved." : "Capacity cleared.",
    };
  } catch {
    return { ok: false, message: "Administrator access is required." };
  }
}
