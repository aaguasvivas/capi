import { beforeEach, describe, expect, it, vi } from "vitest";

// expo-iap is a native module; these tests drive the wrapper against a fake
// that behaves like expo-iap 2.6.3 on iOS: a failed buy arrives only as a
// requestPurchase rejection, with no error event.
const iap = vi.hoisted(() => {
  const listeners: {
    updated: ((p: unknown) => void) | null;
    error: ((e: unknown) => void) | null;
  } = { updated: null, error: null };
  return {
    listeners,
    initConnection: vi.fn(() => true),
    endConnection: vi.fn(async () => true),
    finishTransaction: vi.fn(async () => undefined),
    getAvailablePurchases: vi.fn(),
    getProducts: vi.fn(),
    requestPurchase: vi.fn(),
    purchaseUpdatedListener: vi.fn((cb: (p: unknown) => void) => {
      listeners.updated = cb;
      return { remove: () => {} };
    }),
    purchaseErrorListener: vi.fn((cb: (e: unknown) => void) => {
      listeners.error = cb;
      return { remove: () => {} };
    }),
  };
});
vi.mock("expo-iap", () => iap);

import {
  buyErrorOutcome,
  buyProduct,
  initIap,
  ownedFromPurchases,
  restoreOwned,
  setPurchaseCallbacks,
} from "../purchases";
import { PRODUCT_IDS } from "../iapCatalog";

function storeError(code: string, message = "") {
  return Object.assign(new Error(message), { code });
}

describe("buyErrorOutcome", () => {
  it("stays silent when the user cancels", () => {
    expect(buyErrorOutcome(storeError("E_USER_CANCELLED"))).toBeNull();
    expect(buyErrorOutcome({ message: "User canceled the purchase" })).toBeNull();
  });

  it("reports Ask to Buy as deferred, not as a failure", () => {
    expect(buyErrorOutcome(storeError("E_DEFERRED_PAYMENT"))).toBe("deferred");
  });

  it("reports every other store error as a failure", () => {
    expect(buyErrorOutcome(storeError("E_PURCHASE_ERROR", "Purchase failed"))).toBe(
      "failed"
    );
    expect(buyErrorOutcome(storeError("E_SERVICE_ERROR"))).toBe("failed");
    expect(buyErrorOutcome(undefined)).toBe("failed");
  });
});

describe("ownedFromPurchases", () => {
  it("drops revoked purchases but keeps a later repurchase", () => {
    const owned = ownedFromPurchases([
      { id: PRODUCT_IDS.mesaNoche, revocationDateIos: 1700000000000 },
      { id: PRODUCT_IDS.todo, revocationDateIos: 1700000000000 },
      { id: PRODUCT_IDS.todo, revocationDateIos: null },
      { productId: PRODUCT_IDS.removeAds },
    ]);
    expect(owned.sort()).toEqual([PRODUCT_IDS.removeAds, PRODUCT_IDS.todo].sort());
  });

  it("ignores unknown ids and duplicates", () => {
    expect(
      ownedFromPurchases([
        { id: "dev.other.app" },
        null,
        { id: PRODUCT_IDS.fichasKingston },
        { id: PRODUCT_IDS.fichasKingston },
      ])
    ).toEqual([PRODUCT_IDS.fichasKingston]);
  });
});

describe("restoreOwned", () => {
  beforeEach(() => {
    iap.getAvailablePurchases.mockReset();
    iap.getProducts.mockClear();
  });

  it("reads the full history, so owned items do not depend on the product cache", async () => {
    // Fresh install: nothing has called getProducts yet.
    iap.getAvailablePurchases.mockResolvedValue([{ id: PRODUCT_IDS.todo }]);
    await expect(restoreOwned()).resolves.toEqual([PRODUCT_IDS.todo]);
    expect(iap.getProducts).not.toHaveBeenCalled();
    expect(iap.getAvailablePurchases).toHaveBeenCalledWith({
      onlyIncludeActiveItems: false,
    });
  });

  it("returns null when the store cannot answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    iap.getAvailablePurchases.mockRejectedValue(new Error("offline"));
    await expect(restoreOwned()).resolves.toBeNull();
  });
});

describe("buyProduct outcomes", () => {
  const onGrant = vi.fn();
  const onFailure = vi.fn();
  const id = PRODUCT_IDS.removeAds;

  beforeEach(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    onGrant.mockReset();
    onFailure.mockReset();
    iap.requestPurchase.mockReset();
    iap.getProducts.mockResolvedValue([{ id }]);
    setPurchaseCallbacks(onGrant, onFailure);
    await initIap();
  });

  it("an iOS store failure (rejection only) shows the failure alert", async () => {
    iap.requestPurchase.mockRejectedValue(
      storeError("E_PURCHASE_ERROR", "Purchase failed: network")
    );
    await expect(buyProduct(id)).rejects.toThrow();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith("failed");
  });

  it("an iOS cancel stays silent", async () => {
    iap.requestPurchase.mockRejectedValue(storeError("E_USER_CANCELLED"));
    await expect(buyProduct(id)).rejects.toThrow();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("an iOS Ask to Buy request reports deferred", async () => {
    iap.requestPurchase.mockRejectedValue(
      storeError("E_DEFERRED_PAYMENT", "The payment was deferred")
    );
    await expect(buyProduct(id)).rejects.toThrow();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith("deferred");
    expect(onGrant).not.toHaveBeenCalled();
  });

  it("an Android error event followed by the rejection alerts once", async () => {
    const err = storeError("E_UNKNOWN", "billing unavailable");
    iap.requestPurchase.mockImplementation(() => {
      iap.listeners.error?.(err);
      return Promise.reject(err);
    });
    await expect(buyProduct(id)).rejects.toThrow();
    await Promise.resolve();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith("failed");
  });

  it("a successful purchase still settles through the listener", async () => {
    iap.requestPurchase.mockImplementation(async () => {
      iap.listeners.updated?.({ id });
    });
    await expect(buyProduct(id)).resolves.toBeUndefined();
    await vi.waitFor(() => expect(onGrant).toHaveBeenCalledWith(id));
    expect(onFailure).not.toHaveBeenCalled();
  });
});
