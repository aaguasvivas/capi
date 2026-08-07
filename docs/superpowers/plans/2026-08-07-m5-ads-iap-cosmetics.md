# M5: Ads + IAP Cosmetics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ads (AdMob banner on calm screens), the 8-product IAP catalog (remove ads + 6 cosmetics + bundle), and the cosmetic rendering (3 premium mesas on mobile+web, 3 fichas skins on mobile) so Capi 1.1 goes to review once with everything.

**Architecture:** Mobile is native RN (Expo SDK 52, CNG); all monetization lives there. Web only gains 3 CSS theme blocks so premium mesas render for every client including the iMessage webview. Entitlements are non-consumables on the Apple ID, cached in AsyncStorage, derived by a pure function. Ads and IAP wrappers are ports of Anota's shipped, review-hardened code.

**Tech Stack:** expo-iap@2.6.3 (EXACT pin; 2.7.0+ needs Kotlin 2.1, breaks SDK 52 Android; fallback react-native-iap@13.0.4 in STOREKIT2_MODE), react-native-google-mobile-ads (version chosen in Task 4 by compat check), expo-tracking-transparency, AsyncStorage, react-native-svg (already present).

**Spec:** docs/superpowers/specs/2026-08-07-m5-ads-iap-cosmetics-design.md
**Anota reference code (personal project, safe to read):** /Users/Adelson/Desktop/personal/anota
**ASC product table (user executes):** docs/m5-asc-iap-setup.md

**Ground rules for every task:**
- All expo/npm commands from `apps/mobile` under Node 20 (`PATH=/Users/Adelson/.nvm/versions/node/v20.20.0/bin:$PATH`).
- After any `npx expo prebuild`, revert the package.json scripts churn (`ios`/`android` back to `expo start --ios`/`expo start --android`).
- Never bump expo/react/react-native versions. React stays 18.3.1.
- No em dashes in any user-facing string, EN or ES.
- Commit to main after each green task. Push is allowed (1.0 is approved, deploy gate is gone), but web-affecting commits deploy to prod via Vercel; that is intended for Task 11, harmless for docs.
- Blocked-on-user inputs (do NOT wait; placeholders are wired so everything else proceeds): real AdMob iOS app id + banner unit id; the one-time interactive EAS credential run.

---

## File map

Create (mobile): `lib/iapCatalog.ts`, `lib/__tests__/iapCatalog.test.ts`, `lib/purchases.ts`, `lib/entitlements.tsx`, `lib/ads.ts`, `lib/adUnits.ts`, `lib/tileSkins.tsx`, `components/AdBanner.tsx`, `components/BannerSlot.tsx`, `components/StoreSheet.tsx`, `locales/es.json`, `vitest.config.ts`.
Modify (mobile): `theme.ts`, `components/TileDisplay.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/game/[id].tsx`, `app.json`, `package.json`.
Modify (shared/web): `packages/i18n/src/strings.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/game/[id]/page.tsx` (watermark block only).
Create (docs): `docs/m5-submission-checklist.md`; modify `docs/store-listing.md` (What's New), `docs/RELEASE.md`.

---

### Task 1: IAP catalog + entitlement derivation (pure, tested)

**Files:**
- Create: `apps/mobile/lib/iapCatalog.ts`
- Create: `apps/mobile/lib/__tests__/iapCatalog.test.ts`
- Create: `apps/mobile/vitest.config.ts`
- Modify: `apps/mobile/package.json` (devDep + test script)

- [ ] **Step 1: Add vitest to apps/mobile**

In `apps/mobile/package.json` devDependencies add `"vitest": "^2.1.0"` and in scripts add `"test": "vitest run"`. Create `apps/mobile/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["lib/__tests__/**/*.test.ts"] },
});
```

Run `npm install` from the repo root (workspaces).

- [ ] **Step 2: Write the failing test**

`apps/mobile/lib/__tests__/iapCatalog.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify it fails**

Run from `apps/mobile`: `npx vitest run`
Expected: FAIL, cannot resolve `../iapCatalog`.

- [ ] **Step 4: Implement**

`apps/mobile/lib/iapCatalog.ts` (NO react-native imports; keep pure):

```ts
// Product catalog + entitlement derivation. Pure module so it unit-tests
// without React Native. Product ids are durable identifiers approved by
// Adelson on 2026-08-07; never rename.
export const PRODUCT_IDS = {
  removeAds: "capi.remove_ads",
  mesaQuisqueya: "capi.mesa.quisqueya",
  mesaLarimar: "capi.mesa.larimar",
  mesaNoche: "capi.mesa.noche",
  fichasQuisqueya: "capi.fichas.quisqueya",
  fichasBorinquen: "capi.fichas.borinquen",
  fichasKingston: "capi.fichas.kingston",
  todo: "capi.todo",
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];
export const ALL_PRODUCT_IDS = Object.values(PRODUCT_IDS) as ProductId[];

export type PremiumMesaId = "quisqueya" | "larimar" | "noche";
export type PremiumFichasId = "quisqueya" | "borinquen" | "kingston";

const MESA_BY_PRODUCT: Partial<Record<ProductId, PremiumMesaId>> = {
  [PRODUCT_IDS.mesaQuisqueya]: "quisqueya",
  [PRODUCT_IDS.mesaLarimar]: "larimar",
  [PRODUCT_IDS.mesaNoche]: "noche",
};

const FICHAS_BY_PRODUCT: Partial<Record<ProductId, PremiumFichasId>> = {
  [PRODUCT_IDS.fichasQuisqueya]: "quisqueya",
  [PRODUCT_IDS.fichasBorinquen]: "borinquen",
  [PRODUCT_IDS.fichasKingston]: "kingston",
};

export function asProductId(v: unknown): ProductId | null {
  return typeof v === "string" && (ALL_PRODUCT_IDS as string[]).includes(v)
    ? (v as ProductId)
    : null;
}

export interface Entitlements {
  ownedIds: Set<ProductId>;
  adFree: boolean;
  mesas: Set<PremiumMesaId>;
  fichas: Set<PremiumFichasId>;
}

export function deriveEntitlements(owned: Iterable<ProductId>): Entitlements {
  const ownedIds = new Set(owned);
  const todo = ownedIds.has(PRODUCT_IDS.todo);
  const mesas = new Set<PremiumMesaId>();
  const fichas = new Set<PremiumFichasId>();
  for (const id of ownedIds) {
    const m = MESA_BY_PRODUCT[id];
    if (m) mesas.add(m);
    const f = FICHAS_BY_PRODUCT[id];
    if (f) fichas.add(f);
  }
  if (todo) {
    (["quisqueya", "larimar", "noche"] as const).forEach((m) => mesas.add(m));
    (["quisqueya", "borinquen", "kingston"] as const).forEach((f) =>
      fichas.add(f)
    );
  }
  return {
    ownedIds,
    adFree: todo || ownedIds.has(PRODUCT_IDS.removeAds),
    mesas,
    fichas,
  };
}
```

- [ ] **Step 5: Run to verify pass**

From `apps/mobile`: `npx vitest run` → all tests PASS.
Also run the existing suites to prove nothing broke: repo root `npm test` (112 pass) and `apps/web` `npx vitest run` (3 pass).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/iapCatalog.ts apps/mobile/lib/__tests__/iapCatalog.test.ts apps/mobile/vitest.config.ts apps/mobile/package.json package-lock.json
git commit -m "M5: IAP catalog + entitlement derivation with tests"
```

---

### Task 2: expo-iap 2.6.3 + purchases wrapper (Anota port)

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json` (plugins array only)
- Create: `apps/mobile/lib/purchases.ts`
- Reference: `/Users/Adelson/Desktop/personal/anota/src/iap/purchases.ts` (read it in full before writing)

- [ ] **Step 1: Install with EXACT pin**

From `apps/mobile` (Node 20): `npm install expo-iap@2.6.3 --save-exact`
Verify `package.json` shows `"expo-iap": "2.6.3"` with no caret. A caret would drift to 2.9.7 whose Billing 8/Kotlin 2.1 breaks SDK 52 Android builds.

- [ ] **Step 2: Register the plugin**

In `apps/mobile/app.json` plugins array append `"expo-iap"` (after `"./plugins/withMessagesExtension"`). No options. It is Android-only wiring; a no-op on iOS but required for the Play build.

- [ ] **Step 3: Port the wrapper**

Create `apps/mobile/lib/purchases.ts` by porting Anota's `src/iap/purchases.ts` structure with Capi's catalog and the 4.3.6→2.6.3 API mapping. Keep Anota's defensive behaviors verbatim: listeners registered BEFORE `initConnection`; 10s timeout on every store call; sku verified against a products fetch before buying; purchase settles via listeners with 120s cap; `finishTransaction({ purchase, isConsumable: false })` before granting; error listener silent unless a purchase is in flight; cancellations swallowed; grants one-way. API mapping to apply:

| Anota (expo-iap 4.3.6) | Capi (expo-iap 2.6.3) |
|---|---|
| `fetchProducts({skus, type: 'in-app'})` | `getProducts(skus)` |
| `requestPurchase({request: {apple:{sku}, google:{skus}}, type:'in-app'})` | `requestPurchase({request: {sku, skus: [sku]}, type: 'inapp'})` |
| everything else (`initConnection`, `endConnection`, `purchaseUpdatedListener`, `purchaseErrorListener`, `getAvailablePurchases`, `finishTransaction`) | identical |

Exports (exact signatures; Task 3 and 10 depend on them):

```ts
export function setPurchaseCallbacks(
  onGrant: (id: ProductId) => void,
  onFailure: (message: string) => void
): void;
export async function initIap(): Promise<boolean>;
export function endIap(): void;
export async function buyProduct(id: ProductId): Promise<void>;
export async function restoreOwned(): Promise<ProductId[]>;
export async function fetchPrices(): Promise<Map<ProductId, string>>; // id -> displayPrice
```

`fetchPrices` maps `getProducts(ALL_PRODUCT_IDS)` results through `asProductId(p.id)` and `p.displayPrice`. Purchases map through `asProductId(p.productId ?? p.id)`.

- [ ] **Step 4: Typecheck**

From `apps/mobile`: `npx tsc --noEmit`
Expected: clean (this file and everything else).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/purchases.ts apps/mobile/package.json apps/mobile/app.json package-lock.json
git commit -m "M5: expo-iap 2.6.3 (exact pin) + purchases wrapper ported from Anota"
```

---

### Task 3: Entitlements provider

**Files:**
- Create: `apps/mobile/lib/entitlements.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Implement the provider**

`apps/mobile/lib/entitlements.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deriveEntitlements,
  asProductId,
  type Entitlements,
  type ProductId,
} from "./iapCatalog";
import {
  buyProduct,
  endIap,
  fetchPrices,
  initIap,
  restoreOwned,
  setPurchaseCallbacks,
} from "./purchases";

const STORAGE_KEY = "@capi/iap_v1";

interface EntitlementsCtx {
  ent: Entitlements;
  hydrated: boolean;
  prices: Map<ProductId, string>;
  buying: ProductId | null;
  restoring: boolean;
  lastError: string | null;
  buy: (id: ProductId) => void;
  restore: () => Promise<number>; // how many owned ids came back
  clearError: () => void;
  devGrantAll: () => void; // __DEV__ only; no-op in production builds
}

const Ctx = createContext<EntitlementsCtx | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<Set<ProductId>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [prices, setPrices] = useState<Map<ProductId, string>>(new Map());
  const [buying, setBuying] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const ownedRef = useRef(owned);
  ownedRef.current = owned;

  const persist = useCallback((ids: Set<ProductId>) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])).catch(() => {});
  }, []);

  // One-way grant: never revoke on flaky network (Anota rule).
  const grant = useCallback(
    (id: ProductId) => {
      setBuying(null);
      setOwned((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    let active = true;
    setPurchaseCallbacks(grant, (message) => {
      setBuying(null);
      setLastError(message);
    });
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const ids = (JSON.parse(raw) as unknown[])
            .map(asProductId)
            .filter((v): v is ProductId => v !== null);
          setOwned(new Set(ids));
        }
      } catch {
        /* cache corrupt: restore below still recovers */
      }
      if (active) setHydrated(true);
      const ok = await initIap();
      if (!ok || !active) return;
      // Silent launch restore + price warm-up; failures leave cache as-is.
      try {
        const ids = await restoreOwned();
        if (active && ids.length) {
          setOwned((prev) => {
            const next = new Set(prev);
            ids.forEach((i) => next.add(i));
            persist(next);
            return next;
          });
        }
      } catch {}
      try {
        const p = await fetchPrices();
        if (active) setPrices(p);
      } catch {}
    })();
    return () => {
      active = false;
      endIap();
    };
  }, [grant, persist]);

  const buy = useCallback((id: ProductId) => {
    setLastError(null);
    setBuying(id);
    buyProduct(id).catch(() => {
      /* listener path owns errors; this is the sync-throw guard */
      setBuying(null);
    });
  }, []);

  const restore = useCallback(async () => {
    setLastError(null);
    setRestoring(true);
    try {
      const ids = await restoreOwned();
      if (ids.length) {
        setOwned((prev) => {
          const next = new Set(prev);
          ids.forEach((i) => next.add(i));
          persist(next);
          return next;
        });
      }
      return ids.length;
    } finally {
      setRestoring(false);
    }
  }, [persist]);

  const devGrantAll = useCallback(() => {
    if (!__DEV__) return;
    setOwned((prev) => {
      const next = new Set(prev);
      (Object.values(PRODUCT_IDS_LOCAL) as ProductId[]).forEach((i) =>
        next.add(i)
      );
      persist(next);
      return next;
    });
  }, [persist]);

  const ent = useMemo(() => deriveEntitlements(owned), [owned]);
  const value = useMemo(
    () => ({
      ent,
      hydrated,
      prices,
      buying,
      restoring,
      lastError,
      buy,
      restore,
      clearError: () => setLastError(null),
      devGrantAll,
    }),
    [ent, hydrated, prices, buying, restoring, lastError, buy, restore, devGrantAll]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Local import alias to avoid a require cycle in devGrantAll.
import { PRODUCT_IDS as PRODUCT_IDS_LOCAL } from "./iapCatalog";

export function useEntitlements(): EntitlementsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlements outside EntitlementsProvider");
  return v;
}
```

(Hoist the `PRODUCT_IDS_LOCAL` import to the top with the other imports; the comment stays.)

- [ ] **Step 2: Wire into the root layout**

`apps/mobile/app/_layout.tsx` becomes:

```tsx
import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import "../global.css";
import { I18nProvider } from "../lib/i18n";
import { EntitlementsProvider } from "../lib/entitlements";
import { SkinProvider } from "../lib/tileSkins";

export default function RootLayout() {
  return (
    <I18nProvider>
      <EntitlementsProvider>
        <SkinProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SkinProvider>
      </EntitlementsProvider>
    </I18nProvider>
  );
}
```

Note: `SkinProvider` arrives in Task 7. If executing tasks strictly in order, add only `EntitlementsProvider` now and let Task 7 add `SkinProvider`.

- [ ] **Step 3: Typecheck + tests**

`npx tsc --noEmit` clean; `npx vitest run` still green.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/entitlements.tsx apps/mobile/app/_layout.tsx
git commit -m "M5: entitlements provider (AsyncStorage cache, launch restore, one-way grants)"
```

---

### Task 4: Ads stack (Anota port) + app.json config

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json`
- Create: `apps/mobile/lib/ads.ts`, `apps/mobile/lib/adUnits.ts`, `apps/mobile/components/BannerSlot.tsx`, `apps/mobile/components/AdBanner.tsx`, `apps/mobile/locales/es.json`
- Reference: `/Users/Adelson/Desktop/personal/anota/src/ads/ads.ts`, `/Users/Adelson/Desktop/personal/anota/src/ads/BannerSlot.tsx`, `/Users/Adelson/Desktop/personal/anota/app.json` lines 43-108 (read all three in full first)

- [ ] **Step 1: Pick the ads package version by compat check**

Run: `npm view react-native-google-mobile-ads versions --json | tail -40` and for the newest 14.x and 15.x: `npm view react-native-google-mobile-ads@<v> peerDependencies`.
Acceptance: peer `react-native` range includes 0.76 AND peer `expo` (if declared) accepts 52, AND changelog/podspec does not require iOS min above 15.1 or Kotlin 2.x on Android. Choose the newest version passing all three (expected: latest 14.x or an early 15.x; Anota's 16.4.0 is for SDK 54 and will fail the check). Install exact: `npm install react-native-google-mobile-ads@<chosen> --save-exact`. Also `npx expo install expo-tracking-transparency` (expo picks the SDK 52 version).
Record the chosen version in the commit message. If NOTHING in 14.x/15.x passes, stop and surface; do not force 16.x.

- [ ] **Step 2: app.json plugin config**

In `apps/mobile/app.json` plugins array append (before `"expo-iap"` is fine, order does not matter here):

```json
["react-native-google-mobile-ads", {
  "iosAppId": "ca-app-pub-3940256099942544~1458002511",
  "userTrackingUsageDescription": "This lets Capi show ads that are more relevant to you. Your games stay on the table.",
  "skAdNetworkItems": [COPY THE FULL 50-ENTRY ARRAY VERBATIM FROM ANOTA app.json]
]],
["expo-tracking-transparency", {
  "userTrackingPermission": "This lets Capi show ads that are more relevant to you. Your games stay on the table."
}]
```

The iosAppId above is GOOGLE'S PUBLIC SAMPLE APP ID so dev/sim work before Adelson sends the real one (`ca-app-pub-4879291425090726~...`). Task 15's grep gate blocks any production build while the sample id is present.
Also add top-level `"locales": { "es": "./locales/es.json" }` inside the `expo` object, and create `apps/mobile/locales/es.json`:

```json
{
  "NSUserTrackingUsageDescription": "Esto permite que Capi muestre anuncios más relevantes para ti. Tus partidas se quedan en la mesa."
}
```

(ATT copy never says "phone"; Anota's iPad lesson.)

- [ ] **Step 3: Unit id module**

`apps/mobile/lib/adUnits.ts`:

```ts
import { TestIds } from "react-native-google-mobile-ads";

// Production unit id lands when Adelson creates the banner unit in AdMob.
// Task 15's gate greps for PENDING_ before allowing an EAS build.
const PROD_BANNER_ID = "PENDING_ADMOB_BANNER_UNIT_ID";

export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : PROD_BANNER_ID;
export const ADS_CONFIGURED = __DEV__ || !PROD_BANNER_ID.startsWith("PENDING_");
```

- [ ] **Step 4: Port ads.ts**

Create `apps/mobile/lib/ads.ts` as a line-faithful port of Anota's `src/ads/ads.ts`: memoized `initAds(): Promise<boolean>`; `whenActiveBounded(ms)` polling AppState every 250ms plus a change listener; `withTimeout` on gatherConsent (15s), getTrackingPermissionsAsync (5s), getConsentInfo (5s), initialize (15s); ATT requested explicitly only when `status === "undetermined"` and with NO timeout; explicit consent "no" returns false, a THROWN consent flow falls through to init (fail-open rule); every import from `react-native-google-mobile-ads` and `expo-tracking-transparency` as in Anota. Only rename Anota-specific comments. Add at the very top of `initAds`:

```ts
if (!ADS_CONFIGURED) return false;
```

- [ ] **Step 5: Port BannerSlot + write AdBanner**

`apps/mobile/components/BannerSlot.tsx`: line-faithful Anota port (ANCHORED_ADAPTIVE_BANNER, `key={attempt}` remount retry max 5 at 60s, `onAdFailedToLoad → scheduleRetry` guarded against double-schedule and cleared on unmount, `onLayout → onHeight`, `useEffect` firing `onHeight(0)` when disabled, permanent `null` after retries exhausted). Props: `{ unitId: string; onHeight?: (h: number) => void }`.

`apps/mobile/components/AdBanner.tsx` (the only consumer surfaces use):

```tsx
import { useEffect, useState } from "react";
import { useEntitlements } from "../lib/entitlements";
import { initAds } from "../lib/ads";
import { ADS_CONFIGURED, BANNER_AD_UNIT_ID } from "../lib/adUnits";
import BannerSlot from "./BannerSlot";

// Drop-in banner: renders nothing until consent+init succeed, and never for
// ad-free owners (their SDK is never even initialized).
export default function AdBanner({ onHeight }: { onHeight?: (h: number) => void }) {
  const { ent, hydrated } = useEntitlements();
  const [ready, setReady] = useState(false);

  const enabled = ADS_CONFIGURED && hydrated && !ent.adFree;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    initAds().then((ok) => {
      if (active) setReady(ok);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if ((!enabled || !ready) && onHeight) onHeight(0);
  }, [enabled, ready, onHeight]);

  if (!enabled || !ready) return null;
  return <BannerSlot unitId={BANNER_AD_UNIT_ID} onHeight={onHeight} />;
}
```

- [ ] **Step 6: Typecheck + commit**

`npx tsc --noEmit` clean.

```bash
git add apps/mobile/lib/ads.ts apps/mobile/lib/adUnits.ts apps/mobile/components/BannerSlot.tsx apps/mobile/components/AdBanner.tsx apps/mobile/locales/es.json apps/mobile/app.json apps/mobile/package.json package-lock.json
git commit -m "M5: ads stack ported from Anota (bounded consent, explicit ATT, adaptive banner) [rngma <chosen version>]"
```

---

### Task 5: i18n strings

**Files:**
- Modify: `packages/i18n/src/strings.ts` (interface + BOTH `es` and `en` objects)

- [ ] **Step 1: Add to the `Strings` interface** (new `// Store` section after `// Themes`):

```ts
  // Store / IAP
  store: string;
  owned: string;
  restorePurchases: string;
  restoreDone: (n: number) => string;
  purchaseFailed: string;
  removeAdsTitle: string;
  removeAdsDesc: string;
  todoCapiTitle: string;
  todoCapiDesc: string;
  privacyPolicy: string;
  fichasLabel: string;
  // Premium theme names + descs
  themeQuisqueya: string;
  themeQuisqueyaDesc: string;
  themeLarimar: string;
  themeLarimarDesc: string;
  themeNoche: string;
  themeNocheDesc: string;
  fichasClasico: string;
  fichasClasicoDesc: string;
  fichasQuisqueyaDesc: string;
  fichasBorinquenDesc: string;
  fichasKingstonDesc: string;
```

- [ ] **Step 2: ES values**

```ts
  store: "Tienda",
  owned: "Tuyo",
  restorePurchases: "Restaurar compras",
  restoreDone: (n) => (n > 0 ? "Compras restauradas" : "No hay compras que restaurar"),
  purchaseFailed: "No se pudo completar la compra",
  removeAdsTitle: "Quitar anuncios",
  removeAdsDesc: "Sin anuncios para siempre",
  todoCapiTitle: "Todo Capi",
  todoCapiDesc: "Quita los anuncios y desbloquea los 6 diseños",
  privacyPolicy: "Política de privacidad",
  fichasLabel: "Fichas",
  themeQuisqueya: "Quisqueya",
  themeQuisqueyaDesc: "Azul y oro",
  themeLarimar: "Larimar",
  themeLarimarDesc: "Piedra nacional",
  themeNoche: "Capi Noche",
  themeNocheDesc: "Neón y oro",
  fichasClasico: "Clásico",
  fichasClasicoDesc: "El de siempre",
  fichasQuisqueyaDesc: "Bandera RD",
  fichasBorinquenDesc: "Bandera PR",
  fichasKingstonDesc: "Bandera JM",
```

- [ ] **Step 3: EN values**

```ts
  store: "Store",
  owned: "Owned",
  restorePurchases: "Restore Purchases",
  restoreDone: (n) => (n > 0 ? "Purchases restored" : "No purchases to restore"),
  purchaseFailed: "Purchase could not be completed",
  removeAdsTitle: "Remove Ads",
  removeAdsDesc: "No more banner ads, forever",
  todoCapiTitle: "All of Capi",
  todoCapiDesc: "Removes ads and unlocks all 6 designs",
  privacyPolicy: "Privacy Policy",
  fichasLabel: "Tiles",
  themeQuisqueya: "Quisqueya",
  themeQuisqueyaDesc: "Navy and gold",
  themeLarimar: "Larimar",
  themeLarimarDesc: "The national stone",
  themeNoche: "Capi Noche",
  themeNocheDesc: "Neon and gold",
  fichasClasico: "Classic",
  fichasClasicoDesc: "The original",
  fichasQuisqueyaDesc: "DR flag",
  fichasBorinquenDesc: "PR flag",
  fichasKingstonDesc: "JM flag",
```

- [ ] **Step 4: Verify + commit**

Repo root `npm test` and `apps/web` `npx vitest run` green; `apps/mobile` `npx tsc --noEmit` and `apps/web` `npx tsc --noEmit` clean (interface completeness is enforced by the type).

```bash
git add packages/i18n/src/strings.ts
git commit -m "M5: store + premium design strings, ES and EN"
```

---

### Task 6: Premium mesa palettes (mobile)

**Files:**
- Modify: `apps/mobile/theme.ts`, `apps/mobile/app/game/[id].tsx` (one label color)

- [ ] **Step 1: Extend ThemePalette + THEMES**

Add `handText: string;` to `ThemePalette`. Set `handText: "#6b7280"` on barberia/colmado/patio. Extend the record key union and append:

```ts
  quisqueya: {
    pageBg: "#eef1f6",
    feltCenter: "#1d4380",
    feltMid: "#0f2b56",
    feltEdge: "#081a38",
    scoreBg: "#0a1f3f",
    scoreText: "#eef1f6",
    accent: "#c9a227",
    handBg: "#e2e8f2",
    handText: "#5a6577",
    watermark: "QUISQUEYA LA BELLA",
  },
  larimar: {
    pageBg: "#e9f2f3",
    feltCenter: "#2a7d8e",
    feltMid: "#17606f",
    feltEdge: "#0d3d47",
    scoreBg: "#0d3d47",
    scoreText: "#e9f2f3",
    accent: "#58b7c4",
    handBg: "#d9e9eb",
    handText: "#4e6b70",
    watermark: "LARIMAR",
  },
  noche: {
    pageBg: "#15152b",
    feltCenter: "#23234a",
    feltMid: "#131329",
    feltEdge: "#0a0a18",
    scoreBg: "#0a0a18",
    scoreText: "#e6e6f5",
    accent: "#6366f1",
    handBg: "#1d1d3a",
    handText: "#a5a8c9",
    watermark: "CAPI NOCHE",
  },
```

- [ ] **Step 2: Use handText**

In `apps/mobile/app/game/[id].tsx`, the "YOUR HAND" label (`fontSize: 11 ... color: "#6b7280"`) becomes `color: palette.handText`. The `isMyTurn` label already uses `palette.accent`; on `noche` verify accent #6366f1 reads on handBg #1d1d3a (it does).

- [ ] **Step 3: Typecheck + commit**

`npx tsc --noEmit` clean.

```bash
git add apps/mobile/theme.ts "apps/mobile/app/game/[id].tsx"
git commit -m "M5: quisqueya/larimar/noche palettes + theme-aware hand label"
```

---

### Task 7: Tile skins + TileDisplay integration

**Files:**
- Create: `apps/mobile/lib/tileSkins.tsx`
- Modify: `apps/mobile/components/TileDisplay.tsx`, `apps/mobile/app/_layout.tsx` (add SkinProvider if Task 3 deferred it)

- [ ] **Step 1: Skin definitions + provider**

`apps/mobile/lib/tileSkins.tsx`. Types and data:

```tsx
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TileSkinId = "clasico" | "quisqueya" | "borinquen" | "kingston";
const STORAGE_KEY = "@capi/tile_skin";

export interface TileSkin {
  id: TileSkinId;
  face: string;
  faceDouble: string;
  border: string;
  borderDouble: string;
  pipTop: [string, string, string];    // radial gradient stops, light→dark
  pipBottom: [string, string, string];
  divider: string;
  dividerDouble: string;
  spinner: string | null;              // center dot on the divider
  back: {
    bg: string;
    border: string;
    variant: "clasico" | "rd" | "pr" | "jm";
  };
}

const DRILLED: [string, string, string] = ["#3a3a3a", "#1c1c1c", "#050505"];

export const TILE_SKINS: Record<TileSkinId, TileSkin> = {
  clasico: {
    id: "clasico",
    face: "#FBF8ED", faceDouble: "#ECE4CC",
    border: "#c8bc9e", borderDouble: "#8a7d60",
    pipTop: DRILLED, pipBottom: DRILLED,
    divider: "#b8a882", dividerDouble: "#8a7d60",
    spinner: null,
    back: { bg: "#1e3a5f", border: "#0f1f35", variant: "clasico" },
  },
  quisqueya: {
    id: "quisqueya",
    face: "#f8f4ea", faceDouble: "#efe7d2",
    border: "#c9b98e", borderDouble: "#8a7d60",
    pipTop: ["#e05252", "#b71c1c", "#7f0f0f"],
    pipBottom: ["#4a6fb5", "#1d3f7a", "#0e2450"],
    divider: "#c9a227", dividerDouble: "#c9a227",
    spinner: "#c9a227",
    back: { bg: "#ffffff", border: "#8a7d60", variant: "rd" },
  },
  borinquen: {
    id: "borinquen",
    face: "#fbfbfb", faceDouble: "#f0f0f0",
    border: "#c4c4c4", borderDouble: "#8f8f8f",
    pipTop: ["#f26666", "#e4002b", "#8f0018"],
    pipBottom: ["#f26666", "#e4002b", "#8f0018"],
    divider: "#003087", dividerDouble: "#003087",
    spinner: "#003087",
    back: { bg: "#003087", border: "#001d52", variant: "pr" },
  },
  kingston: {
    id: "kingston",
    face: "#1f1f1f", faceDouble: "#151515",
    border: "#000000", borderDouble: "#3a3a3a",
    pipTop: ["#ffe066", "#fed100", "#9c7f00"],
    pipBottom: ["#ffe066", "#fed100", "#9c7f00"],
    divider: "#009b3a", dividerDouble: "#009b3a",
    spinner: "#fed100",
    back: { bg: "#141414", border: "#000000", variant: "jm" },
  },
};
```

Provider + hook (same shape as other providers): `SkinProvider` loads `STORAGE_KEY` on mount into `skinId` state (default `"clasico"`, `asTileSkinId` guard), exposes `{ skin: TILE_SKINS[skinId], skinId, setSkinId }` where `setSkinId` persists. Export `useTileSkin()`.

- [ ] **Step 2: Back renderer**

In the same file export `TileBack({ skin, width, height }: { skin: TileSkin; width: number; height: number })` returning the back View: base rounded rect (`borderRadius: 8`, bg/border from skin.back) and inside, by variant, an `react-native-svg` overlay sized to the tile:
- `clasico`: the existing inner rounded rect (port the current faceDown JSX verbatim from TileDisplay, including the small/large inner sizes).
- `rd`: full-bleed quadrants: four `Rect`s (top-left `#002d62`, top-right `#ce1126`, bottom-left `#ce1126`, bottom-right `#002d62`) each spanning 41% of width and 45.5% of height, on the white bg forming the cross; centered gold `Circle` r=8% of width, fill `#c9a227`.
- `pr`: centered flag patch 71% of width, 23% of height: white patch rect, three red `#e4002b` stripes (rows 1,3,5 of five equal rows), navy `#003087` triangle polygon from the left edge reaching 52% of patch width, white 5-point star (six-line polygon at the triangle centroid, radius 13% of patch height); thin `rgba(0,0,0,0.25)` patch outline.
- `jm`: centered flag patch 71% of width, 23% of height inside a `#fed100` 1px frame: patch bg `#1e1b18`, green `#009b3a` triangles top and bottom (apexes meeting at patch center), gold `#fed100` saltire as two lines corner to corner with strokeWidth 17% of patch height, all clipped to the patch (use `ClipPath` from react-native-svg). Green must be top/bottom and black left/right; NEVER stretch the flag to the tile aspect (spec rule, user-corrected twice).

- [ ] **Step 3: TileDisplay integration**

Modify `apps/mobile/components/TileDisplay.tsx`:
- `import { useTileSkin, TileBack } from "../lib/tileSkins";` and inside the component `const { skin } = useTileSkin();`.
- `PipHalf` gains `stops: [string, string, string]` prop; the three `Stop` colors come from it (offsets stay 0/45/100%). Top half gets `skin.pipTop`, bottom `skin.pipBottom`.
- faceDown branch returns `<TileBack skin={skin} width={width} height={height} />` (keep the outer shadow styles on a wrapping View identical to today).
- Face colors: `skin.face`/`skin.faceDouble`; borders `skin.border`/`skin.borderDouble`; divider colors `skin.divider`/`skin.dividerDouble`; keep selected/highlight overrides exactly as today.
- Spinner: when `skin.spinner` and not small, render an 8x8 `borderRadius: 4` View centered on the divider (`position: "absolute"` over it), color `skin.spinner`.
- With skin `clasico` the rendered output must be pixel-identical to today (same hexes, same drilled stops, same back). That is the regression bar.

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit` clean; `npx vitest run` green. Visual check happens in Task 13.

```bash
git add apps/mobile/lib/tileSkins.tsx apps/mobile/components/TileDisplay.tsx apps/mobile/app/_layout.tsx
git commit -m "M5: tile skins (clasico/quisqueya/borinquen/kingston) wired through TileDisplay"
```

---

### Task 8: Home screen: gated pickers, store button, banner

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Mesa picker to 6 gated cards**

Extend `TABLE_THEMES` (type union now includes premium ids):

```ts
type ThemeId = "barberia" | "colmado" | "patio" | "quisqueya" | "larimar" | "noche";

const TABLE_THEMES: { id: ThemeId; label: string; color: string; accent: string; premium?: "quisqueya" | "larimar" | "noche" }[] = [
  { id: "barberia", label: "Barbería", color: "#145228", accent: "#c0392b" },
  { id: "colmado", label: "Colmado", color: "#3a2a1a", accent: "#d4a017" },
  { id: "patio", label: "Patio", color: "#7a7268", accent: "#c4693d" },
  { id: "quisqueya", label: "Quisqueya", color: "#0f2b56", accent: "#c9a227", premium: "quisqueya" },
  { id: "larimar", label: "Larimar", color: "#17606f", accent: "#58b7c4", premium: "larimar" },
  { id: "noche", label: "Capi Noche", color: "#131329", accent: "#6366f1", premium: "noche" },
];
```

Labels for premium rows come from `s.themeQuisqueya`/`s.themeLarimar`/`s.themeNoche` and descs from the new strings (free rows keep `s.themeClassic`/`s.themeBarrio`/`s.themeOutdoors`). Render as two rows of three: change the wrapping `View` to `flexDirection: "row", flexWrap: "wrap", gap: 8` and each card to `flexBasis: "30%", flexGrow: 1`.
Gating: `const { ent, prices } = useEntitlements();` A premium card is locked when `t.premium && !ent.mesas.has(t.premium)`. Locked card: 40% opacity swatch, a 🔒 glyph, and the price line (`prices.get(productIdForMesa(t.premium)) ?? "$0.99"`); `onPress` opens the store sheet instead of selecting. Map mesa→product id with a small local helper using `PRODUCT_IDS`. Never let `theme` state hold a locked id (guard in `onPress` only; owned selection works normally and unlocking mid-session keeps state valid).

- [ ] **Step 2: Fichas picker section**

New section directly under the table section, label `s.fichasLabel`. Four cards in one row (`flexBasis: "22%"`), one per `TileSkinId` in order clasico/quisqueya/borinquen/kingston. Each card shows a mini tile swatch: a 20x40 rounded (4) View using `TILE_SKINS[id].face` with a 2px center divider of `TILE_SKINS[id].divider` and two 4x4 dots of `pipTop[1]`/`pipBottom[1]` (a tiny inline `SkinSwatch` component inside index.tsx is fine). Selection state from `useTileSkin()`: selected card gets the same border treatment as the mesa cards. Locked when the skin is premium (`id !== "clasico"`) and `!ent.fichas.has(id)`: lock glyph + price, tap opens store sheet. Owned tap: `setSkinId(id)`.

- [ ] **Step 3: Store button + sheet state**

Next to the language toggle (top-left mirror of it): a Pressable pill `🛍 {s.store}` opening `<StoreSheet visible onClose>` (component from Task 10; if executing in order, wire the state and a placeholder null render now and complete in Task 10).

- [ ] **Step 4: Banner**

Inside the root `SafeAreaView`, after the `ScrollView` (sibling, so it pins to the bottom): `<AdBanner />`. The ScrollView keeps `flexGrow: 1` content; no reserved space when no ad (Anota zero-height rule).

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit` clean.

```bash
git add apps/mobile/app/index.tsx
git commit -m "M5: gated mesa picker (6), fichas picker, store entry, home banner"
```

---

### Task 9: Waiting-room banner

**Files:**
- Modify: `apps/mobile/app/game/[id].tsx`

- [ ] **Step 1:** In the waiting-room branch only (the early return when `!gameState || gameState.phase === "waiting"`), add `<AdBanner />` as the last child of its `SafeAreaView` (below the centered card container). The active-game render path gets NOTHING; verify by searching that `AdBanner` appears exactly once in this file.

- [ ] **Step 2:** `npx tsc --noEmit` clean, then:

```bash
git add "apps/mobile/app/game/[id].tsx"
git commit -m "M5: waiting room banner (never during play)"
```

---

### Task 10: Store sheet

**Files:**
- Create: `apps/mobile/components/StoreSheet.tsx`
- Modify: `apps/mobile/app/index.tsx` (replace placeholder wiring)

- [ ] **Step 1: Implement**

`StoreSheet({ visible, onClose })`: RN `Modal` (`animationType="slide"`, `presentationStyle="pageSheet"`). Content (ScrollView):
1. Header row: `s.store` title + close ✕.
2. Hero card: `s.todoCapiTitle` + `s.todoCapiDesc` + buy button showing `prices.get("capi.todo") ?? "$4.99"`, accent `#6366f1` border like the approved mock; when `ent.ownedIds.has("capi.todo")` show `✓ {s.owned}` instead.
3. Row: `s.removeAdsTitle` / `s.removeAdsDesc` / price or owned (owned also when `ent.adFree` via todo).
4. Section MESAS: three rows (name from theme strings, desc strings, price/owned per `ent.mesas`).
5. Section FICHAS: three rows (names `Fichas {s.themeQuisqueya}` etc. reuse design names; descs `s.fichasQuisqueyaDesc` etc.; owned per `ent.fichas`).
6. `s.restorePurchases` text button → `restore()` then `Alert.alert(s.restoreDone(n))`.
7. Footer link `s.privacyPolicy` → `Linking.openURL("https://playcapi.com/privacy")`.
8. `__DEV__` only: a small gray row "DEV: grant all" calling `devGrantAll()` (compiled out of release by the `__DEV__` check).

Buy buttons: `buy(productId)`; while `buying === productId` show `ActivityIndicator`. When `lastError` is set show it once via `Alert.alert(s.purchaseFailed, lastError)` then `clearError()` (guard with a ref so it alerts once per error). Buttons for all products disabled while any `buying` is in flight.
All owned states derive from `ent`, so a mid-sheet purchase updates rows live.

- [ ] **Step 2: Wire in index.tsx** (replace Task 8's placeholder with the real component import and render).

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; `npx vitest run` green.

```bash
git add apps/mobile/components/StoreSheet.tsx apps/mobile/app/index.tsx
git commit -m "M5: store sheet (todo hero, 8 products, restore, privacy link)"
```

---

### Task 11: Web premium mesa CSS + watermarks

**Files:**
- Modify: `apps/web/src/app/globals.css`, `apps/web/src/app/game/[id]/page.tsx`

- [ ] **Step 1: Theme variable blocks** (after the `[data-theme="patio"]` block, same shape as existing):

```css
/* ── Quisqueya ────────────────────────────────────────────
   Deep navy felt with gold piping. The flag is a whisper,
   not a shout: the fichas are the show.
   ──────────────────────────────────────────────────────── */
[data-theme="quisqueya"] {
  --board-bg: #0f2b56;
  --board-felt: #1d4380;
  --page-bg: #eef1f6;
  --score-bg: #0a1f3f;
  --score-text: #eef1f6;
  --accent: #c9a227;
  --accent-light: #e0bf4d;
  --hand-bg: #e2e8f2;
}

/* ── Larimar ──────────────────────────────────────────────
   The blue-green of the national stone. Calm, elegant,
   unmistakably Dominican.
   ──────────────────────────────────────────────────────── */
[data-theme="larimar"] {
  --board-bg: #17606f;
  --board-felt: #2a7d8e;
  --page-bg: #e9f2f3;
  --score-bg: #0d3d47;
  --score-text: #e9f2f3;
  --accent: #58b7c4;
  --accent-light: #7fd0da;
  --hand-bg: #d9e9eb;
}

/* ── Capi Noche ───────────────────────────────────────────
   Near-black indigo felt, neon ring, gold details.
   The brand premium table.
   ──────────────────────────────────────────────────────── */
[data-theme="noche"] {
  --board-bg: #131329;
  --board-felt: #23234a;
  --page-bg: #15152b;
  --score-bg: #0a0a18;
  --score-text: #e6e6f5;
  --accent: #6366f1;
  --accent-light: #8b8df5;
  --hand-bg: #1d1d3a;
}
```

- [ ] **Step 2: Patterns, felts, light overlays, hand textures** (append to each corresponding section, mirroring the structure of the three existing themes):

```css
[data-theme="quisqueya"].theme-pattern {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 26px,
    rgba(201, 162, 39, 0.07) 26px,
    rgba(201, 162, 39, 0.07) 28px
  );
}
[data-theme="larimar"].theme-pattern {
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 18px,
    rgba(23, 96, 111, 0.08) 18px,
    rgba(23, 96, 111, 0.08) 20px
  );
}
[data-theme="noche"].theme-pattern {
  background-image: radial-gradient(
    circle,
    rgba(212, 175, 55, 0.06) 1px,
    transparent 1px
  );
  background-size: 26px 26px;
}

[data-theme="quisqueya"] .theme-felt {
  background-color: #0f2b56;
  background-image:
    var(--felt-grain),
    radial-gradient(ellipse at 50% 40%, #1d4380 0%, #0f2b56 52%, #081a38 100%);
  background-size: 160px 160px, 100% 100%;
}
[data-theme="larimar"] .theme-felt {
  background-color: #17606f;
  background-image:
    var(--felt-grain),
    radial-gradient(ellipse at 50% 40%, #2a7d8e 0%, #17606f 52%, #0d3d47 100%);
  background-size: 160px 160px, 100% 100%;
}
[data-theme="noche"] .theme-felt {
  background-color: #131329;
  background-image:
    var(--felt-grain),
    radial-gradient(ellipse at 50% 40%, #23234a 0%, #131329 52%, #0a0a18 100%);
  background-size: 160px 160px, 100% 100%;
}

[data-theme="quisqueya"] .theme-light {
  background: radial-gradient(
    ellipse at 50% 40%,
    rgba(200, 215, 245, 0.04) 0%,
    rgba(3, 8, 22, 0.14) 100%
  );
}
[data-theme="larimar"] .theme-light {
  background: radial-gradient(
    ellipse at 50% 42%,
    rgba(215, 240, 244, 0.05) 0%,
    rgba(4, 18, 22, 0.13) 100%
  );
}
[data-theme="noche"] .theme-light {
  background: radial-gradient(
    ellipse at 50% 40%,
    rgba(139, 141, 245, 0.05) 0%,
    rgba(4, 4, 12, 0.20) 100%
  );
}

[data-theme="quisqueya"] .theme-hand-texture {
  background-image: linear-gradient(
    to bottom,
    rgba(15, 43, 86, 0.06) 0%,
    transparent 50%
  );
}
[data-theme="larimar"] .theme-hand-texture {
  background-image: linear-gradient(
    to bottom,
    rgba(23, 96, 111, 0.07) 0%,
    transparent 50%
  );
}
[data-theme="noche"] .theme-hand-texture {
  background-image: linear-gradient(
    to bottom,
    rgba(99, 102, 241, 0.06) 0%,
    transparent 50%
  );
}
```

- [ ] **Step 3: Watermarks**

In `apps/web/src/app/game/[id]/page.tsx`, find the watermark block containing `{gameState.theme === "barberia" && "BARBERÍA DON RAMÓN"}` and its colmado/patio siblings; add:

```tsx
{gameState.theme === "quisqueya" && "QUISQUEYA LA BELLA"}
{gameState.theme === "larimar" && "LARIMAR"}
{gameState.theme === "noche" && "CAPI NOCHE"}
```

- [ ] **Step 4: Local verify**

`npm run dev:web`, then create one game per new theme against localhost (`curl -s -X POST http://localhost:3000/api/games -H 'Content-Type: application/json' -d '{"nickname":"T","theme":"quisqueya"}'` etc.), open each game URL in a browser, and confirm: page background/pattern, felt gradient, score bar colors, watermark text, and that `noche` (dark page) keeps the waiting-room card readable. Also `npx vitest run` and `npx tsc --noEmit` in apps/web.
Web's CreateGameForm intentionally still offers only the 3 free themes (no purchases on web in 1.1); do not touch it.

- [ ] **Step 5: Commit** (this deploys to prod on push; that is safe and intended):

```bash
git add apps/web/src/app/globals.css "apps/web/src/app/game/[id]/page.tsx"
git commit -m "M5: quisqueya/larimar/noche web themes (all clients render premium mesas)"
```

---

### Task 12: Build gate

- [ ] **Step 1:** From `apps/mobile` (Node 20): `npx expo prebuild -p ios --no-install`, then revert the package.json scripts churn.
- [ ] **Step 2:** `xcodebuild -workspace ios/Capi.xcworkspace -scheme Capi -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14 Plus' -derivedDataPath build build CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5` → `BUILD SUCCEEDED`. This proves the ads pods, expo-iap pod, and the Messages extension all compile together on SDK 52.
- [ ] **Step 3:** Verify the generated `ios/Capi/Info.plist` contains `GADApplicationIdentifier` (sample id for now), `NSUserTrackingUsageDescription`, `SKAdNetworkItems` (50 entries), and that `ios/CapiMessages/` still builds into `Capi.app/PlugIns/CapiMessages.appex`.
- [ ] **Step 4:** All suites: root `npm test`, apps/web `npx vitest run`, apps/mobile `npx vitest run`, both tsc runs. All green.
- [ ] **Step 5:** Commit anything the gate required fixing; message `"M5: build gate fixes"` (or skip commit if clean).

---

### Task 13: Simulator verification pass

Use the loop from project memory (prebuild → xcodebuild → `xcrun simctl install` → drive via the simulator MCP; coordinates are device points, 428x926 on iPhone 14 Plus).

- [ ] Home: 6 mesa cards render in 2 rows, 3 premium locked (lock + price), fichas row 4 cards, store button opens the sheet, TEST banner renders at the bottom (Google test creative), no layout overlap with the join-code field + keyboard.
- [ ] Store sheet: all 8 rows, prices show "$0.99"-style placeholders or store prices (sim has no ASC connection: rows must degrade to the fallback price strings, buttons enabled, purchase attempt shows the in-flight spinner then the failure alert exactly once).
- [ ] DEV grant-all: tap it; locked cards unlock live, banner disappears (adFree), mesa `noche` selectable, create a game with it.
- [ ] Fichas: select kingston; in a 1v1 game vs a second sim client or web localhost, verify: own hand faces black/gold, board tiles skinned, opponent hand backs show the JM patch (green top/bottom, black sides, gold saltire, nothing stretched), and the web opponent still sees classic tiles (local-view semantics).
- [ ] Waiting room: banner present; start the game; banner gone during play; round-over and game-over overlays ad-free.
- [ ] Reset: `simctl` erase or reinstall, verify entitlements come back empty (no leakage from AsyncStorage of the dev grant after erase) and clasico renders pixel-identical to 1.0 (screenshot compare vs a 1.0 screenshot of the same board).
- [ ] iMessage extension quick regression: open Capi in sandbox Messages, create an invite, expanded view loads (extension untouched but shares the binary).
- [ ] Commit any fixes; message `"M5: sim pass fixes"`.

---### Task 14: Deploy web + prod verification

- [ ] `git push origin main`; wait for the Vercel deploy (poll the landing chunk hash change).
- [ ] Create one prod game per premium theme via `POST https://playcapi.com/api/games` with `{"nickname":"T","theme":"<id>"}`; open each in the browser pane; verify felts/watermarks/score bars, and `noche` readability. Verify a plain barberia game is unchanged (1.0 regression bar).
- [ ] Verify one embed URL (`?embed=imessage&lang=es#s=<playerId>.<seat>`) on a `larimar` game: theme renders inside the embed chrome rules.

---

### Task 15: Release docs + user handoff gate

**Files:**
- Create: `docs/m5-submission-checklist.md`
- Modify: `docs/store-listing.md` (1.1 What's New replaces the iMessage-only draft), `docs/RELEASE.md` (1.1 section)

- [ ] **Step 1:** Rewrite the 1.1 What's New (EN + ES) in `docs/store-listing.md` to cover: play in iMessage, premium tables, tile designs, remove ads. Keep Dominican voice, no em dashes.
- [ ] **Step 2:** Write `docs/m5-submission-checklist.md`, the foolproof ordered list:
  1. My gates (already scripted): grep `PENDING_ADMOB` and `3940256099942544` return NOTHING in apps/mobile (real AdMob ids landed); all suites green; sim pass done; prod web verified.
  2. User: interactive EAS credential run done once (CapiMessages profile exists).
  3. Me: `eas build --platform ios --profile production --non-interactive --no-wait` from apps/mobile.
  4. User in ASC: create the 8 IAPs per docs/m5-asc-iap-setup.md (if not already), attach ALL 8 to the 1.1 version ("In-App Purchases" section of the version page), upload the IAP review screenshots I generate from the store sheet.
  5. User in ASC App Privacy (adds to the existing Name/Gameplay/Support entries): Identifiers → Device ID → used for Advertising, Tracking YES; Usage Data → Product Interaction + Advertising Data → Advertising; Diagnostics → Crash + Performance. Age rating question about ads: YES. ATT is in the binary.
  6. User: What's New EN + ES pasted; iMessage screenshot section (if ASC shows it, I generate from the sim).
  7. TestFlight matrix (two phones): full iMessage flow, sandbox purchase of `capi.todo` on phone A (banner disappears, all designs unlock), individual purchase + Restore Purchases on phone B after reinstall, premium mesa visible to a web opponent, fichas local-view confirmed, banner shows on home/waiting for a no-purchase account with ATT prompt appearing exactly once.
  8. Submit 1.1 for review with the 8 IAPs attached.
- [ ] **Step 3:** Update `docs/RELEASE.md` 1.1 paragraph: iMessage + ads + IAP in one review; note the expo-iap 2.6.3 exact-pin rule and the AdMob id gate.
- [ ] **Step 4:** Commit: `"M5: submission checklist + 1.1 What's New"`; push.

---

### Blocked-on-user swap task (runs whenever the ids arrive)

- [ ] Replace in `apps/mobile/app.json`: sample `iosAppId` → real `ca-app-pub-4879291425090726~...`.
- [ ] Replace in `apps/mobile/lib/adUnits.ts`: `PENDING_ADMOB_BANNER_UNIT_ID` → real `ca-app-pub-4879291425090726/...`.
- [ ] Prebuild + sim smoke (banner still renders with TestIds in dev), commit `"M5: real AdMob ids"`.

## Self-review notes

- Spec coverage: ads placement/consent (T4, T8, T9), IAP catalog/restore/store (T1, T2, T3, T10), mesas mobile+web (T6, T8, T11), fichas + flag accuracy (T7), sequencing web-first (T14 before EAS in T15), ASC choreography (T15 + docs/m5-asc-iap-setup.md), old-binary fallback (already verified in code, no task needed). Out-of-scope items from the spec have no tasks, correct.
- Type consistency: `ProductId`/`Entitlements`/`useEntitlements`/`useTileSkin`/`AdBanner` signatures match across T1/T3/T4/T7/T8/T10.
- The only intentionally decision-deferred step is the react-native-google-mobile-ads version (T4 Step 1), which carries its own acceptance criteria and stop condition.
