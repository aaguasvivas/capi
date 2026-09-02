import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { en, es, type Strings } from "@capi/i18n";

// The iMessage extension renders bubbles without JS, so it duplicates a
// handful of strings in Swift. This keeps that copy honest: every mirrored
// literal must appear verbatim in CapiStrings.swift.
const swift = readFileSync(
  new URL("../../../../../apps/mobile/targets/messages/CapiStrings.swift", import.meta.url),
  "utf8"
);

// Swift key -> i18n key. Function-valued keys are checked by name only.
const mirrored: Record<string, keyof Strings> = {
  yourTurnGeneric: "yourTurnGeneric",
  roundWon: "roundWon",
  gameWon: "gameWon",
  invite1v1: "invite1v1",
  invite2v2: "invite2v2",
  tableFull: "tableFull",
  gameStarted: "gameStarted",
  openInCapi: "openInCapi",
  join: "joinGame",
  create: "createGame",
  yourName: "yourName",
  connectionError: "connectionError",
};

describe("CapiStrings.swift mirrors packages/i18n", () => {
  for (const [swiftKey, key] of Object.entries(mirrored)) {
    it(`declares ${swiftKey}`, () => {
      expect(swift).toMatch(new RegExp(`static (var|func) ${swiftKey}\\b`));
    });

    const esValue = es[key];
    const enValue = en[key];
    if (typeof esValue !== "string" || typeof enValue !== "string") continue;
    it(`${swiftKey} carries the ES and EN literals of ${key}`, () => {
      expect(swift).toContain(`"${esValue}"`);
      expect(swift).toContain(`"${enValue}"`);
    });
  }
});
