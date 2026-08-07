// Anchored adaptive banner slot, ported from Anota. Zero height until an ad
// actually loads (no blank reserved box), reports its height so callers can
// tighten layout, and quietly retries a failed load a few times before going
// permanently quiet. The consumer (AdBanner) decides WHETHER ads show; this
// component only owns the load/retry lifecycle for one unit id.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

const MAX_RETRIES = 5;
const RETRY_MS = 60000;

type Props = {
  unitId: string;
  onHeight?: (h: number) => void;
};

export default function BannerSlot({ unitId, onHeight }: Props) {
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exhausted = attempt > MAX_RETRIES;

  // Going permanently null never fires onLayout, so report the collapse here.
  useEffect(() => {
    if (exhausted) onHeight?.(0);
  }, [exhausted, onHeight]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );

  function scheduleRetry() {
    if (retryTimer.current) return;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setAttempt((a) => a + 1);
    }, RETRY_MS);
  }

  if (exhausted) return null;

  return (
    <View
      style={styles.slot}
      onLayout={(e) => onHeight?.(Math.round(e.nativeEvent.layout.height))}
    >
      <BannerAd
        key={attempt}
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={scheduleRetry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: "100%",
    alignItems: "center",
  },
});
