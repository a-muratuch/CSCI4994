import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { MovesList } from "./moves-list";
import { ActionLink, PageHeading, Panel } from "../customer-ui";

export default async function MovesPage() {
  const result = await estimateWorkspace("customer");
  if (result.error)
    return (
      <>
        <PageHeading title="My moves" description="Your saved move requests." />
        <Panel>
          <p role="alert">
            Your saved requests could not be loaded. Try refreshing the page.
          </p>
          <ActionLink href="/customer/request">Request a move</ActionLink>
        </Panel>
      </>
    );
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      <MovesList moves={result.data.moves} estimates={result.data.estimates} />
    </>
  );
}

export const metadata: Metadata = { title: "My moves" };
