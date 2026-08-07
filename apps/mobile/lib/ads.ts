// Google Mobile Ads bootstrap: gather consent (UMP handles the EEA form),
// request App Tracking Transparency explicitly, then start the SDK. Follows
// the same philosophy as the IAP layer: ads can fail forever and the app stays
// fully usable, and NOTHING in this chain may block forever. Every step is
// bounded; a hung step degrades to non-personalized or no ads, never to a
// missing ATT prompt. Ported from Anota's review-hardened flow.
import { AppState, Platform } from "react-native";
import mobileAds, { AdsConsent } from "react-native-google-mobile-ads";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";

import { ADS_CONFIGURED } from "./adUnits";

let startedPromise: Promise<boolean> | null = null;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`ads step timed out (${ms}ms)`)), ms);
    }),
  ]);
}

// Best-effort wait for the app to be foreground, bounded. iOS pre-warms apps
// into a background state, where an ATT request can be lost; waiting for
// "active" avoids that. But React Native's AppState is not trustworthy on
// every cold start (iPad compatibility mode can sit on "unknown" with no
// transition event ever firing, which silently hung the whole ads flow in a
// shipped Anota build). So: resolve on "active", or after maxMs, whichever
// comes first. On modern iOS a queued ATT request presents once the app is
// truly active anyway, so proceeding is always safe.
function whenActiveBounded(maxMs: number): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise((resolve) => {
    let iv: ReturnType<typeof setInterval> | null = null;
    let killer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") done();
    });
    function done() {
      if (iv) clearInterval(iv);
      if (killer) clearTimeout(killer);
      sub.remove();
      resolve();
    }
    iv = setInterval(() => {
      if (AppState.currentState === "active") done();
    }, 250);
    killer = setTimeout(done, maxMs);
  });
}

async function start(): Promise<boolean> {
  await whenActiveBounded(8000);
  let consentErrored = false;
  try {
    // UMP fetches consent requirements from Google. On filtered or slow
    // networks (App Review environments included) this can stall; a stall
    // must not stop the ATT prompt from appearing.
    await withTimeout(AdsConsent.gatherConsent(), 15000);
  } catch {
    // Consent info unavailable (offline, blocked, or no UMP message). Outside
    // the EEA ads may still serve, so fall through and let the canRequestAds
    // check decide.
    consentErrored = true;
  }
  // Apple requires the ATT prompt BEFORE any data that could track the user
  // is collected, and App Review verifies it appears. The UMP flow above only
  // triggers ATT when the AdMob console decides to (it showed nothing on US
  // devices, which is exactly what got an Anota build rejected), so ask
  // explicitly here. If UMP already asked, the status is no longer
  // "undetermined" and this is a no-op.
  if (Platform.OS === "ios") {
    try {
      await whenActiveBounded(4000);
      const { status } = await withTimeout(getTrackingPermissionsAsync(), 5000);
      if (status === "undetermined") {
        // No timeout here: this resolves when the user answers the prompt.
        await requestTrackingPermissionsAsync();
      }
    } catch {
      // ATT unavailable; ads proceed non-personalized.
    }
  }
  try {
    const info = await withTimeout(AdsConsent.getConsentInfo(), 5000);
    // Respect an explicit "no": if the consent flow completed and says ads
    // cannot be requested, stay dark. Only fail open when the flow itself
    // errored before producing an answer.
    if (!info.canRequestAds && !consentErrored) return false;
    await withTimeout(mobileAds().initialize(), 15000);
    return true;
  } catch {
    return false;
  }
}

// Idempotent: the first caller triggers the flow, everyone else awaits it.
// Without real ad unit ids the whole stack stays off.
export async function initAds(): Promise<boolean> {
  if (!ADS_CONFIGURED) return false;
  if (!startedPromise) startedPromise = start();
  return startedPromise;
}
