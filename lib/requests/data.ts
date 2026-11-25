import { storedAddress } from "./address";
import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import { chicagoToday } from "./validation";
import type { MoveView } from "@/lib/domain";

type RequestRow = Database["public"]["Tables"]["move_requests"]["Row"] & {
  reference_number?: number;
  revision?: number;
  status?: string;
};
export function requestMove(row: RequestRow): MoveView {
  return {
    id: row.id,
    referenceNumber: row.reference_number,
    customerId: row.customer_id,
    revision: row.revision,
    pickupAddress: storedAddress(row.pickup_address),
    destinationAddress: storedAddress(row.destination_address),
    requestStatus: row.status === "cancelled" ? "cancelled" : "pending",
    pickup: row.pickup,
    destination: row.destination,
    requestedDate: row.requested_date,
    property: row.property_type,
    size: row.move_size,
    items: row.items,
    access: row.access_details,
    notes: row.notes,
    preferredWindow:
      "preferred_window" in row ? (row.preferred_window ?? null) : null,
    stage: row.status === "cancelled" ? "cancelled" : "requested",
    history: [
      {
        id: row.id,
        entity: "request",
        recordId: row.id,
        label: "Request saved",
        date: chicagoToday(new Date(row.created_at)),
        detail: "Saved to your account.",
      },
    ],
  };
}
