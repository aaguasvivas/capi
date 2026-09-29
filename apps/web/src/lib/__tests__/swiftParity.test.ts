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

// Swift key -> i18n key.
const mirrored: Record<string, keyof Strings> = {
  yourTurnGeneric: "yourTurnGeneric",
  yourTurnFor: "yourTurnFor",
  roundWon: "roundWon",
  gameWon: "gameWon",
  gameWonTeam: "gameWonTeam",
  invite1v1: "invite1v1",
  invite2v2: "invite2v2",
  inviteRematch: "inviteRematch",
  tableNotFound: "tableNotFound",
  openInCapi: "openInCapi",
  join: "joinGame",
  create: "createGame",
  yourName: "yourName",
  connectionError: "connectionError",
  retry: "retry",
  cancel: "cancel",
};

// A function-valued key is called with the Swift interpolation of its one
// argument, so `(name) => \`${name} took the round\`` must appear in Swift
// as the literal "\(name) took the round".
function literal(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "function") return (value as (name: string) => string)("\\(name)");
  return null;
}

describe("CapiStrings.swift mirrors packages/i18n", () => {
  for (const [swiftKey, key] of Object.entries(mirrored)) {
    it(`declares ${swiftKey}`, () => {
      expect(swift).toMatch(new RegExp(`static (var|func) ${swiftKey}\\b`));
    });

    const esValue = literal(es[key]);
    const enValue = literal(en[key]);
    if (esValue === null || enValue === null) continue;
    it(`${swiftKey} carries the ES and EN literals of ${key}`, () => {
      expect(swift).toContain(`"${esValue}"`);
      expect(swift).toContain(`"${enValue}"`);
    });
  }
});
