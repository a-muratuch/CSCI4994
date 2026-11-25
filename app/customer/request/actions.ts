"use server";
import type { ActionResult } from "@/lib/action-result";
import { isUuid } from "@/lib/ids";
import {
  addressErrors,
  addressText,
  type Address,
} from "@/lib/requests/address";
import { administrationReady } from "@/lib/administration/data";
import { workflowReady } from "@/lib/workflow/data";
import { inventoryReady } from "@/lib/inventory/data";
import { arrivalWindow } from "@/lib/requests/windows";
import { arrivalWindowsReady } from "@/lib/requests/windows-data";
import { validateInventory } from "@/lib/requests/inventory";
import { logFailure } from "@/lib/server-log";

import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { validateRequest, type RequestErrors } from "@/lib/requests/validation";

export async function createRequest(
  input: unknown,
  edit?: { id: string; revision: number },
): Promise<
  ActionResult<{
    id?: string;
    errors?: RequestErrors;
    message: string;
    warning?: string;
  }>
> {
  // The item description may be left empty only when inventory lines are
  // sent and the inventory feature is available to save them.
  const inventoryLines =
    input && typeof input === "object"
      ? Reflect.get(input, "inventory")
      : undefined;
  const itemsOptional =
    Array.isArray(inventoryLines) &&
    inventoryLines.length > 0 &&
    (await inventoryReady().catch(() => false));
  const validated = validateRequest(input, undefined, { itemsOptional });
  if (!validated.valid)
    return {
      ok: false,
      errors: validated.errors,
      message: "Please correct the highlighted fields.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (!account || account.role !== "customer")
      return {
        ok: false,
        message: "Sign in with a customer account before creating a request.",
      };
    const d = validated.draft;
    if (
      edit &&
      (!isUuid(edit.id) ||
        !Number.isSafeInteger(edit.revision) ||
        edit.revision < 1)
    )
      return { ok: false, message: "Reopen the request before editing." };
    const structured =
      typeof input === "object" && input
        ? (input as Record<string, unknown>)
        : {};
    const addresses: Record<string, Address> = {};
    for (const key of ["pickupAddress", "destinationAddress"]) {
      const value = structured[key];
      if (value && typeof value === "object") {
        const a = value as Address;
        if (
          ![a.street, a.city, a.state, a.zip].every(
            (v) => typeof v === "string",
          ) ||
          Object.keys(addressErrors(a)).length
        )
          return { ok: false, message: "Correct the address fields." };
        addresses[key] = {
          street: a.street.trim(),
          city: a.city.trim(),
          state: a.state.trim().toUpperCase(),
          zip: a.zip.trim(),
        };
      }
    }
    if (await workflowReady()) {
      // Inventory is optional. Check it before saving so a bad list never
      // leaves a half-saved request.
      const inventory =
        structured.inventory !== undefined && (await inventoryReady())
          ? validateInventory(structured.inventory)
          : null;
      if (inventory && "error" in inventory)
        return { ok: false, message: inventory.error };
      // Arrival window (when offered): "" or null clears it; otherwise it
      // must be one of the listed windows.
      const sentWindow = structured.preferredWindow;
      const windowKey =
        sentWindow === undefined || !(await arrivalWindowsReady())
          ? undefined
          : sentWindow === "" || sentWindow === null
            ? null
            : (arrivalWindow(String(sentWindow))?.key ?? false);
      if (windowKey === false)
        return { ok: false, message: "Choose a listed arrival window." };
      if (!edit && Object.keys(addresses).length !== 2)
        return { ok: false, message: "Complete both addresses." };
      if (
        (await administrationReady()) &&
        !edit &&
        !isUuid(structured._requestId)
      )
        return {
          ok: false,
          message: "Reopen the request form before submitting.",
        };
      const value = {
        ...d,
        ...addresses,
        ...(isUuid(structured._requestId)
          ? { _requestId: structured._requestId }
          : {}),
      };
      if (addresses.pickupAddress)
        value.pickup = addressText(addresses.pickupAddress);
      if (addresses.destinationAddress)
        value.destination = addressText(addresses.destinationAddress);
      const { data, error } = await client.rpc("change_request", {
        p_id: (edit?.id ?? null) as unknown as string,
        p_revision: edit?.revision ?? 0,
        p_input: value,
        p_cancel: false,
      });
      if (error || !data) {
        logFailure("requests:change", error);
        return {
          ok: false,
          message:
            error?.hint === "rate_limit"
              ? "Too many requests. Wait ten minutes before creating another."
              : error?.code === "40001"
                ? "The request changed or an estimate was published. Reopen it."
                : "The save could not be confirmed. Check My moves before retrying.",
        };
      }
      // Replacing the inventory is idempotent, so a retry cannot duplicate lines.
      let warning: string | undefined;
      if (inventory) {
        const saved = await client.rpc("set_request_items", {
          p_request_id: data.id,
          p_revision: data.revision,
          p_items: inventory.payload,
        });
        if (saved.error) {
          logFailure("requests:inventory", saved.error);
          warning =
            "Your request was saved, but the inventory list was not. Edit the request to add it again.";
        }
      }
      if (windowKey !== undefined) {
        const saved = await client.rpc("set_request_window", {
          p_request_id: data.id,
          p_revision: data.revision,
          p_window: windowKey as string,
        });
        if (saved.error) {
          logFailure("requests:window", saved.error);
          warning = [
            warning,
            "Your request was saved, but the arrival window was not. Edit the request to choose it again.",
          ]
            .filter(Boolean)
            .join(" ");
        }
      }
      revalidatePath("/customer", "layout");
      revalidatePath("/admin", "layout");
      return {
        ok: true,
        id: data.id,
        message: edit ? "Request updated." : "Request saved.",
        warning,
      };
    }
    if (edit)
      return { ok: false, message: "Request editing is not available yet." };
    // Ownership, ID and creation time come from database defaults, not client input.
    const { data, error } = await client
      .from("move_requests")
      .insert({
        pickup: d.pickup,
        destination: d.destination,
        requested_date: d.requestedDate,
        property_type: d.property,
        move_size: d.size,
        items: d.items,
        access_details: d.access,
        notes: d.notes,
      })
      .select("id")
      .single();
    if (error || !data)
      return {
        ok: false,
        message:
          "We could not confirm the save. Check My moves before trying again to avoid a duplicate request.",
      };
    revalidatePath("/customer/moves");
    revalidatePath("/customer");
    return {
      ok: true,
      id: data.id,
      message:
        "Request saved to your account. Your preferred date is not a confirmed appointment.",
    };
  } catch (error) {
    logFailure("customer:action", error);
    return {
      ok: false,
      message:
        "We could not confirm the save. Check My moves before trying again to avoid a duplicate request.",
    };
  }
}
