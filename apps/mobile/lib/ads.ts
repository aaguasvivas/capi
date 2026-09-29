// Google Mobile Ads bootstrap: gather consent (UMP handles the EEA form),
// request App Tracking Transparency explicitly, then start the SDK. Follows
// the same philosophy as the IAP layer: ads can fail forever and the app stays
// fully usable, and NOTHING in this chain may block forever. Every step that
// waits on the network is bounded; only the consent form and the ATT prompt
// wait for the user. A hung step degrades to no ads, never to a missing ATT
// prompt. Ported from Anota's review-hardened flow.
import { AppState, Platform } from "react-native";
import mobileAds, {
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  MaxAdContentRating,
} from "react-native-google-mobile-ads";
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
  // Dev builds run Google's SAMPLE app id, which has no UMP configuration:
  // the consent form comes up EMPTY, never loads and eats every touch (a JS
  // timeout cannot dismiss a presented sheet). Skip consent in dev; ATT and
  // initialize below still run. Production (real app id) keeps the full flow.
  if (!__DEV__) {
    try {
      // UMP fetches consent requirements from Google. On filtered or slow
      // networks (App Review environments included) this can stall; a stall
      // must not stop the ATT prompt from appearing, so this step is capped.
      await withTimeout(AdsConsent.requestInfoUpdate(), 15000);
      // Not capped: this resolves when the user closes the form, and a timer
      // here used to fire while an EEA user was still reading it, which put
      // ATT over the form and started ads before any choice. It resolves at
      // once where no form is needed, and UMP bounds the form load itself
      // (it fails with a timeout error), so it cannot hang before showing.
      await AdsConsent.loadAndShowConsentFormIfRequired();
    } catch {
      // Consent info or form unavailable (offline, blocked, no UMP message).
      // Google's rule after an error: request ads only if canRequestAds says
      // so, which the check below does.
    }
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
    // canRequestAds is false until consent was gathered where it is needed
    // (this session or an earlier one) or UMP said none is needed. Stay dark
    // otherwise; initAds forgets a dark run, so the next banner mount retries.
    // A choice made in the form, "Do not consent" included, reaches the SDK
    // on each ad request through the stored IAB TCF string. Dev skipped
    // consent above, so UMP would say false there; test ads start anyway.
    if (!__DEV__) {
      const info = await withTimeout(AdsConsent.getConsentInfo(), 5000);
      if (!info.canRequestAds) return false;
    }
    // The app is rated 4+, and Guideline 2.5.18 requires ads that fit the
    // age rating. Cap every request at G before the SDK starts; banners only
    // mount after this resolves true, so no request goes out without it. A
    // failure here stays dark rather than serving uncapped ads.
    await withTimeout(
      mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.G }),
      5000
    );
    await withTimeout(mobileAds().initialize(), 15000);
    return true;
  } catch {
    return false;
  }
}

// Google requires an in-app way to change ad consent wherever UMP says one is
// needed (EEA and UK). UMP knows that only after this session's consent info
// update, which the ads flow runs before the first banner. Ad-free owners
// never start that flow and are not asked (the store sheet skips them).
export async function adPrivacyOptionsRequired(): Promise<boolean> {
  if (!ADS_CONFIGURED) return false;
  try {
    const info = await withTimeout(AdsConsent.getConsentInfo(), 5000);
    return (
      info.privacyOptionsRequirementStatus ===
      AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
    );
  } catch {
    return false;
  }
}

// Opens UMP's privacy options form. It presents from the root view
// controller, so the caller must first close any sheet shown on top of it.
export async function showAdPrivacyOptions(): Promise<void> {
  try {
    await AdsConsent.showPrivacyOptionsForm();
  } catch {
    // Form unavailable (offline); the entry point stays for another try.
  }
}

// Idempotent: the first caller triggers the flow, everyone else awaits it.
// Without real ad unit ids the whole stack stays off. A flow that ends dark
// (offline consent fetch, SDK init timeout) forgets its promise, so the next
// banner mount retries once connectivity is back instead of staying dark for
// the rest of the session.
export async function initAds(): Promise<boolean> {
  if (!ADS_CONFIGURED) return false;
  if (!startedPromise) {
    startedPromise = start().then((ok) => {
      if (!ok) startedPromise = null;
      return ok;
    });
  }
  return startedPromise;
}
