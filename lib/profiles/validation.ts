export type ContactDetails = { name: string; phone: string };
export type ContactErrors = Partial<Record<keyof ContactDetails, string>>;

export function validateContact(value: unknown): {
  input?: ContactDetails;
  errors: ContactErrors;
} {
  const row =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const phone = typeof row.phone === "string" ? row.phone.trim() : "";
  const errors: ContactErrors = {};
  if (!name || name.length > 100)
    errors.name = "Enter a name between 1 and 100 characters.";
  if (
    phone.length > 30 ||
    !/^[+\d\s().-]+$/.test(phone) ||
    !/^\d{7,15}$/.test(phone.replace(/\D/g, ""))
  ) {
    errors.phone =
      "Enter a phone number with 7–15 digits and at most 30 characters.";
  }
  return Object.keys(errors).length
    ? { errors }
    : { input: { name, phone }, errors };
}
