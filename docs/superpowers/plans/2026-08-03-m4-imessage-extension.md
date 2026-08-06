# M4 iMessage Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capi playable inside iMessage: GamePigeon-style bubbles for turns, the shipped playcapi.com game in an embedded webview for play and live watching, 1v1 and 2v2 group chats.

**Architecture:** A Swift Messages extension (`CapiMessages`, bundle id `dev.capi.app.messages`) added to the Expo app at prebuild time by a hand-rolled config plugin (research confirmed `@bacons/apple-targets` has no Messages type and needs SDK 53; we are pinned to 52). The extension owns bubbles, identity, and seating via the existing REST API; the expanded view is a `WKWebView` on the game page's new `embed=imessage` mode with session handoff via URL fragment and a JS bridge for bubble refreshes. Engine, server, and realtime are untouched.

**Tech Stack:** Swift 5 / SwiftUI in the extension (no React Native inside it), Messages framework (`MSMessagesAppViewController`, `MSSession`, `MSMessageTemplateLayout`), WKWebView, `@expo/config-plugins` + the `xcode` pbxproj lib (plugin), existing Next.js web client, EAS managed credentials with `expo.extra.eas.build.experimental.ios.appExtensions`.

**Ground truth captured 2026-08-03 (do not rediscover):**
- Create: `POST https://playcapi.com/api/games` body `{nickname, avatarColor, theme, is2v2, targetScore}` → `{gameId, inviteCode, playerId, seat:"n"}` (web omits `mode`; extension does the same).
- Join: `POST https://playcapi.com/api/games/<gameId>/join` body `{nickname, avatarColor}` → `{playerId, seat, gameId, waiting?, playersJoined?, playersNeeded?}`; 409 `{error:"Game is full"}` or `{error:"Game already started"}`.
- Web session: `localStorage["capi_session_<gameId>"] = {"playerId":"...","seat":"n","gameId":"..."}`, loaded in `apps/web/src/app/game/[id]/page.tsx` lines 83-92.
- Identifiers (Adelson-approved): extension `dev.capi.app.messages`, App Group `group.dev.capi.app`.
- `apps/mobile/.gitignore` ignores `/ios` and `/android`: local prebuild is disposable; EAS prebuilds fresh.
- EAS extension credentials key: `expo.extra.eas.build.experimental.ios.appExtensions: [{targetName, bundleIdentifier, entitlements}]` (docs verified).

**Standing rules for every task:** run commands from the directory stated in the task; mobile/EAS commands from `apps/mobile` under Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). Never bump Expo SDK / React / React Native. No em dashes in user-facing strings. Commit after every task with the message given.

**DEPLOY GATE:** Capi 1.0 is in App Review and the reviewer uses playcapi.com as player 2. Web tasks (1-3) are committed but **not pushed** until Task 4's gate confirms Apple approved 1.0 (pushing main deploys Vercel). Extension development does not wait: the webview uses localhost in DEBUG (Task 10).

---

### Task 1: Web embed mode (visual trims behind a query param)

**Files:**
- Create: `apps/web/src/lib/embed.ts`
- Modify: `apps/web/src/app/game/[id]/page.tsx` (top of component + footer/lang-toggle render sites)

- [ ] **Step 1: Create the embed helper**

`apps/web/src/lib/embed.ts`:
```ts
// True when the game page runs inside the Capi iMessage extension's webview.
// Gated by an explicit query param so normal navigation can never trigger it.
export function isImessageEmbed(searchParams: URLSearchParams | null): boolean {
  return searchParams?.get("embed") === "imessage";
}
```

- [ ] **Step 2: Wire it into the game page**

In `apps/web/src/app/game/[id]/page.tsx`: import `useSearchParams` from `next/navigation` (already imported in this file if present; add otherwise) and `isImessageEmbed` from `@/lib/embed`. Inside the component, before the return:

```tsx
const searchParams = useSearchParams();
const embedded = isImessageEmbed(searchParams);
```

Find the footer block (the contentinfo with Privacidad/Soporte links) and the language toggle in the game page header area; wrap each with `{!embedded && (...)}`. Do not touch layout heights: the page already fills `100dvh`.

- [ ] **Step 3: Gate check**

Run from `apps/web`: `npx tsc --noEmit` → exit 0. Then `npm run dev` at repo root (`npm run dev:web`), open `http://localhost:3000/game/<any-live-game-id>?embed=imessage` in a browser: footer and language toggle absent; without the param: present.

- [ ] **Step 4: Commit (do not push; see DEPLOY GATE)**

```bash
git add apps/web/src/lib/embed.ts "apps/web/src/app/game/[id]/page.tsx"
git commit -m "Web: embed=imessage mode trims footer and language toggle"
```

### Task 2: Web session bootstrap from URL fragment (TDD)

**Files:**
- Create: `apps/web/src/lib/embedSession.ts`
- Create: `apps/web/src/lib/__tests__/embedSession.test.ts`
- Modify: `apps/web/src/app/game/[id]/page.tsx:83-92` (the session-loading effect)

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/embedSession.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseSessionFragment } from "../embedSession";

describe("parseSessionFragment", () => {
  it("parses #s=playerId.seat into a session for the game", () => {
    expect(parseSessionFragment("#s=abc-123.n", "game-9")).toEqual({
      playerId: "abc-123",
      seat: "n",
      gameId: "game-9",
    });
  });
  it("returns null for missing or malformed fragments", () => {
    expect(parseSessionFragment("", "g")).toBeNull();
    expect(parseSessionFragment("#other=1", "g")).toBeNull();
    expect(parseSessionFragment("#s=onlyid", "g")).toBeNull();
    expect(parseSessionFragment("#s=id.x", "g")).toBeNull(); // invalid seat
  });
  it("accepts all four seats", () => {
    for (const seat of ["n", "e", "s", "w"]) {
      expect(parseSessionFragment(`#s=p.${seat}`, "g")?.seat).toBe(seat);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

From `apps/web`: `npx vitest run src/lib/__tests__/embedSession.test.ts`
Expected: FAIL (module `../embedSession` not found).

- [ ] **Step 3: Implement**

`apps/web/src/lib/embedSession.ts`:
```ts
// The iMessage extension seats a player natively (create/join over REST) and
// hands the session to this webview via URL fragment: #s=<playerId>.<seat>
// A fragment never reaches server logs. The page stores it under the same
// localStorage key the create/join forms use, then strips the hash.
const SEATS = new Set(["n", "e", "s", "w"]);

export interface EmbedSession {
  playerId: string;
  seat: string;
  gameId: string;
}

export function parseSessionFragment(hash: string, gameId: string): EmbedSession | null {
  const m = /^#s=([^.]+)\.([nesw])$/.exec(hash ?? "");
  if (!m || !SEATS.has(m[2])) return null;
  return { playerId: m[1], seat: m[2], gameId };
}
```

- [ ] **Step 4: Run the test, verify it passes**

`npx vitest run src/lib/__tests__/embedSession.test.ts` → 3 passed.

- [ ] **Step 5: Wire into the game page session effect**

In `apps/web/src/app/game/[id]/page.tsx`, replace the effect at lines 83-92 with:

```tsx
useEffect(() => {
  const boot = parseSessionFragment(window.location.hash, id);
  if (boot) {
    localStorage.setItem(`capi_session_${id}`, JSON.stringify(boot));
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  const raw = localStorage.getItem(`capi_session_${id}`);
  if (raw) {
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.push("/");
    }
  }
}, [id, router]);
```

Add `import { parseSessionFragment } from "@/lib/embedSession";` at the top.

- [ ] **Step 6: Gate check**

`npx tsc --noEmit` → exit 0. In the browser against the dev server: create a game in one tab, copy its gameId and playerId from localStorage, open a second private window at `http://localhost:3000/game/<gameId>?embed=imessage#s=<playerId>.n` → page loads seated (your hand visible), and the URL hash is stripped. A normal load without a hash behaves exactly as before.

- [ ] **Step 7: Commit (do not push)**

```bash
git add apps/web/src/lib/embedSession.ts apps/web/src/lib/__tests__/embedSession.test.ts "apps/web/src/app/game/[id]/page.tsx"
git commit -m "Web: session bootstrap from URL fragment for the iMessage embed"
```

### Task 3: Web JS bridge notifications to the extension shell

**Files:**
- Create: `apps/web/src/lib/imessageBridge.ts`
- Modify: `apps/web/src/app/game/[id]/page.tsx` (inside `handlePlay`/round-over/game-over effects; exact sites below)

- [ ] **Step 1: Create the bridge**

`apps/web/src/lib/imessageBridge.ts`:
```ts
// Posts game milestones to the Capi iMessage extension so it can refresh the
// turn bubble. No-op everywhere else (window.webkit only exists in WKWebView
// with a registered handler).
export type BridgeEvent =
  | { type: "moved"; myScore: number; oppScore: number }
  | { type: "roundOver"; myScore: number; oppScore: number }
  | { type: "gameOver"; iWon: boolean; myScore: number; oppScore: number };

export function postToExtension(event: BridgeEvent): void {
  try {
    (window as any).webkit?.messageHandlers?.capi?.postMessage(event);
  } catch {
    /* not embedded */
  }
}
```

- [ ] **Step 2: Emit on own moves and terminal states**

In `apps/web/src/app/game/[id]/page.tsx`:
- In `handlePlay` (currently `playSlam(); submitMove({ type: "play", tile, end });` around line 166) add after `submitMove(...)`: `postToExtension({ type: "moved", myScore, oppScore });` where `myScore`/`oppScore` are the already-derived score values used by the score bar (reuse the existing variables in scope; if named differently, e.g. `myTeamScore`, use those).
- Where the round-over modal becomes visible (the derived `roundAward`/`iWonRound` block near line 474), add a `useEffect` keyed on round-over visibility that fires `postToExtension({ type: "roundOver", myScore, oppScore })` once per round.
- Same pattern for game over with `iWon`.
Add the import at top: `import { postToExtension } from "@/lib/imessageBridge";`

- [ ] **Step 3: Gate check**

`npx tsc --noEmit` → exit 0. In the browser devtools on a dev-server game, run `window.webkit = { messageHandlers: { capi: { postMessage: (e) => console.log("BRIDGE", e) } } }`, play a move → console logs `BRIDGE {type:"moved", ...}`. Finish a round (or stub by re-running with a nearly-done game) → `roundOver` fires once.

- [ ] **Step 4: Commit (do not push)**

```bash
git add apps/web/src/lib/imessageBridge.ts "apps/web/src/app/game/[id]/page.tsx"
git commit -m "Web: JS bridge posts move and round milestones to the iMessage shell"
```

### Task 4: DEPLOY GATE checkpoint

- [ ] **Step 1: Confirm Apple approved Capi 1.0** (Adelson confirms, or App Store listing shows Ready for Sale). If not yet approved, continue with Tasks 5-11 (they never touch prod) and return here.

- [ ] **Step 2: Push web tasks**

```bash
git push origin main
```
Wait for the Vercel deploy, then re-run Task 2 Step 6's seated-fragment check against `https://playcapi.com`. Also load a plain prod game to confirm zero regression for normal players.

### Task 5: Messages extension icon assets

**Files:**
- Create: `apps/mobile/scripts/gen-imessage-icons.mjs`
- Create (generated): `apps/mobile/targets/messages/Assets.xcassets/iMessage App Icon.stickersiconset/` (PNGs + Contents.json)

- [ ] **Step 1: Write the generator**

`apps/mobile/scripts/gen-imessage-icons.mjs`:
```js
// iMessage app drawer icons: wide (letterboxed) renders of the classic mark.
// Sizes per Apple's iMessage App Icon set. Requires rsvg-convert.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(
  new URL("../targets/messages/Assets.xcassets/iMessage App Icon.stickersiconset/", import.meta.url)
);
mkdirSync(OUT, { recursive: true });

const INK = "#0a0a0a";
const CREAM = "#FBF8ED";
const GOLD = "#c9a961";
const EDGE = "#0f0d0a";
const PIPS5 = [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];

function tileSvg(W, H) {
  // One classic tile centered in a W×H canvas, tile height = 86% of H.
  const TH = H * 0.86, TW = TH * 0.52, cx = W / 2, cy = H / 2;
  const x = cx - TW / 2, y = cy - TH / 2, rad = TW * 0.17, pipR = TW * 0.105, spread = TW * 0.24;
  const pips = (hcy) =>
    PIPS5.map(([gx, gy]) => {
      const c = gx === 0 && gy === 0 ? GOLD : INK;
      return `<circle cx="${cx + gx * spread}" cy="${hcy + gy * spread}" r="${pipR}" fill="${c}"/>`;
    }).join("");
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <g transform="rotate(-8 ${cx} ${cy})">
    <rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="${rad}" fill="${CREAM}" stroke="${EDGE}" stroke-width="${TW * 0.075}"/>
    <line x1="${x + TW * 0.13}" y1="${cy}" x2="${x + TW * 0.87}" y2="${cy}" stroke="${EDGE}" stroke-width="${TW * 0.05}" stroke-linecap="round"/>
    ${pips(cy - TH / 4 - TW * 0.02)}
    ${pips(cy + TH / 4 + TW * 0.02)}
  </g>
</svg>`;
}

const SIZES = [
  ["icon-27x20@2x.png", 54, 40], ["icon-27x20@3x.png", 81, 60],
  ["icon-32x24@2x.png", 64, 48], ["icon-32x24@3x.png", 96, 72],
  ["icon-60x45@2x.png", 120, 90], ["icon-60x45@3x.png", 180, 135],
  ["icon-67x50@2x.png", 134, 100],
  ["icon-74x55@2x.png", 148, 110],
  ["icon-1024x768.png", 1024, 768],
  ["icon-appstore-1024.png", 1024, 1024],
];

const dir = mkdtempSync(join(tmpdir(), "capi-imsg-"));
for (const [name, w, h] of SIZES) {
  const f = join(dir, name + ".svg");
  writeFileSync(f, tileSvg(w, h));
  execFileSync("rsvg-convert", ["-w", String(w), "-h", String(h), "-b", INK, f, "-o", join(OUT, name)]);
  console.log("wrote", name);
}
rmSync(dir, { recursive: true, force: true });

const contents = {
  images: [
    { size: "60x45", idiom: "iphone", filename: "icon-60x45@2x.png", scale: "2x" },
    { size: "60x45", idiom: "iphone", filename: "icon-60x45@3x.png", scale: "3x" },
    { size: "67x50", idiom: "ipad", filename: "icon-67x50@2x.png", scale: "2x" },
    { size: "74x55", idiom: "ipad", filename: "icon-74x55@2x.png", scale: "2x" },
    { size: "27x20", idiom: "universal", filename: "icon-27x20@2x.png", scale: "2x", platform: "ios" },
    { size: "27x20", idiom: "universal", filename: "icon-27x20@3x.png", scale: "3x", platform: "ios" },
    { size: "32x24", idiom: "universal", filename: "icon-32x24@2x.png", scale: "2x", platform: "ios" },
    { size: "32x24", idiom: "universal", filename: "icon-32x24@3x.png", scale: "3x", platform: "ios" },
    { size: "1024x1024", idiom: "ios-marketing", filename: "icon-appstore-1024.png", scale: "1x", platform: "ios" },
    { size: "1024x768", idiom: "ios-marketing", filename: "icon-1024x768.png", scale: "1x", platform: "ios" },
  ],
  info: { version: 1, author: "xcode" },
};
writeFileSync(join(OUT, "Contents.json"), JSON.stringify(contents, null, 2));
console.log("wrote Contents.json");
```

Also create the enclosing catalog marker `apps/mobile/targets/messages/Assets.xcassets/Contents.json`:
```json
{ "info": { "version": 1, "author": "xcode" } }
```

- [ ] **Step 2: Run it**

From `apps/mobile`: `node scripts/gen-imessage-icons.mjs`
Expected: ten `wrote icon-*.png` lines + `wrote Contents.json`. Spot-check one: `file "targets/messages/Assets.xcassets/iMessage App Icon.stickersiconset/icon-60x45@3x.png"` → PNG 180 x 135.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/scripts/gen-imessage-icons.mjs apps/mobile/targets/messages/Assets.xcassets
git commit -m "Mobile: iMessage drawer icon set generated from the classic mark"
```

### Task 6: Extension sources: strings, store, API client (pure Swift, no UI yet)

**Files:**
- Create: `apps/mobile/targets/messages/CapiStrings.swift`
- Create: `apps/mobile/targets/messages/CapiStore.swift`
- Create: `apps/mobile/targets/messages/CapiAPI.swift`

- [ ] **Step 1: Strings**

`CapiStrings.swift`:
```swift
import Foundation

// The only strings duplicated from packages/i18n/src/strings.ts (bubbles must
// render without the webview). Keys mirrored: yourTurn, roundWon, gameWon,
// invite1v1, invite2v2, joinGame, create, tableFull, openInCapi.
enum CapiStrings {
    static var es: Bool { Locale.preferredLanguages.first?.hasPrefix("es") ?? false }

    static func yourTurn(_ name: String) -> String { es ? "Te toca, \(name)" : "Your turn, \(name)" }
    static func roundWon(_ name: String) -> String { es ? "\(name) ganó la ronda" : "\(name) took the round" }
    static func gameWon(_ name: String) -> String { es ? "\(name) ganó el juego" : "\(name) won the game" }
    static var invite1v1: String { es ? "¡A jugar dominó! 1v1" : "Dominoes time! 1v1" }
    static var invite2v2: String { es ? "¡Dominó 2v2! Toca para sentarte" : "2v2 dominoes! Tap to sit" }
    static var join: String { es ? "Unirse a la mesa" : "Join the table" }
    static var create: String { es ? "Crear partida" : "Start a game" }
    static var tableFull: String { es ? "La mesa está llena" : "The table is full" }
    static var openInCapi: String { es ? "Abrir en Capi" : "Open in Capi" }
    static var yourName: String { es ? "Tu nombre" : "Your name" }
}
```

- [ ] **Step 2: App Group store**

`CapiStore.swift`:
```swift
import Foundation

// Shared identity + per-game sessions in the App Group so the extension and
// the main Capi app agree on who you are. Keys use the capi_ prefix to match
// the app's conventions.
struct CapiSession: Codable, Equatable {
    let playerId: String
    let seat: String
    let gameId: String
}

enum CapiStore {
    static let group = "group.dev.capi.app"
    static var defaults: UserDefaults { UserDefaults(suiteName: group)! }

    static var nickname: String {
        get { defaults.string(forKey: "capi_nickname") ?? "" }
        set { defaults.set(newValue, forKey: "capi_nickname") }
    }
    static var avatarColor: String {
        get { defaults.string(forKey: "capi_avatar_color") ?? "#6366f1" }
        set { defaults.set(newValue, forKey: "capi_avatar_color") }
    }
    static func session(for gameId: String) -> CapiSession? {
        guard let data = defaults.data(forKey: "capi_session_\(gameId)") else { return nil }
        return try? JSONDecoder().decode(CapiSession.self, from: data)
    }
    static func save(_ session: CapiSession) {
        defaults.set(try? JSONEncoder().encode(session), forKey: "capi_session_\(session.gameId)")
    }
}
```

- [ ] **Step 3: API client**

`CapiAPI.swift`:
```swift
import Foundation

// Thin client of the same REST API the web and apps use. Bodies and shapes
// mirror apps/web/src/components/CreateGameForm.tsx and
// apps/web/src/app/api/games/[id]/join/route.ts exactly.
enum CapiAPI {
    #if DEBUG
    static let base = URL(string: "http://localhost:3000")!
    #else
    static let base = URL(string: "https://playcapi.com")!
    #endif

    struct CreateResponse: Decodable { let gameId: String; let inviteCode: String; let playerId: String; let seat: String }
    struct JoinResponse: Decodable { let playerId: String; let seat: String; let gameId: String; let waiting: Bool? }
    struct APIError: Decodable { let error: String }

    enum Failure: Error { case server(String); case network }

    static func create(nickname: String, avatarColor: String, is2v2: Bool, theme: String = "barberia", targetScore: Int = 100) async throws -> CreateResponse {
        try await post(path: "/api/games", body: [
            "nickname": nickname, "avatarColor": avatarColor,
            "theme": theme, "is2v2": is2v2, "targetScore": targetScore,
        ])
    }

    static func join(gameId: String, nickname: String, avatarColor: String) async throws -> JoinResponse {
        try await post(path: "/api/games/\(gameId)/join", body: ["nickname": nickname, "avatarColor": avatarColor])
    }

    private static func post<T: Decodable>(path: String, body: [String: Any]) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              let http = resp as? HTTPURLResponse else { throw Failure.network }
        if http.statusCode >= 400 {
            let msg = (try? JSONDecoder().decode(APIError.self, from: data))?.error ?? "Error"
            throw Failure.server(msg)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

Note: `http://localhost:3000` in DEBUG requires an ATS exception only for non-localhost hosts; localhost is exempt by default. Release builds always hit playcapi.com.

- [ ] **Step 4: Commit** (compiles are gated in Task 8 once the target exists)

```bash
git add apps/mobile/targets/messages/CapiStrings.swift apps/mobile/targets/messages/CapiStore.swift apps/mobile/targets/messages/CapiAPI.swift
git commit -m "Mobile: iMessage extension core (strings, App Group store, API client)"
```

### Task 7: Extension UI + controller (SwiftUI cards, bubble composer, webview)

**Files:**
- Create: `apps/mobile/targets/messages/CreateJoinViews.swift`
- Create: `apps/mobile/targets/messages/GameWebView.swift`
- Create: `apps/mobile/targets/messages/MessagesViewController.swift`
- Create: `apps/mobile/targets/messages/Info.plist`
- Create: `apps/mobile/targets/messages/CapiMessages.entitlements`

- [ ] **Step 1: SwiftUI compact cards**

`CreateJoinViews.swift`:
```swift
import SwiftUI

struct CreateCard: View {
    @State var nickname: String = CapiStore.nickname
    let allow2v2: Bool
    let onCreate: (_ nickname: String, _ is2v2: Bool) -> Void
    @State private var is2v2 = false

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            if allow2v2 {
                Picker("", selection: $is2v2) {
                    Text("1v1").tag(false)
                    Text("2v2").tag(true)
                }.pickerStyle(.segmented).frame(maxWidth: 240)
            }
            Button(CapiStrings.create) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onCreate(name, allow2v2 && is2v2)
            }.buttonStyle(.borderedProminent)
        }.padding()
    }
}

struct JoinCard: View {
    @State var nickname: String = CapiStore.nickname
    let status: String?
    let onJoin: (_ nickname: String) -> Void

    var body: some View {
        VStack(spacing: 12) {
            Text("Capi").font(.system(size: 28, weight: .heavy))
            if let status { Text(status).foregroundColor(.secondary) }
            TextField(CapiStrings.yourName, text: $nickname)
                .textFieldStyle(.roundedBorder).frame(maxWidth: 240)
            Button(CapiStrings.join) {
                let name = nickname.trimmingCharacters(in: .whitespaces)
                guard !name.isEmpty else { return }
                CapiStore.nickname = name
                onJoin(name)
            }.buttonStyle(.borderedProminent)
        }.padding()
    }
}
```

- [ ] **Step 2: Webview container**

`GameWebView.swift`:
```swift
import UIKit
import WebKit

// Expanded-mode game surface: the playcapi.com game page in embed mode with
// the session handed over via URL fragment. Bridge messages arrive on the
// "capi" handler and are forwarded to the shell for bubble refreshes.
final class GameWebView: UIView, WKScriptMessageHandler {
    private var webView: WKWebView!
    var onBridgeEvent: (([String: Any]) -> Void)?

    init(gameId: String, session: CapiSession) {
        super.init(frame: .zero)
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "capi")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
        ])
        var comps = URLComponents(url: CapiAPI.base.appendingPathComponent("/game/\(gameId)"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "embed", value: "imessage")]
        comps.fragment = "s=\(session.playerId).\(session.seat)"
        webView.load(URLRequest(url: comps.url!))
    }

    required init?(coder: NSCoder) { fatalError() }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if let body = message.body as? [String: Any] { onBridgeEvent?(body) }
    }
}
```

- [ ] **Step 3: The controller**

`MessagesViewController.swift`:
```swift
import UIKit
import SwiftUI
import Messages

// Bubbles, identity, seating. The game itself is the web client (GameWebView).
final class MessagesViewController: MSMessagesAppViewController {

    // The game this drawer instance is showing, and its bubble session. Set on
    // create, join, and bubble tap. handleBridge MUST use these (not
    // conversation.selectedMessage, which is nil right after a create).
    private var currentRef: GameRef?
    private var currentSession: MSSession?

    // MARK: presentation routing

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(with: conversation)
        render(for: conversation)
    }

    override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.didTransition(to: presentationStyle)
        if let convo = activeConversation { render(for: convo) }
    }

    private func render(for conversation: MSConversation) {
        clearChildren()
        if let message = conversation.selectedMessage, let game = GameRef(from: message) {
            // Tapped an existing Capi bubble.
            currentRef = game
            currentSession = message.session
            if let session = CapiStore.session(for: game.gameId) {
                requestPresentationStyle(.expanded)
                showGame(gameId: game.gameId, session: session)
            } else {
                showJoin(game: game)
            }
        } else {
            showCreate(conversation: conversation)
        }
    }

    // MARK: flows

    private func showCreate(conversation: MSConversation) {
        let allow2v2 = conversation.remoteParticipantIdentifiers.count >= 2
        host(CreateCard(allow2v2: allow2v2) { [weak self] nickname, is2v2 in
            Task { @MainActor in
                guard let self else { return }
                do {
                    let r = try await CapiAPI.create(nickname: nickname, avatarColor: CapiStore.avatarColor, is2v2: is2v2)
                    CapiStore.save(CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId))
                    self.insertInviteBubble(gameId: r.gameId, code: r.inviteCode, is2v2: is2v2)
                    self.requestPresentationStyle(.expanded)
                    self.showGame(gameId: r.gameId, session: CapiStore.session(for: r.gameId)!)
                } catch { self.showJoinError(error) }
            }
        })
    }

    private func showJoin(game: GameRef) {
        host(JoinCard(status: nil) { [weak self] nickname in
            Task { @MainActor in
                guard let self else { return }
                do {
                    let r = try await CapiAPI.join(gameId: game.gameId, nickname: nickname, avatarColor: CapiStore.avatarColor)
                    let session = CapiSession(playerId: r.playerId, seat: r.seat, gameId: r.gameId)
                    CapiStore.save(session)
                    self.currentRef = game
                    self.requestPresentationStyle(.expanded)
                    self.showGame(gameId: game.gameId, session: session)
                } catch CapiAPI.Failure.server(let msg) {
                    self.host(JoinCard(status: msg.contains("full") ? CapiStrings.tableFull : msg) { _ in })
                } catch { self.showJoinError(error) }
            }
        })
    }

    private func showGame(gameId: String, session: CapiSession) {
        let web = GameWebView(gameId: gameId, session: session)
        web.onBridgeEvent = { [weak self] event in self?.handleBridge(event, gameId: gameId) }
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        pin(web)
        addOpenInCapiButton(gameId: gameId)
    }

    private func showJoinError(_ error: Error) {
        host(JoinCard(status: "\(error)") { _ in })
    }

    // MARK: bubbles

    private func insertInviteBubble(gameId: String, code: String, is2v2: Bool) {
        let caption = is2v2 ? CapiStrings.invite2v2 : CapiStrings.invite1v1
        currentRef = GameRef(gameId: gameId, code: code)
        currentSession = MSSession()
        send(caption: caption, sub: code, gameId: gameId, code: code, session: currentSession!)
    }

    private func handleBridge(_ event: [String: Any], gameId: String) {
        guard let type = event["type"] as? String,
              let game = currentRef, game.gameId == gameId else { return }
        let my = event["myScore"] as? Int ?? 0
        let opp = event["oppScore"] as? Int ?? 0
        let name = CapiStore.nickname
        let caption: String
        switch type {
        case "moved": caption = CapiStrings.yourTurn(oppNamePlaceholder())
        case "roundOver": caption = CapiStrings.roundWon(name)
        case "gameOver": caption = CapiStrings.gameWon(name)
        default: return
        }
        let session = currentSession ?? MSSession()
        currentSession = session
        send(caption: caption, sub: "\(my) - \(opp)", gameId: game.gameId, code: game.code, session: session)
    }

    private func oppNamePlaceholder() -> String {
        // Participant display names are not exposed to extensions; the caption
        // reads naturally without one in ES and EN.
        return CapiStrings.es ? "te toca" : "you"
    }

    private func send(caption: String, sub: String, gameId: String, code: String, session: MSSession) {
        guard let convo = activeConversation else { return }
        let layout = MSMessageTemplateLayout()
        layout.image = UIImage(named: "bubble-card")
        layout.caption = caption
        layout.subcaption = sub
        let message = MSMessage(session: session)
        message.layout = layout
        message.url = GameRef(gameId: gameId, code: code).url
        message.summaryText = caption
        convo.insert(message)
    }

    // MARK: plumbing

    private func host<V: View>(_ v: V) {
        clearChildren()
        let hc = UIHostingController(rootView: v)
        addChild(hc)
        hc.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hc.view)
        pin(hc.view)
        hc.didMove(toParent: self)
    }

    private func addOpenInCapiButton(gameId: String) {
        var cfg = UIButton.Configuration.gray()
        cfg.title = CapiStrings.openInCapi
        let btn = UIButton(configuration: cfg, primaryAction: UIAction { [weak self] _ in
            self?.extensionContext?.open(URL(string: "capi://game/\(gameId)")!, completionHandler: nil)
        })
        btn.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(btn)
        NSLayoutConstraint.activate([
            btn.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 6),
            btn.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -10),
        ])
    }

    private func pin(_ sub: UIView) {
        NSLayoutConstraint.activate([
            sub.topAnchor.constraint(equalTo: view.topAnchor),
            sub.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            sub.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            sub.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func clearChildren() {
        children.forEach { $0.willMove(toParent: nil); $0.view.removeFromSuperview(); $0.removeFromParent() }
        view.subviews.forEach { $0.removeFromSuperview() }
    }
}

// The bubble payload: gameId + code encoded in the message URL. The URL is
// also the web fallback for taps on macOS or devices without Capi.
struct GameRef {
    let gameId: String
    let code: String

    var url: URL {
        var c = URLComponents(string: "https://playcapi.com/game/\(gameId)")!
        c.queryItems = [URLQueryItem(name: "code", value: code)]
        return c.url!
    }

    init(gameId: String, code: String) { self.gameId = gameId; self.code = code }

    init?(from message: MSMessage) {
        guard let url = message.url,
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.host == "playcapi.com" else { return nil }
        let parts = comps.path.split(separator: "/").map(String.init)
        guard parts.count == 2, parts[0] == "game" else { return nil }
        self.gameId = parts[1]
        self.code = comps.queryItems?.first(where: { $0.name == "code" })?.value ?? ""
    }
}
```

Also add a 300x300 `bubble-card` PNG to the asset catalog: rerun thinking of Task 5's script? No: add to `gen-imessage-icons.mjs` a `bubble-card.png` render (600x600 canvas, same tileSvg) written to `apps/mobile/targets/messages/Assets.xcassets/bubble-card.imageset/` with a standard imageset Contents.json:
```json
{ "images": [{ "idiom": "universal", "filename": "bubble-card.png", "scale": "2x" }], "info": { "version": 1, "author": "xcode" } }
```
Add the entry to the script's outputs and rerun it.

- [ ] **Step 4: Info.plist**

`apps/mobile/targets/messages/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Capi</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.message-payload-provider</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).MessagesViewController</string>
  </dict>
</dict>
</plist>
```

- [ ] **Step 5: Entitlements**

`apps/mobile/targets/messages/CapiMessages.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array><string>group.dev.capi.app</string></array>
</dict>
</plist>
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/targets/messages
git commit -m "Mobile: iMessage extension UI, controller, bubbles, webview, plist, entitlements"
```

### Task 8: Config plugin that adds the CapiMessages target at prebuild

**Files:**
- Create: `apps/mobile/plugins/withMessagesExtension.js`
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Write the plugin**

`apps/mobile/plugins/withMessagesExtension.js`:
```js
// Adds the CapiMessages iMessage extension target to the generated Xcode
// project. Hand-rolled because @bacons/apple-targets has no Messages type and
// requires SDK 53 (we are pinned to 52). Pattern follows the community share
// extension plugins: add target, wire build phases, embed into the app.
const { withXcodeProject, withEntitlementsPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const TARGET = "CapiMessages";
const BUNDLE_ID = "dev.capi.app.messages";
const GROUP = "group.dev.capi.app";
const SRC_DIR = path.join(__dirname, "..", "targets", "messages");
const SWIFT_FILES = [
  "MessagesViewController.swift",
  "CreateJoinViews.swift",
  "GameWebView.swift",
  "CapiAPI.swift",
  "CapiStore.swift",
  "CapiStrings.swift",
];

function withMessagesTarget(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projRoot = config.modRequest.platformProjectRoot;

    if (proj.pbxTargetByName(TARGET)) return config; // idempotent re-runs

    // 1. Copy sources + plist + entitlements + assets into ios/CapiMessages/
    const dest = path.join(projRoot, TARGET);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of [...SWIFT_FILES, "Info.plist", "CapiMessages.entitlements"]) {
      fs.copyFileSync(path.join(SRC_DIR, f), path.join(dest, f));
    }
    fs.cpSync(path.join(SRC_DIR, "Assets.xcassets"), path.join(dest, "Assets.xcassets"), { recursive: true });

    // 2. Create the target (also creates product + appex embed wiring group)
    const target = proj.addTarget(TARGET, "app_extension", TARGET, BUNDLE_ID);

    // 3. Groups + build phases
    const groupKey = proj.pbxCreateGroup(TARGET, TARGET);
    const mainGroupId = proj.getFirstProject().firstProject.mainGroup;
    proj.getPBXGroupByKey(mainGroupId).children.push({ value: groupKey, comment: TARGET });

    proj.addBuildPhase(SWIFT_FILES, "PBXSourcesBuildPhase", "Sources", target.uuid, "app_extension", TARGET);
    proj.addBuildPhase(["Assets.xcassets"], "PBXResourcesBuildPhase", "Resources", target.uuid, "app_extension", TARGET);
    proj.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);
    for (const f of [...SWIFT_FILES, "Info.plist", "CapiMessages.entitlements", "Assets.xcassets"]) {
      proj.addFile(path.join(TARGET, f), groupKey);
    }

    // 4. Build settings for the extension target
    const configurations = proj.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (typeof entry === "object" && entry.buildSettings &&
          entry.buildSettings.PRODUCT_NAME === `"${TARGET}"`) {
        Object.assign(entry.buildSettings, {
          PRODUCT_BUNDLE_IDENTIFIER: BUNDLE_ID,
          SWIFT_VERSION: "5.0",
          IPHONEOS_DEPLOYMENT_TARGET: "15.1",
          TARGETED_DEVICE_FAMILY: `"1"`,
          INFOPLIST_FILE: `${TARGET}/Info.plist`,
          CODE_SIGN_ENTITLEMENTS: `${TARGET}/CapiMessages.entitlements`,
          GENERATE_INFOPLIST_FILE: "NO",
          CURRENT_PROJECT_VERSION: "1",
          MARKETING_VERSION: "1.1.0",
          ASSETCATALOG_COMPILER_APPICON_NAME: `"iMessage App Icon"`,
          SKIP_INSTALL: "YES",
        });
      }
    }
    return config;
  });
}

function withAppGroup(config) {
  return withEntitlementsPlist(config, (config) => {
    const groups = config.modResults["com.apple.security.application-groups"] ?? [];
    if (!groups.includes(GROUP)) groups.push(GROUP);
    config.modResults["com.apple.security.application-groups"] = groups;
    return config;
  });
}

module.exports = function withMessagesExtension(config) {
  return withAppGroup(withMessagesTarget(config));
};
```

- [ ] **Step 2: Wire app.json**

In `apps/mobile/app.json`: bump `"version"` to `"1.1.0"`, add the plugin and the EAS extension declaration:
```json
"plugins": [
  "expo-router",
  "./plugins/withFmtConstevalFix",
  "./plugins/withMessagesExtension"
],
```
and inside `"extra"` (sibling of `"eas"`):
```json
"eas": {
  "projectId": "753117d3-469c-4876-964e-e174f3928bc5",
  "build": {
    "experimental": {
      "ios": {
        "appExtensions": [
          {
            "targetName": "CapiMessages",
            "bundleIdentifier": "dev.capi.app.messages",
            "entitlements": {
              "com.apple.security.application-groups": ["group.dev.capi.app"]
            }
          }
        ]
      }
    }
  }
}
```
(Keep `projectId` exactly as is; `build` is a new sibling key inside the existing `eas` object.)

- [ ] **Step 3: Gate: prebuild generates the target**

From `apps/mobile` (Node 20): `rm -rf ios && npx expo prebuild -p ios --no-install`
Expected: exits 0. Then:
`grep -c "CapiMessages" ios/Capi.xcodeproj/project.pbxproj` → a number ≥ 10.
`plutil -lint ios/CapiMessages/Info.plist` → OK.
`grep "application-groups" ios/Capi/Capi.entitlements` → present (main app got the App Group).

- [ ] **Step 4: Gate: it compiles**

`cd ios && pod install` (first time after prebuild) then:
`xcodebuild -workspace Capi.xcworkspace -scheme Capi -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14 Plus' build CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5`
Expected: `** BUILD SUCCEEDED **`. If the extension scheme is separate and the app scheme does not build it, also run the same command with `-target CapiMessages`. Any pbxproj-shape failure here gets fixed in the plugin, then `rm -rf ios && npx expo prebuild -p ios --no-install` again (never hand-edit `ios/`; it is disposable).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/plugins/withMessagesExtension.js apps/mobile/app.json
git commit -m "Mobile: config plugin adds CapiMessages iMessage target; app 1.1.0"
```

### Task 9: Simulator verification, compact flows (Messages test harness)

No new files. Local dev loop: `apps/web` dev server running (`npm run dev:web` at repo root) so DEBUG builds hit localhost.

- [ ] **Step 1: Run the extension in the Messages harness**

From `apps/mobile/ios`: `open Capi.xcworkspace`, select the **CapiMessages** scheme, run destination iPhone 14 Plus simulator. Xcode asks which host app: choose **Messages**. The simulator opens Messages with the sandbox conversation (Kate Bell).

- [ ] **Step 2: Create flow**

In the conversation, open the Capi drawer app, type nickname `Cami`, leave 1v1, tap Create.
Expected: an invite bubble appears in the thread with the Capi card image, caption "Dominoes time! 1v1" (or ES per sim locale), subcaption = 6-letter code; the extension expands showing the web game's waiting room (localhost). The dev server terminal logs `POST /api/games 200`.

- [ ] **Step 3: Join flow (other side of the sandbox)**

In the harness, switch to the recipient side (Messages test harness shows both sides of the conversation; tap the bubble as the recipient).
Expected: join card with name field; enter `Leo`, tap Join → expands into the seated game (localhost logs `POST /api/games/<id>/join 200`), and because both seats fill, the game starts. Play one move in the webview → the thread gets a refreshed bubble (score subcaption `0 - 0` then updates) and the sender-side bubble collapses under it.

- [ ] **Step 4: Live-wait cross-play check**

Open `http://localhost:3000/game/<gameId>` in the Mac browser seated as the OTHER player (use the fragment trick from Task 2 with that player's id). Keep the simulator's expanded extension open. Play a move in the browser.
Expected: the tile lands live in the simulator's webview within a second, no bubble needed. This is the 8 Ball Pool moment; if it works here it works in production because it is the same broadcast path.

- [ ] **Step 5: Session reclaim**

Close and reopen the extension from the same bubble on the creator side.
Expected: no join card; straight into the seated game (App Group session found).

### Task 10: 2v2 group-thread verification

- [ ] **Step 1: Group conversation in the harness**

The Xcode Messages sandbox conversation is 1:1, so `remoteParticipantIdentifiers.count >= 2` is false there and the 2v2 picker must be ABSENT in the create card. Verify that first.

- [ ] **Step 2: 2v2 seat mechanics via mixed clients**

Full four-party iMessage group testing needs real devices; the seat mechanics are server-side and identical from any client, so verify them with one simulator + three web tabs: in the sim create a game, but force `is2v2` by temporarily hard-coding `allow2v2: true` in `showCreate` (one-line local edit, reverted after), pick 2v2, then join with three browser tabs (Leo, Ana, Rey) via the normal join page using the bubble's code.
Expected: seats fill n, e, s, w in join order; game starts on the fourth join; the sim's webview shows the 2v2 table with partner across; play one full round mixed (sim + web tabs).

- [ ] **Step 3: Full-table card**

With the game full, tap the bubble as the harness recipient (who has no session).
Expected: join card attempts join, gets 409, and shows "The table is full".

- [ ] **Step 4: Revert the temporary `allow2v2` edit** (`git diff` must show only intended files).

### Task 11: Bubble caption polish + strings listing comment

**Files:**
- Modify: `packages/i18n/src/strings.ts` (comment only)

- [ ] **Step 1:** At the top of `packages/i18n/src/strings.ts` add:

```ts
// NOTE: apps/mobile/targets/messages/CapiStrings.swift duplicates the iMessage
// bubble captions (yourTurn/roundWon/gameWon/invites/join/create/tableFull/
// openInCapi). Bubbles render without JS, so they cannot read this file. If
// you change tone or wording here, update CapiStrings.swift to match.
```

- [ ] **Step 2:** `npm test` at repo root → 112 passed (nothing engine-side changed all milestone; this catches accidents).

- [ ] **Step 3: Commit**

```bash
git add packages/i18n/src/strings.ts
git commit -m "i18n: note the iMessage caption strings duplicated in Swift"
```

### Task 12: EAS build 1.1 with the extension + TestFlight

Preconditions: Task 4 gate passed (1.0 approved and web pushed), Tasks 8-10 verified locally.

- [ ] **Step 1: Clean the disposable native project**

From `apps/mobile`: `rm -rf ios` and `git status --porcelain` → only intended files.

- [ ] **Step 2: Push mobile work**

```bash
git push origin main
```

- [ ] **Step 3: Kick the build (Node 20, from apps/mobile)**

```bash
eas build --platform ios --profile production --non-interactive --no-wait
```
Expected: build queues; EAS provisions `dev.capi.app.messages` automatically from the `appExtensions` declaration (managed credentials; may print a one-time provisioning line for the new bundle id). Monitor with `eas build:list --limit 1`.

- [ ] **Step 4: Submit to TestFlight when finished** (Adelson runs it, promptless):

```bash
eas submit --platform ios --latest
```

- [ ] **Step 5: On-device test matrix (Adelson + one friend or second device):** create from iMessage, join from iMessage, one full 1v1 game, live-watch with the thread open on both phones, one cross-play game vs playcapi.com on a laptop, bubble collapse behavior in the real thread, and Open in Capi handoff. Watch for extension memory kills during the live-watch stretch (the expanded webview is the pressure point; if Messages evicts it, that is the signal to profile before submitting).

### Task 13: Store metadata for 1.1

**Files:**
- Modify: `docs/store-listing.md` (What's New for 1.1)
- Modify: `docs/RELEASE.md` (extension note)

- [ ] **Step 1:** Add to `docs/store-listing.md` under Version notes:

```
**Version 1.1 "What's New" (EN):**
Capi now lives in iMessage. Start a game right from your group chat: the invite is a bubble, turns update in the thread, and if you both stay at the table you watch every tile land live. 1v1 or 2v2 con tu frente.

**Versión 1.1 (ES):**
Capi ahora vive en iMessage. Empieza la partida desde el chat: la invitación es una burbuja, los turnos se actualizan en el hilo, y si se quedan en la mesa ven caer cada ficha en vivo. 1v1 o 2v2 con tu frente.
```

- [ ] **Step 2:** In `docs/RELEASE.md` add one line to the iOS section: the App Review note for 1.1 should mention the Messages extension is a companion surface of the same approved game (same server, same predefined-only chat) and reviewers can test it from the sandbox conversation.

- [ ] **Step 3: Commit**

```bash
git add docs/store-listing.md docs/RELEASE.md
git commit -m "Docs: 1.1 iMessage release notes and review-note guidance"
```

### Task 14: ship-audit

- [ ] **Step 1:** Run the ship-audit skill against the extension + embed surfaces before 1.1 goes to App Review (functional sweep in the harness, layout at compact and expanded sizes, em-dash sweep over the new strings in both languages, i18n parity of captions, copy quality).

---

## Self-review notes (fixed inline during writing)

- Spec section 5 "waiting room" flow: create no longer opens the webview immediately. It stages the invite bubble in the compose field and dismisses the extension, GamePigeon style; the creator sends it and taps the bubble to sit at the table.
- Spec's participant-UUID map simplified to gameId-keyed sessions in the App Group; the join API remains the seat arbiter and device restore preserves UserDefaults. Divergence noted against spec section 4a.
- `MSMessage.url` doubles as the desktop/no-app fallback (opens the web game), which the spec listed as App Store install prompt only; strictly better, no spec change needed.
- Caption for "moved" avoids opponent display names (Messages does not expose them to extensions); spec's example captions carried names of the mover, which the roundWon/gameWon captions still do.
- Open in Capi uses the existing `capi://` scheme instead of the spec's universal link (the app declares no associatedDomains today); same handoff, zero new config.
- Superseded (final review): the plugin no longer hardcodes versions; it reads `config.version` and `config.ios.buildNumber` from the resolved Expo config so the appex stays version-locked to the container app, including EAS remote build numbers. Bumps happen in app.json only.
- Controller keeps `currentRef`/`currentSession` state because `conversation.selectedMessage` is nil immediately after a create; without it the creator's bubble refreshes would no-op (caught in self-review).
- The bridge payload is `{type, myScore, oppScore}`, plus `iWon` on terminal events. Captions are chosen natively in `CapiStrings`, not passed from the web as a `captionKey`.
- `moved` emits on server-confirmed plays and passes, while the phase is still playing. Terminal phases emit through the winner-gated roundOver/gameOver effects instead, so a losing iMessage player never posts a bubble.
- The create card ships without color and theme pickers. avatarColor is a per-install random pick and theme is always barberia; both pickers are v1.2 candidates.
- Embed mode hides waiting-room share chrome only. The game page already has no footer or language toggle, so the spec's compact-header and external-navigation-blocking ideas were not needed for v1: no external links exist on the page.
- App Group identity is extension-only today. The RN app's AsyncStorage is not bridged to it, so sharing a nickname from app to extension is a signed-build matrix item and a v1.2 candidate.
- Post-move auto-collapse tears down the webview; re-expanding reloads the page from scratch. Accepted v1 trade-off for making the staged bubble visible.
- Known on-device matrix items: the second-game affordance when the extension process persists across activations (the drawer's live `currentRef` auto-resumes the last game), a true group-chat 2v2 picker, app-extension identity sharing on signed builds, and the memory ceiling under long live-watch.
