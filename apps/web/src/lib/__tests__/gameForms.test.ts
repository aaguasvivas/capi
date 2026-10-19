import { describe, expect, it } from "vitest";
import { en, es } from "@capi/i18n";
import { CODE_LENGTH, checkFields, normalizeCode } from "../gameForms";

describe("normalizeCode", () => {
  it("uppercases and keeps only letters and digits", () => {
    expect(normalizeCode("abc-123 ")).toBe("ABC123");
    expect(normalizeCode(" a b\tc\n1.2_3")).toBe("ABC123");
  });

  it("cuts at six characters after dropping the rest", () => {
    expect(normalizeCode("ABC-1234")).toBe("ABC123");
    expect(normalizeCode("x".repeat(20))).toHaveLength(CODE_LENGTH);
  });

  it("drops accented letters and emoji instead of keeping lookalikes", () => {
    expect(normalizeCode("ñá\u{1F600}AB")).toBe("AB");
  });

  it("returns an empty code for empty or symbol-only input", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("-- ..")).toBe("");
  });
});

describe("checkFields", () => {
  it("passes a filled form", () => {
    expect(
      checkFields([
        ["code", "ABC123"],
        ["name", "Ana"],
      ])
    ).toEqual({ errors: {}, first: null });
  });

  it("flags every invalid field and names the topmost as first", () => {
    expect(
      checkFields([
        ["code", "AB1"],
        ["name", ""],
      ])
    ).toEqual({ errors: { code: "codeIs6", name: "nameNeeded" }, first: "code" });
  });

  it("follows the order the form lists its fields", () => {
    expect(
      checkFields([
        ["name", " "],
        ["code", ""],
      ]).first
    ).toBe("name");
    expect(
      checkFields([
        ["code", "ABC123"],
        ["name", ""],
      ])
    ).toEqual({ errors: { name: "nameNeeded" }, first: "name" });
  });

  it("treats a name of only spaces as missing", () => {
    expect(checkFields([["name", "   \t"]]).errors).toEqual({ name: "nameNeeded" });
    expect(checkFields([["name", "  Ana "]]).errors).toEqual({});
  });

  it("needs exactly six code characters, counted after normalizing", () => {
    expect(checkFields([["code", "ABC12"]]).errors).toEqual({ code: "codeIs6" });
    expect(checkFields([["code", "abc-123"]]).errors).toEqual({});
  });

  it("chooses messages that exist in both languages", () => {
    const { errors } = checkFields([
      ["code", ""],
      ["name", ""],
    ]);
    for (const key of Object.values(errors)) {
      expect(en[key!]).toBeTruthy();
      expect(es[key!]).toBeTruthy();
    }
  });
});
