import type { Strings } from "@capi/i18n";

// The create and join forms never disable their button over a field. A tap
// checks the fields in the order they appear on the form; every invalid one
// gets its own message, and the first one is scrolled to and focused.

export const CODE_LENGTH = 6;

// Invite codes are uppercase letters and digits. Typed or pasted input keeps
// only those, so "abc-123 " becomes "ABC123". No maxLength on the input: the
// browser would truncate a pasted "ABC-123" before the dash is dropped.
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export type FormField = "code" | "name";
// The strings key each invalid field shows. Errors keep the key, not the
// text, so a language switch rewords a message already on screen.
export type FieldMessage = keyof Pick<Strings, "codeIs6" | "nameNeeded">;
export type FieldErrors = Partial<Record<FormField, FieldMessage>>;

function problem(field: FormField, value: string): FieldMessage | null {
  if (field === "name") return value.trim() ? null : "nameNeeded";
  return normalizeCode(value).length === CODE_LENGTH ? null : "codeIs6";
}

// `fields` lists the form's fields top to bottom. `first` is the invalid
// field nearest the top, or null when the form can be sent.
export function checkFields(fields: ReadonlyArray<readonly [FormField, string]>): {
  errors: FieldErrors;
  first: FormField | null;
} {
  const errors: FieldErrors = {};
  let first: FormField | null = null;
  for (const [field, value] of fields) {
    const message = problem(field, value);
    if (!message) continue;
    errors[field] = message;
    if (!first) first = field;
  }
  return { errors, first };
}
