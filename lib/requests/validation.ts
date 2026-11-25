export const requestFields = [
  "pickup",
  "destination",
  "requestedDate",
  "property",
  "size",
  "items",
  "access",
  "notes",
] as const;
export type RequestField = (typeof requestFields)[number];
export type RequestDraft = Record<RequestField, string>;
export type RequestErrors = Partial<Record<RequestField, string>>;

export function chicagoToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Stored when the customer lists everything in the inventory step instead. */
export const inventoryItemsText = "Listed in inventory.";

/**
 * `itemsOptional` is true only when the customer listed inventory lines (or,
 * in the form, before the inventory step is reached). An empty description is
 * then stored as "Listed in inventory." so the database check still holds.
 */
export function validateRequest(
  input: unknown,
  today = chicagoToday(),
  { itemsOptional = false } = {},
) {
  const source = input && typeof input === "object" ? input : {};
  const draft: RequestDraft = {
    pickup: "",
    destination: "",
    requestedDate: "",
    property: "",
    size: "",
    items: "",
    access: "",
    notes: "",
  };
  const errors: RequestErrors = {};
  for (const field of requestFields) {
    const value = Reflect.get(source, field);
    if (typeof value !== "string") {
      errors[field] = "Enter valid text.";
      continue;
    }
    draft[field] = value.trim();
    if (field === "items" && itemsOptional && !draft.items)
      draft.items = inventoryItemsText;
    if (field !== "notes" && !draft[field])
      errors[field] = "Complete this field.";
    if (draft[field].length > 2000)
      errors[field] = "Keep this field under 2,000 characters.";
  }
  if (
    draft.pickup &&
    draft.pickup.toLowerCase() === draft.destination.toLowerCase()
  )
    errors.destination = "Use a different destination address.";
  if (
    draft.property &&
    !["House", "Apartment", "Townhouse", "Other"].includes(draft.property)
  )
    errors.property = "Select a property type.";
  const date = new Date(`${draft.requestedDate}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.requestedDate) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.requestedDate ||
    draft.requestedDate < today
  )
    errors.requestedDate =
      "Choose a valid date of today or later (Central Time).";
  return { draft, errors, valid: Object.keys(errors).length === 0 };
}
