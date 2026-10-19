// The create and join forms' checks. A button never disables over a field:
// a tap checks the fields in the order they sit on screen, every invalid one
// gets its own message, and the first one is scrolled to and focused. Pure
// module so it unit-tests without React Native.
import type { Strings } from "@capi/i18n";

export const CODE_LENGTH = 6;

// Invite codes are uppercase letters and digits. What the player types or
// pastes keeps only those, so "abc-123 " becomes "ABC123". The input has no
// maxLength: it would cut a pasted "ABC-123" before the dash is dropped.
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export type FormField = "name" | "code";
// The strings key each invalid field shows. The screen keeps the key, not the
// text, so a language switch rewords a message already on screen.
export type FieldMessage = keyof Pick<Strings, "nameNeeded" | "codeIs6">;
export type FieldErrors = Partial<Record<FormField, FieldMessage>>;

function problem(field: FormField, value: string): FieldMessage | null {
  if (field === "name") return value.trim() ? null : "nameNeeded";
  return normalizeCode(value).length === CODE_LENGTH ? null : "codeIs6";
}

// `fields` lists what a tap sends, top to bottom. `first` is the invalid
// field nearest the top, or null when the request may go out.
export function checkFields(
  fields: ReadonlyArray<readonly [FormField, string]>
): { errors: FieldErrors; first: FormField | null } {
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
