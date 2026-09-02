// Entitlements provider: owns the set of purchased product ids, cached in
// AsyncStorage and reconciled against the store at launch. Grants are one-way
// (a flaky network can never revoke an unlock). UI reads everything through
// useEntitlements().
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  asProductId,
  deriveEntitlements,
  PRODUCT_IDS,
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
  type PurchaseFailure,
} from "./purchases";

const STORAGE_KEY = "@capi/iap_v1";

// A fresh install of an ad-free buyer must not flash a banner before the
// launch restore answers, but a wedged store must not hold ads back forever.
const RECONCILE_CAP_MS = 3000;

// i18n key for the purchase failure alert. The store layer only emits stable
// codes; raw store strings stay in the console.
export type PurchaseErrorKey =
  | "purchaseErrorProduct"
  | "purchaseErrorStore"
  | "purchaseFailed";

const ERROR_KEYS: Record<PurchaseFailure, PurchaseErrorKey> = {
  "product-unavailable": "purchaseErrorProduct",
  "store-unavailable": "purchaseErrorStore",
  failed: "purchaseFailed",
};

interface EntitlementsCtx {
  ent: Entitlements;
  hydrated: boolean;
  // True once the launch restore settled (either way) or the cap elapsed.
  reconciled: boolean;
  prices: Map<ProductId, string>;
  buying: ProductId | null;
  restoring: boolean;
  lastError: PurchaseErrorKey | null;
  buy: (id: ProductId) => Promise<boolean>; // true once the store confirmed
  restore: () => Promise<number | null>; // owned ids found; null: unreachable
  refreshPrices: () => Promise<void>;
  clearError: () => void;
  devGrantAll: () => void; // __DEV__ only; no-op in production builds
}

const Ctx = createContext<EntitlementsCtx | null>(null);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const [owned, setOwned] = useState<Set<ProductId>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [prices, setPrices] = useState<Map<ProductId, string>>(new Map());
  const [buying, setBuying] = useState<ProductId | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [lastError, setLastError] = useState<PurchaseErrorKey | null>(null);

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

  const grantAll = useCallback(
    (ids: ProductId[]) => {
      if (!ids.length) return;
      setOwned((prev) => {
        const next = new Set(prev);
        ids.forEach((i) => next.add(i));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  useEffect(() => {
    let active = true;
    setPurchaseCallbacks(grant, (code) => {
      setBuying(null);
      setLastError(ERROR_KEYS[code]);
    });
    const cap = setTimeout(() => {
      if (active) setReconciled(true);
    }, RECONCILE_CAP_MS);
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
      if (!ok || !active) {
        if (active) setReconciled(true);
        return;
      }
      // Silent launch restore + price warm-up; failures leave cache as-is.
      const ids = await restoreOwned();
      if (!active) return;
      if (ids) grantAll(ids);
      setReconciled(true);
      const p = await fetchPrices();
      if (active && p.size) setPrices(p);
    })();
    return () => {
      active = false;
      clearTimeout(cap);
      endIap();
    };
  }, [grant, grantAll]);

  const buy = useCallback(async (id: ProductId) => {
    setLastError(null);
    setBuying(id);
    try {
      await buyProduct(id);
      return true;
    } catch {
      // buyProduct rejects on cancellation and failure alike; real failures
      // already reached lastError through the onFailure callback, so this
      // path only clears the spinner and never raises its own error.
      setBuying(null);
      return false;
    }
  }, []);

  const restore = useCallback(async () => {
    setLastError(null);
    setRestoring(true);
    try {
      const ids = await restoreOwned();
      if (ids === null) return null;
      grantAll(ids);
      return ids.length;
    } finally {
      setRestoring(false);
    }
  }, [grantAll]);

  const refreshPrices = useCallback(async () => {
    const p = await fetchPrices();
    if (p.size) setPrices(p);
  }, []);

  const devGrantAll = useCallback(() => {
    if (!__DEV__) return;
    grantAll(Object.values(PRODUCT_IDS) as ProductId[]);
  }, [grantAll]);

  const ent = useMemo(() => deriveEntitlements(owned), [owned]);
  const value = useMemo(
    () => ({
      ent,
      hydrated,
      reconciled,
      prices,
      buying,
      restoring,
      lastError,
      buy,
      restore,
      refreshPrices,
      clearError: () => setLastError(null),
      devGrantAll,
    }),
    [
      ent,
      hydrated,
      reconciled,
      prices,
      buying,
      restoring,
      lastError,
      buy,
      restore,
      refreshPrices,
      devGrantAll,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): EntitlementsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlements outside EntitlementsProvider");
  return v;
}
