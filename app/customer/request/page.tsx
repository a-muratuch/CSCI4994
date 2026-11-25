import type { Metadata } from "next";
import RequestForm from "./request-form";
import { workflowReady } from "@/lib/workflow/data";
import { inventoryReady, loadCatalog } from "@/lib/inventory/data";
import { arrivalWindowsReady, loadDayHints } from "@/lib/requests/windows-data";
import { photosReady } from "@/lib/photos/data";
export default async function Page() {
  // If the catalog cannot load, the form still works without the inventory step.
  const catalog = (await inventoryReady()) ? await loadCatalog() : null;
  return (
    <RequestForm
      structured={await workflowReady()}
      catalog={catalog ?? undefined}
      windows={await arrivalWindowsReady()}
      dayHints={(await loadDayHints()) ?? undefined}
      photos={await photosReady()}
    />
  );
}
export const metadata: Metadata = { title: "Request a move" };
