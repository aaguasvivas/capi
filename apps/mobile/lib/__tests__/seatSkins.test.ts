import { describe, expect, it } from "vitest";
import type { PremiumFichasId } from "../iapCatalog";
import {
  PREMIUM_FICHAS_IDS,
  asPremiumFichasId,
  seatBackSkin,
  skinToSend,
} from "../seatSkins";

const none = new Set<PremiumFichasId>();
const all = new Set<PremiumFichasId>(["quisqueya", "borinquen", "kingston"]);

describe("asPremiumFichasId", () => {
  it("accepts exactly the three premium designs", () => {
    expect([...PREMIUM_FICHAS_IDS].sort()).toEqual(
      ["borinquen", "kingston", "quisqueya"]
    );
    for (const id of PREMIUM_FICHAS_IDS) expect(asPremiumFichasId(id)).toBe(id);
  });

  it("rejects clasico, junk, and non-strings", () => {
    expect(asPremiumFichasId("clasico")).toBeNull();
    expect(asPremiumFichasId("larimar")).toBeNull();
    expect(asPremiumFichasId("QUISQUEYA")).toBeNull();
    expect(asPremiumFichasId(null)).toBeNull();
    expect(asPremiumFichasId(undefined)).toBeNull();
    expect(asPremiumFichasId(1)).toBeNull();
  });
});

describe("seatBackSkin", () => {
  it("a seat's premium design wins over the viewer's", () => {
    expect(seatBackSkin("kingston", "clasico")).toBe("kingston");
    expect(seatBackSkin("borinquen", "quisqueya")).toBe("borinquen");
  });

  it("a seat with no premium design shows the viewer's design", () => {
    expect(seatBackSkin(null, "quisqueya")).toBe("quisqueya");
    expect(seatBackSkin(undefined, "clasico")).toBe("clasico");
    expect(seatBackSkin("clasico", "kingston")).toBe("kingston");
    expect(seatBackSkin("noche", "borinquen")).toBe("borinquen");
  });
});

describe("skinToSend", () => {
  it("sends a premium design only when it is owned", () => {
    expect(skinToSend("quisqueya", all)).toBe("quisqueya");
    expect(skinToSend("kingston", new Set(["kingston"]))).toBe("kingston");
    expect(skinToSend("kingston", new Set(["borinquen"]))).toBeUndefined();
    expect(skinToSend("borinquen", none)).toBeUndefined();
  });

  it("never sends clasico", () => {
    expect(skinToSend("clasico", all)).toBeUndefined();
  });

  it("an undefined design drops out of a JSON body", () => {
    const body = JSON.stringify({ playerId: "p", tileSkin: skinToSend("clasico", all) });
    expect(body).toBe('{"playerId":"p"}');
  });
});
