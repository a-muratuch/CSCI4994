"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MovePhoto } from "@/lib/photos/data";
import {
  maxPhotoBytes,
  photoStages,
  stageLabels,
  type PhotoStage,
} from "@/lib/photos/validation";

/**
 * Photos for one move, grouped by stage. `uploadStages` lists the stages the
 * signed-in account may add to right now; the server checks again on upload.
 */
export function MovePhotos({
  photos,
  requestId,
  jobId,
  uploadStages = [],
  description,
  onChange,
}: {
  photos: MovePhoto[] | null;
  requestId: string;
  jobId?: string;
  uploadStages?: PhotoStage[];
  description: string;
  /** Reload the list after a change; defaults to refreshing the page. */
  onChange?: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<PhotoStage | undefined>(uploadStages[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const reload = () => (onChange ? onChange() : router.refresh());

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file || !stage) {
      setFailed(true);
      setMessage("Choose a photo to upload.");
      return;
    }
    if (file.size > maxPhotoBytes) {
      setFailed(true);
      setMessage("Photos must be 5 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.set("photo", file);
    form.set("requestId", requestId);
    form.set("stage", stage);
    if (stage !== "request" && jobId) form.set("jobId", jobId);
    setBusy(true);
    setMessage("Uploading photo…");
    setFailed(false);
    try {
      const response = await fetch("/api/photos", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { message?: string };
      setFailed(!response.ok);
      setMessage(result.message ?? "The photo could not be saved.");
      if (response.ok) {
        if (input.current) input.current.value = "";
        reload();
      }
    } catch {
      setFailed(true);
      setMessage("The photo could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/photos/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      setFailed(!response.ok);
      setMessage(result.message ?? "The photo could not be removed.");
      if (response.ok) reload();
    } catch {
      setFailed(true);
      setMessage("The photo could not be removed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const canRemove = (photo: MovePhoto) =>
    photo.mine && uploadStages.includes(photo.stage);

  return (
    <Card aria-labelledby="photos-heading" role="region">
      <CardHeader>
        {/* A real heading, so screen-reader users can jump to the photos. */}
        <h2
          id="photos-heading"
          className="font-heading text-lg leading-snug font-medium"
        >
          Photos
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {photos === null ? (
          <p role="alert" className="text-sm">
            Photos could not be loaded. Refresh to try again.
          </p>
        ) : (
          photoStages.map((group) => {
            const shown = photos.filter((photo) => photo.stage === group);
            if (!shown.length && !uploadStages.includes(group)) return null;
            return (
              <section key={group} aria-label={stageLabels[group]}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  {stageLabels[group]} ({shown.length})
                </h3>
                {shown.length ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {shown.map((photo, index) => (
                      <li key={photo.id} className="space-y-1">
                        <a
                          href={`/api/photos/${photo.id}`}
                          target="_blank"
                          rel="noopener"
                          className="block overflow-hidden rounded-md border focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {/* Private, authorized images: no image optimizer or cache. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/photos/${photo.id}`}
                            alt={`${stageLabels[group]} photo ${index + 1}`}
                            loading="lazy"
                            className="aspect-square w-full object-cover"
                          />
                        </a>
                        {canRemove(photo) && (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={busy}
                            onClick={() => remove(photo.id)}
                            aria-label={`Remove ${stageLabels[group].toLowerCase()} photo ${index + 1}`}
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">No photos yet.</p>
                )}
              </section>
            );
          })
        )}
        {photos !== null && !photos.length && !uploadStages.length && (
          <p className="text-sm">No photos yet.</p>
        )}
        {uploadStages.length > 0 && (
          <form onSubmit={upload} className="space-y-3">
            {uploadStages.length > 1 && (
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-1 text-sm font-medium">
                  Photo stage
                </legend>
                {uploadStages.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={option}
                      checked={stage === option}
                      onChange={() => setStage(option)}
                    />
                    {stageLabels[option]}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="space-y-1">
              <label htmlFor="photo-file" className="text-sm font-medium">
                Add a photo
              </label>
              <input
                ref={input}
                id="photo-file"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="photo-help"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
              />
              <p id="photo-help" className="text-xs text-muted-foreground">
                JPEG, PNG or WebP, up to 5 MB.
              </p>
            </div>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Saving…" : "Upload photo"}
            </Button>
          </form>
        )}
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "text-sm text-destructive" : "text-sm"}
        >
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
