import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { NewEstimate } from "./new-estimate";
import { loadSuggestionInput } from "@/lib/inventory/data";
import { loadEstimateDefaults } from "@/lib/estimates/defaults";

export default async function Page({
  params,
}: PageProps<"/admin/requests/[id]/estimate">) {
  const { id } = await params;
  const result = await estimateWorkspace("admin", { requestId: id });
  if (result.error) return <RecordsUnavailable title="Records unavailable" />;
  if (result.partial)
    return <RecordsUnavailable title="Record needs review" partial />;
  const move = result.data.moves.find((m) => m.id === id);
  if (!move) notFound();
  const [suggestion, defaults] = await Promise.all([
    loadSuggestionInput(move),
    loadEstimateDefaults(),
  ]);
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      <NewEstimate
        data={result.data}
        id={id}
        suggestion={suggestion ?? undefined}
        defaults={defaults ?? undefined}
      />
    </>
  );
}

export const metadata: Metadata = { title: "Prepare estimate" };
