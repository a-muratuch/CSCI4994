import { Card } from "@/components/ui/card";
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-6">
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((id) => (
            <Card key={id} className="min-w-0 gap-4 p-4 sm:p-6">
              <div className="h-5 w-1/2 rounded bg-muted" />
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-4 w-full rounded bg-muted" />
              ))}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
