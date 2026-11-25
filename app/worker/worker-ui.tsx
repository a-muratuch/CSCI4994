import { RecordsUnavailable } from "@/components/records-unavailable";
export { StatusBadge } from "@/components/status-badge";

export { focusClass, linkClass } from "@/lib/ui";
export { PageHeading as Heading } from "@/components/page-heading";

export const panelClass = "min-w-0 gap-4 break-words p-5 sm:p-6";

export function WorkerLoadError() {
  return <RecordsUnavailable title="Worker records unavailable" />;
}
