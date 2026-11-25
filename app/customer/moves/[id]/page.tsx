import { NotificationReceipt } from "@/components/notifications/receipt";
import { workflowReady } from "@/lib/workflow/data";
import { WorkflowAction } from "@/components/workflow-action";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { MoveDetails } from "./move-details";
import { inventoryReady, loadRequestInventory } from "@/lib/inventory/data";
import { MovePhotos } from "@/components/move-photos";
import { loadPhotos, photosReady } from "@/lib/photos/data";
import { ActionLink, PageHeading, Panel } from "../../customer-ui";

export default async function MoveDetailsPage({
  params,
}: PageProps<"/customer/moves/[id]">) {
  const { id } = await params;
  const result = await estimateWorkspace("customer", { requestId: id });
  if (result.error)
    return (
      <>
        <PageHeading
          title="Request unavailable"
          description="Your saved move requests."
        />
        <Panel>
          <p role="alert">
            The request could not be loaded. Try refreshing the page.
          </p>
          <ActionLink href="/customer/moves" outline>
            Back to my moves
          </ActionLink>
        </Panel>
      </>
    );
  if (!result.data.moves.some((move) => move.id === id)) notFound();
  const inventory = (await inventoryReady())
    ? await loadRequestInventory(id)
    : undefined;
  // Same rule as editing: photos can be added until an estimate exists.
  const editable =
    result.data.moves.find((m) => m.id === id)?.stage === "requested" &&
    !result.data.history.some((e) => e.entity === "estimate");
  const photos = (await photosReady()) ? await loadPhotos(id) : undefined;
  const move = result.data.moves.find((m) => m.id === id)!;
  return (
    <>
      <NotificationReceipt />
      <MoveDetails
        savedMove={move}
        savedEstimate={result.data.estimates.find((e) => e.moveId === id)}
        inventory={inventory}
        actions={
          (await workflowReady()) && (
            <>
              {editable && (
                <ActionLink href={`/customer/moves/${id}/edit`} outline>
                  Edit request
                </ActionLink>
              )}
              <WorkflowAction
                available={editable}
                kind="cancel-request"
                id={id}
                revision={move.revision ?? 1}
              />
            </>
          )
        }
        photos={
          photos !== undefined && (
            <MovePhotos
              photos={photos}
              requestId={id}
              uploadStages={editable ? ["request"] : []}
              description={
                editable
                  ? "Add up to 10 photos of rooms or large and fragile items to help us plan."
                  : "Photos from your request and the crew's pickup and delivery condition checks."
              }
            />
          )
        }
      />
    </>
  );
}

export const metadata: Metadata = { title: "Move details" };
