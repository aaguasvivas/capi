import { describe, expect, it } from "vitest";
import {
  ALL_PRODUCT_IDS,
  PRODUCT_IDS,
  asProductId,
  deriveEntitlements,
} from "../iapCatalog";

describe("catalog", () => {
  it("has exactly the 8 approved product ids", () => {
    expect([...ALL_PRODUCT_IDS].sort()).toEqual(
      [
        "capi.remove_ads",
        "capi.mesa.quisqueya",
        "capi.mesa.larimar",
        "capi.mesa.noche",
        "capi.fichas.quisqueya",
        "capi.fichas.borinquen",
        "capi.fichas.kingston",
        "capi.todo",
      ].sort()
    );
  });

  it("asProductId narrows known ids and rejects junk", () => {
    expect(asProductId("capi.mesa.larimar")).toBe("capi.mesa.larimar");
    expect(asProductId("dev.anota.pro")).toBeNull();
    expect(asProductId(undefined)).toBeNull();
  });
});

describe("deriveEntitlements", () => {
  it("empty ownership: everything locked, ads on", () => {
    const e = deriveEntitlements([]);
    expect(e.adFree).toBe(false);
    expect(e.mesas.size).toBe(0);
    expect(e.fichas.size).toBe(0);
  });

  it("remove_ads only kills ads", () => {
    const e = deriveEntitlements([PRODUCT_IDS.removeAds]);
    expect(e.adFree).toBe(true);
    expect(e.mesas.size).toBe(0);
  });

  it("individual cosmetics unlock exactly themselves", () => {
    const e = deriveEntitlements([
      PRODUCT_IDS.mesaLarimar,
      PRODUCT_IDS.fichasKingston,
    ]);
    expect(e.adFree).toBe(false);
    expect(e.mesas.has("larimar")).toBe(true);
    expect(e.mesas.has("quisqueya")).toBe(false);
    expect(e.fichas.has("kingston")).toBe(true);
    expect(e.fichas.has("borinquen")).toBe(false);
  });

  it("todo unlocks everything including adFree", () => {
    const e = deriveEntitlements([PRODUCT_IDS.todo]);
    expect(e.adFree).toBe(true);
    expect(e.mesas).toEqual(new Set(["quisqueya", "larimar", "noche"]));
    expect(e.fichas).toEqual(new Set(["quisqueya", "borinquen", "kingston"]));
  });

  it("is idempotent over duplicates", () => {
    const e = deriveEntitlements([PRODUCT_IDS.todo, PRODUCT_IDS.todo]);
    expect(e.ownedIds.size).toBe(1);
  });
});
