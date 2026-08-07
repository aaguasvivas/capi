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
