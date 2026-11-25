import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import {
  inventoryRooms,
  type CatalogItem,
  type InventoryLine,
  type InventoryRoom,
} from "@/lib/requests/inventory";
import type {
  PricingSettings,
  SuggestionInput,
  TruckOption,
} from "@/lib/estimates/suggestion";
import { estimateMiles } from "@/lib/distance/zip";

const room = (value: string): InventoryRoom =>
  inventoryRooms.includes(value as InventoryRoom)
    ? (value as InventoryRoom)
    : "Other";
const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "");

// Hide inventory controls until the owner applies the Phase 7A migration.
export const inventoryReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("inventory_capabilities");
  if (error && !missing(error.code))
    logFailure("inventory:capabilities", error);
  return !error && data === 7;
});

/** Catalog for customers (active only) or administrators (all items). */
export async function loadCatalog(includeInactive = false) {
  const client = await serverSupabase();
  let query = client
    .from("inventory_catalog")
    .select("id,name,room,cubic_feet,weight_lb,active")
    .order("room")
    .order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) {
    logFailure("inventory:catalog", error);
    return null;
  }
  return data.map((row): CatalogItem => ({
    id: row.id,
    name: row.name,
    room: room(row.room),
    cubicFeet: Number(row.cubic_feet),
    weightLb: row.weight_lb,
    active: row.active,
  }));
}

/** Inventory saved on one request. RLS limits this to the owner and administrators. */
export async function loadRequestInventory(requestId: string) {
  if (!isUuid(requestId)) return [];
  const client = await serverSupabase();
  const { data, error } = await client
    .from("request_items")
    .select("catalog_id,label,room,quantity,cubic_feet,weight_lb")
    .eq("request_id", requestId)
    .order("position");
  if (error) {
    logFailure("inventory:request", error);
    return null;
  }
  return data.map((row): InventoryLine => ({
    catalogId: row.catalog_id,
    label: row.label,
    room: room(row.room),
    quantity: row.quantity,
    cubicFeet: Number(row.cubic_feet),
    weightLb: row.weight_lb,
  }));
}

/** Pricing inputs (administrators only). */
export async function loadPricing(): Promise<PricingSettings | null> {
  const client = await serverSupabase();
  const { data, error } = await client
    .from("pricing_settings")
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (error) logFailure("inventory:pricing", error);
    return null;
  }
  return {
    workerHourlyCents: data.worker_hourly_cents,
    truckFeeCents: data.truck_fee_cents,
    cubicFeetPerWorkerHour: data.cubic_feet_per_worker_hour,
    minimumHours: Number(data.minimum_hours),
    perMileCents: data.per_mile_cents,
    travelMph: data.travel_mph,
    roadFactor: Number(data.road_factor),
    // Present only after the Phase 7B migration.
    turnaroundMinutes:
      "turnaround_minutes" in data ? data.turnaround_minutes : null,
  };
}

/** Trucks with their capacities (administrators see every truck). */
export async function loadTruckOptions(): Promise<TruckOption[] | null> {
  const client = await serverSupabase();
  const { data, error } = await client
    .from("trucks")
    .select("id,name,active,capacity_cubic_feet")
    .order("name")
    .order("id");
  if (error) {
    logFailure("inventory:trucks", error);
    return null;
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name.trim(),
    active: row.active ?? true,
    capacityCubicFeet: row.capacity_cubic_feet,
  }));
}

/**
 * Everything the estimate suggestion needs for one request, or null when the
 * feature is unavailable or any part fails to load (the form still works).
 */
export async function loadSuggestionInput(move: {
  id: string;
  pickupAddress?: { zip: string };
  destinationAddress?: { zip: string };
}): Promise<SuggestionInput | null> {
  if (!(await inventoryReady())) return null;
  const [lines, settings, trucks] = await Promise.all([
    loadRequestInventory(move.id),
    loadPricing(),
    loadTruckOptions(),
  ]);
  if (!lines || !settings || !trucks) return null;
  return {
    lines,
    settings,
    trucks,
    estimatedMiles: estimateMiles(
      move.pickupAddress?.zip,
      move.destinationAddress?.zip,
      settings.roadFactor,
    ),
  };
}
