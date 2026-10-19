import { describe, expect, it } from "vitest";
import { en, es } from "@capi/i18n";
import {
  checkFields,
  CODE_LENGTH,
  normalizeCode,
  type FieldMessage,
} from "../gameForms";

describe("normalizeCode", () => {
  it("uppercases letters and keeps digits", () => {
    expect(normalizeCode("ab12cd")).toBe("AB12CD");
  });

  it("drops spaces, dashes and other symbols", () => {
    expect(normalizeCode(" abc-123 ")).toBe("ABC123");
    expect(normalizeCode("A.B_C/1#2!")).toBe("ABC12");
  });

  it("drops accented and other non-ASCII letters", () => {
    expect(normalizeCode("ñáé9z")).toBe("9Z");
  });

  it("keeps at most six characters", () => {
    expect(normalizeCode("ABCDEFGH")).toBe("ABCDEF");
    expect(normalizeCode("ab-cd-ef-gh")).toHaveLength(CODE_LENGTH);
  });

  it("leaves an empty field empty", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("--  ")).toBe("");
  });
});

describe("checkFields", () => {
  it("passes a name and a full code", () => {
    expect(
      checkFields([
        ["name", "Rosa"],
        ["code", "ABC123"],
      ])
    ).toEqual({ errors: {}, first: null });
  });

  it("needs a name after trim", () => {
    expect(checkFields([["name", "   "]])).toEqual({
      errors: { name: "nameNeeded" },
      first: "name",
    });
  });

  it("needs a six-character code", () => {
    expect(
      checkFields([
        ["name", "Rosa"],
        ["code", "ABC12"],
      ])
    ).toEqual({ errors: { code: "codeIs6" }, first: "code" });
    expect(checkFields([["code", ""]]).errors).toEqual({ code: "codeIs6" });
  });

  it("checks the code the field would hold, not the raw text", () => {
    expect(checkFields([["code", "abc-123"]]).first).toBeNull();
    expect(checkFields([["code", "ab-12"]]).first).toBe("code");
  });

  it("flags every invalid field and puts the top one first", () => {
    expect(
      checkFields([
        ["name", ""],
        ["code", "AB"],
      ])
    ).toEqual({
      errors: { name: "nameNeeded", code: "codeIs6" },
      first: "name",
    });
  });

  it("follows the order the screen lists, not a fixed one", () => {
    expect(
      checkFields([
        ["code", "AB"],
        ["name", ""],
      ]).first
    ).toBe("code");
  });

  it("has every message in both languages", () => {
    const { errors } = checkFields([
      ["name", ""],
      ["code", ""],
    ]);
    const keys = [errors.name, errors.code].filter(
      (k): k is FieldMessage => k !== undefined
    );
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(en[key].length).toBeGreaterThan(0);
      expect(es[key].length).toBeGreaterThan(0);
    }
  });
});
