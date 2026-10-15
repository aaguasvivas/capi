import { describe, expect, it } from "vitest";
import { deriveEntitlements, PRODUCT_IDS } from "../iapCatalog";
import { sharedFileContent } from "../sharedPayload";

describe("sharedFileContent", () => {
  it("nothing owned: no design, no tables", () => {
    expect(sharedFileContent("clasico", deriveEntitlements([]))).toBe(
      '{"v":1,"tileSkin":null,"mesas":[]}'
    );
  });

  it("an owned premium design and the owned tables, sorted", () => {
    const ent = deriveEntitlements([
      PRODUCT_IDS.mesaQuisqueya,
      PRODUCT_IDS.mesaLarimar,
      PRODUCT_IDS.fichasQuisqueya,
    ]);
    expect(sharedFileContent("quisqueya", ent)).toBe(
      '{"v":1,"tileSkin":"quisqueya","mesas":["larimar","quisqueya"]}'
    );
  });

  it("a picked design that is not owned, or clasico, writes null", () => {
    const ent = deriveEntitlements([PRODUCT_IDS.fichasBorinquen]);
    expect(JSON.parse(sharedFileContent("kingston", ent)).tileSkin).toBeNull();
    expect(JSON.parse(sharedFileContent("clasico", ent)).tileSkin).toBeNull();
    expect(JSON.parse(sharedFileContent("borinquen", ent)).tileSkin).toBe(
      "borinquen"
    );
  });

  it("the bundle lists all three premium tables", () => {
    const ent = deriveEntitlements([PRODUCT_IDS.todo]);
    expect(JSON.parse(sharedFileContent("kingston", ent))).toEqual({
      v: 1,
      tileSkin: "kingston",
      mesas: ["larimar", "noche", "quisqueya"],
    });
  });

  it("the same state gives the same bytes, whatever the set order", () => {
    const a = deriveEntitlements([PRODUCT_IDS.mesaNoche, PRODUCT_IDS.mesaLarimar]);
    const b = deriveEntitlements([PRODUCT_IDS.mesaLarimar, PRODUCT_IDS.mesaNoche]);
    expect(sharedFileContent("clasico", a)).toBe(sharedFileContent("clasico", b));
  });
});
