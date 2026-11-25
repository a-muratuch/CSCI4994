"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { waiveDeliveryPhoto } from "@/lib/jobs/actions";
import { heroActionClass } from "@/components/hero-panel";

/** Phase 8G: completion needs a delivery photo unless an administrator waives it. */
export function PhotoWaiver({
  jobId,
  waived,
  waiverNote,
  deliveryPhotos,
}: {
  jobId: string;
  waived: boolean;
  waiverNote?: string | null;
  deliveryPhotos: number;
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  return (
    <section
      aria-labelledby="waiver-heading"
      className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6"
    >
      <h2 id="waiver-heading" className="text-[17px] font-semibold">
        Delivery photo
      </h2>
      {waived ? (
        <p className="text-sm">
          Waived by an administrator{waiverNote ? `: ${waiverNote}` : "."} The
          crew can complete the job without a delivery photo.
        </p>
      ) : deliveryPhotos > 0 ? (
        <p className="text-sm">
          {deliveryPhotos} delivery {deliveryPhotos === 1 ? "photo" : "photos"}{" "}
          on file. The crew can complete the job.
        </p>
      ) : (
        <>
          <p className="text-sm leading-6 text-primary-foreground/80">
            The crew must add at least one delivery photo before completing.
            Waive it only when they cannot (for example, a broken phone).
          </p>
          <div className="max-w-md space-y-2">
            <Label htmlFor="waiver-note">Reason (optional)</Label>
            <Input
              id="waiver-note"
              value={note}
              maxLength={200}
              disabled={!hydrated || pending}
              onChange={(event) => setNote(event.target.value)}
              className="bg-background text-foreground"
            />
          </div>
          <Button
            className={`${heroActionClass} w-fit`}
            disabled={!hydrated || pending}
            onClick={() =>
              start(async () => {
                const result = await waiveDeliveryPhoto(jobId, note).catch(
                  () => ({
                    ok: false,
                    message: "The waiver could not be confirmed. Reload.",
                  }),
                );
                setMessage(result.message);
                if (result.ok) router.refresh();
              })
            }
          >
            Waive delivery photo
          </Button>
        </>
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
    </section>
  );
}
