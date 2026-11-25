import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { workflowReady } from "@/lib/workflow/data";
import RequestForm from "@/app/customer/request/request-form";
import { arrivalWindowsReady, loadDayHints } from "@/lib/requests/windows-data";
import { RecordsUnavailable } from "@/components/records-unavailable";
import {
  inventoryReady,
  loadCatalog,
  loadRequestInventory,
} from "@/lib/inventory/data";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await estimateWorkspace("customer", { requestId: id });
  if (result.error || result.partial) return <RecordsUnavailable />;
  const move = result.data.moves[0];
  if (
    !(await workflowReady()) ||
    !move ||
    move.stage !== "requested" ||
    result.data.history.some((e) => e.entity === "estimate")
  )
    notFound();
  // Editing must start from the saved list; if either part fails to load,
  // hide the inventory step rather than risk replacing it with an empty list.
  const ready = await inventoryReady();
  const [catalog, inventory] = ready
    ? await Promise.all([loadCatalog(), loadRequestInventory(id)])
    : [null, null];
  const withInventory = catalog && inventory;
  return (
    <RequestForm
      catalog={withInventory ? catalog : undefined}
      initialInventory={
        withInventory
          ? // Items retired from the catalog keep their saved sizes as described items.
            inventory.map((line) =>
              catalog.some((item) => item.id === line.catalogId)
                ? line
                : { ...line, catalogId: null },
            )
          : undefined
      }
      structured={!!move.pickupAddress && !!move.destinationAddress}
      initialAddresses={
        move.pickupAddress && move.destinationAddress
          ? { pickup: move.pickupAddress, destination: move.destinationAddress }
          : undefined
      }
      initial={{
        pickup: move.pickup,
        destination: move.destination,
        requestedDate: move.requestedDate,
        property: move.property,
        size: move.size,
        items: move.items,
        access: move.access,
        notes: move.notes,
      }}
      edit={{ id, revision: move.revision ?? 1 }}
      windows={await arrivalWindowsReady()}
      dayHints={(await loadDayHints()) ?? undefined}
      initialWindow={move.preferredWindow}
    />
  );
}
export const metadata: Metadata = { title: "Edit request" };
