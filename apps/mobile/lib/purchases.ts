// Native in-app purchase wrapper for Capi's one-time unlocks (remove ads,
// premium mesas, fichas skins, todo bundle), built on expo-iap 2.6.3 (exact
// pin; 2.7.0+ needs Kotlin 2.1 and breaks SDK 52 Android). Ported from
// Anota's review-hardened wrapper. No purchase server: ownership is read back
// from the store.
//
// The purchase RESULT is delivered through the event listeners, not the return
// value of requestPurchase. buyProduct fires the purchase and settles when a
// listener reports success or failure. Every store call has a timeout so a
// wedged connection can never freeze the app.
import {
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  getProducts,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from "expo-iap";

import { ALL_PRODUCT_IDS, asProductId, type ProductId } from "./iapCatalog";

let updateSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;
let connected = false;

// Last raw store error seen, for the console only. Raw store strings never
// reach the UI: failures surface as one of the stable codes below and the
// entitlements layer maps those to translated copy.
let lastStoreError = "";

// "product-unavailable": the store has no record of the product. That is a
// configuration problem (App Store Connect), not a payment failure; Anota
// chased the generic message for two review cycles before learning this.
// "store-unavailable": the connection could not be opened at all.
// "failed": the store reported an error while a purchase was in flight.
export type PurchaseFailure =
  | "product-unavailable"
  | "store-unavailable"
  | "failed";

// When a purchase is in flight, the listeners settle this resolver. Only the
// product being bought settles it; ownership of anything else that arrives
// (say, a restore racing in) still reaches the app through onOwned.
let pendingBuy: { sku: ProductId; settle: (owned: boolean) => void } | null =
  null;
function settleBuy(sku: ProductId | null, owned: boolean) {
  if (!pendingBuy) return;
  if (sku !== null && pendingBuy.sku !== sku) return;
  const { settle } = pendingBuy;
  pendingBuy = null;
  settle(owned);
}

// App-level hooks so a purchase result reaches entitlement state and the user
// even when the store sheet has been dismissed to let StoreKit present.
let onOwned: ((id: ProductId) => void) | null = null;
let onPurchaseError: ((code: PurchaseFailure) => void) | null = null;
export function setPurchaseCallbacks(
  onGrant: (id: ProductId) => void,
  onFailure: (code: PurchaseFailure) => void
): void {
  onOwned = onGrant;
  onPurchaseError = onFailure;
}

function reportFailure(code: PurchaseFailure): void {
  console.warn(`[iap] ${code}`, lastStoreError);
  onPurchaseError?.(code);
}

function purchasedId(purchase: unknown): ProductId | null {
  const p = purchase as { productId?: unknown; id?: unknown } | null;
  return asProductId(p?.productId) ?? asProductId(p?.id);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} (${ms}ms)`)), ms);
    }),
  ]);
}

async function ensureConnected(): Promise<void> {
  if (connected) return;
  await withTimeout(Promise.resolve(initConnection()), 10000, "initConnection");
  connected = true;
}

export async function initIap(): Promise<boolean> {
  try {
    // Register listeners BEFORE connecting. They do not need an open
    // connection, and if initConnection is slow or times out we must not be
    // left with zero listeners: a purchase would then be unable to either
    // succeed or report failure.
    updateSub = purchaseUpdatedListener(async (purchase) => {
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Non-fatal; ownership is still confirmed below.
      }
      const id = purchasedId(purchase);
      if (id) {
        settleBuy(id, true);
        onOwned?.(id);
      }
    });
    errorSub = purchaseErrorListener((error) => {
      const code = String(error?.code ?? "");
      const message = String(error?.message ?? "");
      lastStoreError = code ? `${code}: ${message}` : message;
      // This native event carries EVERY store error, not just purchase ones:
      // catalog lookups ("query-product"), unavailable store, and so on. Only
      // an error while a purchase is actually in flight belongs in front of
      // the user; anything else used to pop a bogus "purchase failed" alert
      // (which is what App Review saw on Anota).
      if (!pendingBuy) return;
      // Any error, including user cancellation, ends the in-flight buy.
      settleBuy(null, false);
      const cancelled = /cancel/i.test(code) || /cancel/i.test(message);
      if (!cancelled) reportFailure("failed");
    });
    await ensureConnected();
    return true;
  } catch {
    // Store unavailable; the app stays fully usable for free.
    return false;
  }
}

export function endIap(): void {
  try {
    updateSub?.remove();
    errorSub?.remove();
    updateSub = null;
    errorSub = null;
    connected = false;
    endConnection().catch(() => {});
  } catch {
    // ignore
  }
}

export async function fetchPrices(): Promise<Map<ProductId, string>> {
  const prices = new Map<ProductId, string>();
  try {
    await ensureConnected();
    const products = await withTimeout(
      getProducts(ALL_PRODUCT_IDS),
      10000,
      "getProducts"
    );
    for (const p of products ?? []) {
      const id = asProductId(p?.id);
      const price = p?.displayPrice;
      if (id && typeof price === "string") prices.set(id, price);
    }
  } catch (e) {
    // Prices stay empty; the UI shows a neutral "see price" pill instead.
    console.warn("[iap] getProducts failed", e);
  }
  return prices;
}

// Owned product ids as the store reports them. null means the store could not
// be reached (offline, timeout, no connection); an empty array means it
// answered and the account owns nothing.
export async function restoreOwned(): Promise<ProductId[] | null> {
  try {
    await ensureConnected();
    const purchases = await withTimeout(
      getAvailablePurchases(),
      10000,
      "getAvailablePurchases"
    );
    const owned = new Set<ProductId>();
    for (const p of purchases ?? []) {
      const id = purchasedId(p);
      if (id) owned.add(id);
    }
    return [...owned];
  } catch (e) {
    console.warn("[iap] getAvailablePurchases failed", e);
    return null;
  }
}

export async function buyProduct(id: ProductId): Promise<void> {
  try {
    await ensureConnected();
  } catch (e) {
    // The entitlements provider treats a rejection as a silent spinner-clear;
    // a dead store connection deserves the failure alert, so report it too.
    reportFailure("store-unavailable");
    throw e;
  }
  // Confirm the store actually knows this product before trying to buy it.
  // If it does not (missing or incomplete App Store Connect configuration,
  // or the product has not propagated yet), requestPurchase fails with an
  // opaque "Unable to Complete Request"; surfacing that as a payment error
  // sent Anota chasing the wrong bug for two review cycles.
  let known = false;
  try {
    const products = await withTimeout(
      getProducts([id]),
      10000,
      "getProducts"
    );
    known = (products ?? []).some((p) => p?.id === id);
  } catch {
    // Lookup failed outright (offline, store down). Fall through and let the
    // purchase attempt decide rather than blocking a possibly-fine buy.
    known = true;
  }
  if (!known) {
    reportFailure("product-unavailable");
    throw new Error("product-unavailable");
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      pendingBuy = null;
      reject(new Error("TIMEOUT: purchase settle (120000ms)"));
    }, 120000);
    pendingBuy = {
      sku: id,
      settle: (owned: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Failures and cancellations reject so the provider's catch clears
        // the in-flight state; user-facing messaging already went through
        // onPurchaseError (cancellations stay silent by design).
        if (owned) resolve();
        else reject(new Error("purchase-not-completed"));
      },
    };
    // Fire the purchase; the result arrives via the listeners in initIap.
    // 2.6.3 flat request: iOS reads sku, Android reads skus.
    Promise.resolve(
      requestPurchase({
        request: { sku: id, skus: [id] },
        type: "inapp",
      })
    ).catch(() => settleBuy(id, false));
  });
}
