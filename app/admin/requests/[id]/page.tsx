import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { RequestDetails } from "./request-details";
import { inventoryReady, loadRequestInventory } from "@/lib/inventory/data";
import { MovePhotos } from "@/components/move-photos";
import { loadPhotos, photosReady } from "@/lib/photos/data";

export default async function Page({
  params,
}: PageProps<"/admin/requests/[id]">) {
  const { id } = await params;
  const result = await estimateWorkspace("admin", { requestId: id });
  if (result.error) return <RecordsUnavailable title="Records unavailable" />;
  if (result.partial)
    return <RecordsUnavailable title="Record needs review" partial />;
  if (!result.data.moves.some((move) => move.id === id)) notFound();
  const inventory = (await inventoryReady())
    ? await loadRequestInventory(id)
    : undefined;
  const photos = (await photosReady()) ? await loadPhotos(id) : undefined;
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      <RequestDetails
        data={result.data}
        id={id}
        inventory={inventory}
        photos={
          photos !== undefined && (
            <MovePhotos
              photos={photos}
              requestId={id}
              description="Customer photos and crew condition photos for this move."
            />
          )
        }
      />
    </>
  );
}

export const metadata: Metadata = { title: "Request details" };
