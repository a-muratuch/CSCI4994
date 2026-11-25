import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusDefinitions, type Status } from "@/lib/domain/status";
const tones = {
  neutral: "bg-muted text-foreground",
  warning: "bg-warning-surface text-warning",
  success: "bg-success-surface text-success",
};
export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto min-h-6 max-w-full rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-normal",
        tones[statusDefinitions[status].tone],
      )}
    >
      {statusDefinitions[status].label}
    </Badge>
  );
}
