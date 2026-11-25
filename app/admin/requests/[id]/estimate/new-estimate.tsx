import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { moveReference, moveTitle } from "@/lib/reference";
import { formatShortDate } from "@/lib/format";
import { arrivalWindow } from "@/lib/requests/windows";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { EstimateForm } from "../../../estimate-form";
import type { SuggestionInput } from "../../../estimate-suggestion";
import type { EstimateDefaults } from "@/lib/estimates/validation";
import { ActionLink, PageHeading, Panel, linkClass } from "../../../admin-ui";
export function NewEstimate({
  data,
  id,
  suggestion,
  defaults,
}: {
  data: EstimateWorkspace;
  id: string;
  suggestion?: SuggestionInput;
  defaults?: EstimateDefaults;
}) {
  const state = data;
  const request = state.moves.find((r) => r.id === id);
  if (!request) notFound();
  if (request.stage === "cancelled")
    return (
      <Panel>
        <h1 className="text-xl font-semibold">Request cancelled</h1>
        <ActionLink href={`/admin/requests/${id}`}>View request</ActionLink>
      </Panel>
    );
  const existing = state.estimates.find((e) => e.requestId === id);
  if (existing)
    return (
      <Panel>
        <h1 className="text-xl font-semibold">
          This request already has an estimate
        </h1>
        <ActionLink href={"/admin/estimates/" + existing.id}>
          View existing estimate
        </ActionLink>
      </Panel>
    );
  return (
    <>
      <Link
        href={`/admin/requests/${id}`}
        className={cn(linkClass, "mb-2 gap-2")}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Request {moveReference(request.id, request.referenceNumber)}
      </Link>
      <PageHeading
        title="Prepare estimate"
        description="Version 1 · draft not saved yet"
      />
      <EstimateForm
        key={id}
        requestId={id}
        suggestion={suggestion}
        defaults={defaults}
        context={
          <>
            <span className="block font-medium">
              {state.customers.find((c) => c.id === request.customerId)?.name ??
                "Customer"}{" "}
              · {moveReference(request.id, request.referenceNumber)}
            </span>
            <span className="block text-muted-foreground">
              {moveTitle(request)} · {formatShortDate(request.requestedDate)}
            </span>
            {arrivalWindow(request.preferredWindow) && (
              <span className="block text-muted-foreground">
                {arrivalWindow(request.preferredWindow)?.label} requested
              </span>
            )}
          </>
        }
      />
    </>
  );
}
