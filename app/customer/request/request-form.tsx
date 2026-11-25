"use client";
import { useHydrated } from "@/lib/use-hydrated";
import { arrivalWindow, arrivalWindows } from "@/lib/requests/windows";
import { MovePhotos } from "@/components/move-photos";
import { requestPhotos } from "@/lib/photos/actions";
import type { MovePhoto } from "@/lib/photos/data";
import type { DayHint } from "@/lib/requests/windows-data";
import {
  composeAccess,
  moveSizes,
  requestDraftKey,
  splitAccess,
} from "@/lib/requests/details";
import { AddressFields } from "@/components/address-fields";
import {
  addressText,
  addressErrors,
  emptyAddress,
  type Address,
} from "@/lib/requests/address";
import { chicagoToday } from "@/lib/requests/validation";
import { shortReference } from "@/lib/reference";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRequest } from "./actions";
import { inventoryItemsText, validateRequest } from "@/lib/requests/validation";
import {
  ActionLink,
  controlClass,
  FieldError,
  PageHeading,
  Panel,
} from "../customer-ui";
import { formatDate } from "@/lib/format";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogItem, InventoryLine } from "@/lib/requests/inventory";
import { InventoryStep, InventorySummary } from "./inventory-step";

const fields = [
  {
    id: "pickup",
    label: "Pickup address",
    step: 0,
    hint: "Street, city, state, ZIP.",
  },
  {
    id: "destination",
    label: "Destination address",
    step: 0,
    hint: "Street, city, state, ZIP.",
  },
  {
    id: "requestedDate",
    label: "Preferred move date",
    step: 0,
    hint: "A requested date, not a confirmed appointment.",
  },
  { id: "property", label: "Property type", step: 1 },
  {
    id: "size",
    label: "Move size",
    step: 1,
  },
  {
    id: "items",
    label: "Items to move",
    step: 1,
    hint: "List furniture, approximate box counts, and any specialty items.",
  },
  {
    id: "access",
    label: "Stairs, elevator & access",
    step: 1,
    hint: "Stairs or floor, elevator, parking distance and any restrictions. Write ‘None’ if there is nothing to note.",
  },
  { id: "notes", label: "Additional notes (optional)", step: 1 },
] as const;
type Field = (typeof fields)[number]["id"];
type Draft = Record<Field, string>;
const emptyDraft: Draft = {
  pickup: "",
  destination: "",
  requestedDate: "",
  property: "",
  size: "",
  items: "",
  access: "",
  notes: "",
};

type FormProps = {
  initialAddresses?: { pickup: Address; destination: Address };
  /** Present only when the inventory feature is available. */
  catalog?: CatalogItem[];
  initialInventory?: InventoryLine[];
  structured?: boolean;
  initial?: Draft;
  edit?: { id: string; revision: number };
  /** Offer arrival windows (Phase 8D, when available) and the saved choice. */
  windows?: boolean;
  initialWindow?: string | null;
  /** Offer photo uploads right after saving a new request (Phase 8D). */
  photos?: boolean;
  /** Busy-day hints for the next weeks (Phase 8E), when available. */
  dayHints?: DayHint[];
};

/** What a new request keeps in this tab's sessionStorage across a refresh. */
type SavedDraft = {
  draft: Draft;
  pickup: Address;
  destination: Address;
  inventory: InventoryLine[];
  step: number;
  window?: string;
};

function readSavedDraft(): SavedDraft | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(requestDraftKey) ?? "null");
    return saved &&
      typeof saved === "object" &&
      saved.draft &&
      saved.pickup &&
      saved.destination &&
      Array.isArray(saved.inventory) &&
      Number.isInteger(saved.step)
      ? { ...saved, draft: { ...emptyDraft, ...saved.draft } }
      : null;
  } catch {
    return null;
  }
}

/**
 * New requests reopen with the tab's saved draft. The form remounts once after
 * hydration so the server and first client render still match.
 */
export default function RequestPage(props: FormProps) {
  const hydrated = useHydrated();
  const saved = useMemo(
    () => (hydrated && !props.edit ? readSavedDraft() : null),
    [hydrated, props.edit],
  );
  return (
    <RequestForm
      {...props}
      saved={saved}
      client={hydrated}
      key={hydrated ? "client" : "server"}
    />
  );
}

function RequestForm({
  structured = false,
  initial,
  edit,
  initialAddresses,
  catalog,
  initialInventory,
  saved,
  client,
  windows = false,
  initialWindow,
  photos = false,
  dayHints,
}: FormProps & { saved: SavedDraft | null; client: boolean }) {
  const hydrated = useHydrated();
  // The optional inventory step appears only when the catalog is available.
  const steps = catalog
    ? ["Route & date", "Move details", "Inventory", "Review"]
    : ["Route & date", "Move details", "Review"];
  const inventoryStep = catalog ? 2 : -1;
  const review = steps.length - 1;
  // "" means no preference.
  const [preferredWindow, setPreferredWindow] = useState(
    saved?.window ?? initialWindow ?? "",
  );
  const [inventory, setInventory] = useState<InventoryLine[]>(
    saved?.inventory ?? initialInventory ?? [],
  );
  const [warning, setWarning] = useState("");
  const requestId = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(
    saved?.draft ?? initial ?? emptyDraft,
  );
  // Access is asked per address and saved as two labelled lines.
  const [access, setAccess] = useState(() => splitAccess(draft.access));
  const [pickupAddress, setPickup] = useState<Address>(
      saved?.pickup ?? initialAddresses?.pickup ?? emptyAddress,
    ),
    [destinationAddress, setDestination] = useState<Address>(
      saved?.destination ?? initialAddresses?.destination ?? emptyAddress,
    );
  const [addressInvalid, setAddressInvalid] = useState(false);
  const [step, setStep] = useState(
    saved && saved.step >= 0 && saved.step < steps.length ? saved.step : 0,
  );
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [createdId, setCreatedId] = useState("");
  const [savedPhotos, setSavedPhotos] = useState<MovePhoto[] | null>([]);
  const submitted = useRef(false);
  const [mutationError, setMutationError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const previousCreated = useRef(createdId);
  useEffect(() => {
    if (previousStep.current !== step || previousCreated.current !== createdId)
      heading.current?.focus();
    previousStep.current = step;
    previousCreated.current = createdId;
  }, [step, createdId]);

  // Keep a new request's progress in this tab only; cleared after saving,
  // on sign-out and when the tab closes. Edits always start from the record.
  useEffect(() => {
    // The pre-hydration form must not overwrite the draft it is about to restore.
    if (!client || edit || createdId) return;
    sessionStorage.setItem(
      requestDraftKey,
      JSON.stringify({
        draft,
        pickup: pickupAddress,
        destination: destinationAddress,
        inventory,
        step,
        window: preferredWindow,
      } satisfies SavedDraft),
    );
  }, [
    client,
    edit,
    createdId,
    draft,
    pickupAddress,
    destinationAddress,
    inventory,
    step,
    preferredWindow,
  ]);
  // Items may be described in the inventory step instead: optional until
  // review, then required only if the inventory list is empty.
  const itemsOptional = catalog ? step < review || inventory.length > 0 : false;
  function validate(all: boolean) {
    const checked = validateRequest(draft, undefined, { itemsOptional });
    if (checked.errors.items && catalog && draft.items.trim() === "")
      checked.errors.items =
        "Describe your items here or list them in the inventory step.";
    if (
      (all || step === 1) &&
      !checked.errors.access &&
      (!access.pickup.trim() || !access.destination.trim())
    )
      checked.errors.access =
        "Describe access at both addresses. Write ‘None’ if there is nothing to note.";
    if (structured && (all || step === 0)) {
      const p = addressErrors(pickupAddress),
        d = addressErrors(destinationAddress);
      setAddressInvalid(true);
      const bad = Object.keys(p)[0] ?? Object.keys(d)[0];
      if (bad) {
        setStep(0);
        requestAnimationFrame(() =>
          document
            .getElementById(
              `${Object.keys(p).length ? "Pickup" : "Destination"}-${bad}`,
            )
            ?.focus(),
        );
        return false;
      }
    }
    const next = Object.fromEntries(
      Object.entries(checked.errors).filter(
        ([key]) =>
          all || fields.find((field) => field.id === key)?.step === step,
      ),
    ) as Partial<Record<Field, string>>;
    setErrors(next);
    const first = fields.find((field) => next[field.id]);
    if (first) {
      setStep(first.step);
      // For access, focus the address answer that is still empty.
      const focusId =
        first.id === "access" && access.pickup.trim()
          ? "accessDestination"
          : first.id;
      requestAnimationFrame(() => document.getElementById(focusId)?.focus());
      return false;
    }
    return true;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || !validate(step === review)) return;
    if (step < review) {
      setStep(step + 1);
      return;
    }
    submitted.current = true;
    setMutationError("");
    startTransition(async () => {
      const result = await createRequest(
        {
          ...draft,
          _requestId: (requestId.current ??= crypto.randomUUID()),
          ...(structured ? { pickupAddress, destinationAddress } : {}),
          ...(catalog ? { inventory } : {}),
          ...(windows ? { preferredWindow } : {}),
        },
        edit,
      ).catch(() => ({
        id: undefined,
        errors: undefined,
        message:
          "We could not confirm the save. Check My moves before trying again to avoid a duplicate request.",
      }));
      if (result.id) {
        if (!edit) sessionStorage.removeItem(requestDraftKey);
        setWarning("warning" in result ? (result.warning ?? "") : "");
        setCreatedId(result.id);
      } else {
        submitted.current = false;
        setMutationError(result.message);
        if (result.errors) {
          setErrors(result.errors);
          const first = fields.find((field) => result.errors?.[field.id]);
          if (first) {
            setStep(first.step);
            requestAnimationFrame(() =>
              document.getElementById(first.id)?.focus(),
            );
          }
        }
      }
    });
  }

  if (createdId)
    return (
      <>
        <h1
          ref={heading}
          tabIndex={-1}
          className="mb-5 text-2xl font-semibold outline-none"
        >
          Request saved
        </h1>
        <Panel>
          <p role="status">
            Your request is saved to your account and will remain after refresh.
            No appointment or team has been assigned.
          </p>
          <p className="text-sm text-muted-foreground">
            #{shortReference(createdId)} · Requested date:{" "}
            {formatDate(draft.requestedDate)}. No appointment or team has been
            assigned.
          </p>
          {warning && (
            <p role="alert" className="text-sm text-warning">
              {warning}
            </p>
          )}
          <ActionLink href={`/customer/moves/${createdId}`}>
            View request
          </ActionLink>
          <ActionLink href="/customer/moves" outline>
            My moves
          </ActionLink>
        </Panel>
        {photos && !edit && (
          <div className="mt-5 max-w-3xl">
            <MovePhotos
              photos={savedPhotos}
              requestId={createdId}
              uploadStages={["request"]}
              description="Optional: add photos of large or fragile items and tight spaces. They help us price your move. You can also add them later from your move page."
              onChange={() =>
                void requestPhotos(createdId)
                  .catch(() => null)
                  .then(setSavedPhotos)
              }
            />
          </div>
        )}
      </>
    );

  return (
    <>
      <PageHeading
        title={edit ? "Edit move request" : "Request a move"}
        description="Enter the route, preferred date and moving details."
      />
      {edit && (
        <p className="mb-5 rounded-2xl bg-muted px-4 py-3 text-sm leading-6 text-foreground/80">
          You can edit or cancel until we publish your estimate. After that,
          message support for changes.
        </p>
      )}
      <ol aria-label="Request steps" className="mb-6 flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full border py-1 pr-4 pl-1.5 text-sm",
              step === index
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "bg-background text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs font-semibold",
                step === index
                  ? "bg-primary-foreground text-primary"
                  : index < step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
              )}
            >
              {index < step ? <Check className="size-3.5" /> : index + 1}
            </span>
            {label}
            {index < step && <span className="sr-only"> (done)</span>}
          </li>
        ))}
      </ol>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="min-w-0">
          <div>
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-[17px] font-semibold outline-none"
            >
              {steps[step]}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Step {step + 1} of {steps.length}
              {!edit && " · your draft is kept in this tab until you save."}
            </p>
          </div>
          <form noValidate onSubmit={submit} className="space-y-5">
            {structured && step === 0 && (
              <div className="space-y-6">
                <AddressFields
                  disabled={!hydrated || pending}
                  label="Pickup"
                  value={pickupAddress}
                  onChange={(a) => {
                    setPickup(a);
                    setDraft({ ...draft, pickup: addressText(a) });
                  }}
                  errors={
                    addressInvalid ? addressErrors(pickupAddress) : undefined
                  }
                />
                <AddressFields
                  disabled={!hydrated || pending}
                  label="Destination"
                  value={destinationAddress}
                  onChange={(a) => {
                    setDestination(a);
                    setDraft({ ...draft, destination: addressText(a) });
                  }}
                  errors={
                    addressInvalid
                      ? addressErrors(destinationAddress)
                      : undefined
                  }
                />
              </div>
            )}
            {step === inventoryStep && catalog ? (
              <InventoryStep
                catalog={catalog}
                lines={inventory}
                onChange={setInventory}
                disabled={!hydrated || pending}
              />
            ) : step < review ? (
              fields
                .filter(
                  (field) =>
                    field.step === step &&
                    !(
                      structured && ["pickup", "destination"].includes(field.id)
                    ),
                )
                .map((field) => {
                  const hint =
                    field.id === "items" && catalog
                      ? "Optional if you list furniture in the next step. Note boxes and specialty items here."
                      : "hint" in field
                        ? field.hint
                        : undefined;
                  const common = {
                    id: field.id,
                    value: draft[field.id],
                    disabled: !hydrated || pending,
                    required: field.id !== "notes",
                    "aria-invalid": Boolean(errors[field.id]),
                    "aria-describedby":
                      [
                        hint ? `${field.id}-hint` : "",
                        errors[field.id] ? `${field.id}-error` : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined,
                    onChange: (
                      event: React.ChangeEvent<
                        | HTMLInputElement
                        | HTMLTextAreaElement
                        | HTMLSelectElement
                      >,
                    ) => {
                      setDraft({ ...draft, [field.id]: event.target.value });
                      setErrors({ ...errors, [field.id]: undefined });
                    },
                  };
                  if (field.id === "access")
                    return (
                      <fieldset
                        key={field.id}
                        className="space-y-3"
                        aria-describedby={common["aria-describedby"]}
                      >
                        <legend className="text-sm font-medium">
                          {field.label}
                        </legend>
                        {(["pickup", "destination"] as const).map((place) => (
                          <div key={place} className="space-y-2">
                            <Label
                              htmlFor={
                                place === "pickup"
                                  ? "access"
                                  : "accessDestination"
                              }
                            >
                              {place === "pickup"
                                ? "Pickup access"
                                : "Destination access"}
                            </Label>
                            <textarea
                              id={
                                place === "pickup"
                                  ? "access"
                                  : "accessDestination"
                              }
                              value={access[place]}
                              disabled={common.disabled}
                              required
                              rows={2}
                              maxLength={900}
                              aria-invalid={common["aria-invalid"]}
                              className={controlClass}
                              onChange={(event) => {
                                const next = {
                                  ...access,
                                  [place]: event.target.value,
                                };
                                setAccess(next);
                                setDraft({
                                  ...draft,
                                  access: composeAccess(
                                    next.pickup,
                                    next.destination,
                                  ),
                                });
                                setErrors({ ...errors, access: undefined });
                              }}
                            />
                          </div>
                        ))}
                        {hint && (
                          <p
                            id={`${field.id}-hint`}
                            className="text-xs leading-5 text-muted-foreground"
                          >
                            {hint}
                          </p>
                        )}
                        <FieldError id={field.id} message={errors[field.id]} />
                      </fieldset>
                    );
                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>
                        {field.id === "items" && catalog
                          ? "Items to move (optional)"
                          : field.label}
                      </Label>
                      {field.id === "size" ? (
                        <select {...common} className={controlClass}>
                          <option value="">Select move size</option>
                          {/* Older free-text sizes stay selectable when editing. */}
                          {[
                            ...moveSizes,
                            ...(draft.size &&
                            !(moveSizes as readonly string[]).includes(
                              draft.size,
                            )
                              ? [draft.size]
                              : []),
                          ].map((size) => (
                            <option key={size}>{size}</option>
                          ))}
                        </select>
                      ) : field.id === "property" ? (
                        <select {...common} className={controlClass}>
                          <option value="">Select property type</option>
                          {["House", "Apartment", "Townhouse", "Other"].map(
                            (type) => (
                              <option key={type}>{type}</option>
                            ),
                          )}
                        </select>
                      ) : ["items", "access", "notes"].includes(field.id) ? (
                        <textarea
                          {...common}
                          rows={3}
                          className={controlClass}
                          maxLength={2000}
                        />
                      ) : (
                        <Input
                          {...common}
                          type={field.id === "requestedDate" ? "date" : "text"}
                          min={
                            field.id === "requestedDate"
                              ? chicagoToday()
                              : undefined
                          }
                          className="min-h-11 md:text-base"
                          maxLength={2000}
                        />
                      )}
                      {hint && (
                        <p
                          id={`${field.id}-hint`}
                          className="text-xs leading-5 text-muted-foreground"
                        >
                          {hint}
                        </p>
                      )}
                      <FieldError id={field.id} message={errors[field.id]} />
                      {field.id === "requestedDate" && dayHints && (
                        <DateHint
                          hints={dayHints}
                          date={draft.requestedDate}
                          disabled={!hydrated || pending}
                          onPick={(day) => {
                            setDraft({ ...draft, requestedDate: day });
                            setErrors({ ...errors, requestedDate: undefined });
                          }}
                        />
                      )}
                    </div>
                  );
                })
            ) : (
              <>
                <dl className="space-y-4 break-words">
                  {fields.map((field) => (
                    <div key={field.id}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {field.id === "requestedDate"
                          ? formatDate(draft.requestedDate)
                          : draft[field.id].trim() ||
                            (field.id === "items"
                              ? inventoryItemsText
                              : "No additional notes.")}
                      </dd>
                    </div>
                  ))}
                </dl>
                {windows && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                      Preferred arrival window
                    </h3>
                    <p className="mt-1 text-sm leading-6">
                      {arrivalWindow(preferredWindow)?.label ?? "No preference"}
                    </p>
                  </div>
                )}
                {catalog && (
                  <div className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                      Inventory
                    </h3>
                    {inventory.length ? (
                      <>
                        <InventorySummary lines={inventory} />
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {inventory.map((line, index) => (
                            <li key={index} className="break-words">
                              {line.quantity} × {line.label}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-sm">No inventory listed.</p>
                    )}
                  </div>
                )}
                <p className="rounded-lg bg-warning-surface p-4 text-sm leading-6 text-warning">
                  Review these details before creating the request. Your
                  preferred date is not a booking. Scheduling and assignments
                  require admin confirmation. This request will be saved to your
                  account.
                </p>
              </>
            )}
            {windows && step === 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Preferred arrival window (optional)
                </legend>
                <p
                  id="window-hint"
                  className="text-xs leading-5 text-muted-foreground"
                >
                  When you would like the crew to arrive. We confirm the exact
                  window when scheduling.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {[...arrivalWindows, { key: "", label: "No preference" }].map(
                    (option) => {
                      // "Morning (8–10 a.m.)" shows as a name and a time line;
                      // the radio keeps the full label as its accessible name.
                      const [, name = option.label, time = "Any time"] =
                        /^(.*) \((.*)\)$/.exec(option.label) ?? [];
                      return (
                        <label
                          key={option.key || "none"}
                          className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-[14px] border p-3.5 has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring has-disabled:cursor-not-allowed has-disabled:opacity-60"
                        >
                          <span className="flex items-center gap-2.5 text-sm font-medium">
                            <input
                              type="radio"
                              name="preferred-window"
                              value={option.key}
                              aria-label={option.label}
                              aria-describedby="window-hint"
                              checked={preferredWindow === option.key}
                              disabled={!hydrated || pending}
                              onChange={() => setPreferredWindow(option.key)}
                              className="size-4 accent-primary outline-none"
                            />
                            {name}
                          </span>
                          <span className="pl-6.5 text-[13px] text-muted-foreground">
                            {time}
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>
              </fieldset>
            )}
            <p role="status" className="text-sm text-destructive">
              {Object.values(errors).some(Boolean)
                ? "Please correct the highlighted fields."
                : mutationError}
            </p>
            {mutationError && (
              <ActionLink href="/customer/moves" outline>
                Check My moves
              </ActionLink>
            )}
            <div className="flex flex-wrap gap-3">
              {step > 0 && (
                <Button
                  type="button"
                  disabled={!hydrated || pending}
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={!hydrated || pending}
                className="min-h-11"
              >
                {pending
                  ? "Saving…"
                  : step === review
                    ? edit
                      ? "Save request changes"
                      : "Create request"
                    : "Next"}
              </Button>
            </div>
          </form>
        </Panel>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-3">
            <h2 className="text-[17px] font-semibold">What happens next</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground/80">
              <li>We review your request and send an itemized estimate.</li>
              <li>Accept it to book the proposed time, or ask for changes.</li>
              <li>Follow your crew and chat with them on move day.</li>
            </ol>
          </Panel>
          <Panel>
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">
                Free to request.
              </span>{" "}
              Estimates aren&apos;t binding and no payment is collected.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

const hintText = {
  open: "Crews are available that day.",
  limited: "Only a few crews are left that day.",
  full: "That day looks fully booked. You can still ask for it, or pick an open date.",
} as const;

/** Availability for the chosen date plus up to three nearby open dates. */
function DateHint({
  hints,
  date,
  disabled,
  onPick,
}: {
  hints: DayHint[];
  date: string;
  disabled: boolean;
  onPick: (day: string) => void;
}) {
  const chosen = hints.find((hint) => hint.day === date);
  const open = hints
    .filter((hint) => hint.status === "open" && hint.day > (date || ""))
    .slice(0, 3);
  if (!chosen && !open.length) return null;
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {chosen && (
        <p
          className={
            chosen.status === "open" ? "text-muted-foreground" : "text-warning"
          }
        >
          {hintText[chosen.status]}
        </p>
      )}
      {chosen?.status !== "open" && open.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Open dates:</span>
          {open.map((hint) => (
            <Button
              key={hint.day}
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={disabled}
              onClick={() => onPick(hint.day)}
            >
              {formatDate(hint.day)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
