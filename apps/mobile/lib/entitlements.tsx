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
  useRef,
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
      // buyProduct rejects on cancellation and failure alike; real failures
      // already reached lastError through the onFailure callback, so this
      // path only clears the spinner and never raises its own error.
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
      (Object.values(PRODUCT_IDS) as ProductId[]).forEach((i) => next.add(i));
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

export function useEntitlements(): EntitlementsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntitlements outside EntitlementsProvider");
  return v;
}
