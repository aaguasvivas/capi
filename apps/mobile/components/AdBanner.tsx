import { useEffect, useState } from "react";
import { useEntitlements } from "../lib/entitlements";
import { initAds } from "../lib/ads";
import { ADS_CONFIGURED, BANNER_AD_UNIT_ID } from "../lib/adUnits";
import BannerSlot from "./BannerSlot";

// Drop-in banner: renders nothing until consent+init succeed, and never for
// ad-free owners (their SDK is never even initialized).
export default function AdBanner({
  onHeight,
}: {
  onHeight?: (h: number) => void;
}) {
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
