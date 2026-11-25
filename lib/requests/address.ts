export type Address = {
  street: string;
  city: string;
  state: string;
  zip: string;
};
export const emptyAddress: Address = {
  street: "",
  city: "",
  state: "",
  zip: "",
};
export function addressText(value: Address) {
  return `${value.street.trim()}, ${value.city.trim()}, ${value.state.trim().toUpperCase()} ${value.zip.trim()}`;
}
export function addressErrors(value: Address) {
  const errors: Partial<Record<keyof Address, string>> = {};
  for (const key of ["street", "city"] as const)
    if (!value[key].trim() || value[key].trim().length > 150)
      errors[key] = "Enter 1–150 characters.";
  if (!/^[A-Z]{2}$/.test(value.state.trim().toUpperCase()))
    errors.state = "Enter a two-letter state code.";
  if (!/^\d{5}(-\d{4})?$/.test(value.zip.trim()))
    errors.zip = "Enter a valid ZIP code.";
  return errors;
}

export function storedAddress(value: unknown): Address | undefined {
  if (!value || typeof value !== "object") return undefined;
  const a = value as Address;
  if (
    ![a.street, a.city, a.state, a.zip].every((v) => typeof v === "string") ||
    Object.keys(addressErrors(a)).length
  )
    return undefined;
  return { street: a.street, city: a.city, state: a.state, zip: a.zip };
}
