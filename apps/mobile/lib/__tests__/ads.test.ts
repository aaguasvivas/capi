import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fakes for the native modules the ads bootstrap talks to. The consent calls
// follow react-native-google-mobile-ads 14.11.0: loadAndShowConsentFormIfRequired
// resolves only when the user closes the form.
const m = vi.hoisted(() => ({
  requestInfoUpdate: vi.fn(),
  loadAndShowConsentFormIfRequired: vi.fn(),
  getConsentInfo: vi.fn(),
  showPrivacyOptionsForm: vi.fn(),
  initialize: vi.fn(),
  setRequestConfiguration: vi.fn(),
  getTrackingPermissionsAsync: vi.fn(),
  requestTrackingPermissionsAsync: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
  Platform: { OS: "ios" },
}));
vi.mock("react-native-google-mobile-ads", () => ({
  default: () => ({
    initialize: m.initialize,
    setRequestConfiguration: m.setRequestConfiguration,
  }),
  MaxAdContentRating: { G: "G", PG: "PG", T: "T", MA: "MA" },
  AdsConsent: {
    requestInfoUpdate: m.requestInfoUpdate,
    loadAndShowConsentFormIfRequired: m.loadAndShowConsentFormIfRequired,
    getConsentInfo: m.getConsentInfo,
    showPrivacyOptionsForm: m.showPrivacyOptionsForm,
  },
  AdsConsentPrivacyOptionsRequirementStatus: {
    UNKNOWN: "UNKNOWN",
    REQUIRED: "REQUIRED",
    NOT_REQUIRED: "NOT_REQUIRED",
  },
}));
vi.mock("expo-tracking-transparency", () => ({
  getTrackingPermissionsAsync: m.getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync: m.requestTrackingPermissionsAsync,
}));
vi.mock("../adUnits", () => ({ ADS_CONFIGURED: true }));

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

type AdsModule = typeof import("../ads");
let ads: AdsModule;

beforeEach(async () => {
  vi.useFakeTimers();
  for (const fn of Object.values(m)) fn.mockReset();
  m.requestInfoUpdate.mockResolvedValue({});
  m.loadAndShowConsentFormIfRequired.mockResolvedValue({});
  m.getConsentInfo.mockResolvedValue({ canRequestAds: true });
  m.initialize.mockResolvedValue([]);
  m.setRequestConfiguration.mockResolvedValue(undefined);
  m.getTrackingPermissionsAsync.mockResolvedValue({ status: "undetermined" });
  m.requestTrackingPermissionsAsync.mockResolvedValue({ status: "denied" });
  // initAds keeps its first successful run for the session; each test gets a
  // fresh module. (importActual, not import(): the app tsconfig has no
  // dynamic import support. The module's own imports still get the fakes.)
  vi.resetModules();
  ads = await vi.importActual<AdsModule>("../ads");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("initAds consent flow", () => {
  it("waits for the user to close the consent form, however long it stays open", async () => {
    let closeForm: (v: unknown) => void = () => {};
    m.loadAndShowConsentFormIfRequired.mockReturnValue(
      new Promise((resolve) => {
        closeForm = resolve;
      })
    );
    const started = ads.initAds();
    await vi.advanceTimersByTimeAsync(60000);
    // The old 15 s cap fired here: ATT over the form and ads before a choice.
    expect(m.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(m.initialize).not.toHaveBeenCalled();

    closeForm({});
    await vi.advanceTimersByTimeAsync(0);
    await expect(started).resolves.toBe(true);
    expect(m.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(m.initialize).toHaveBeenCalledTimes(1);
  });

  it("caps a stalled consent info update so ATT still appears", async () => {
    m.requestInfoUpdate.mockReturnValue(new Promise(() => {}));
    const started = ads.initAds();
    await vi.advanceTimersByTimeAsync(15000);
    await expect(started).resolves.toBe(true);
    expect(m.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
    expect(m.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    // canRequestAds (true here: consent stored earlier) decided the start.
    expect(m.initialize).toHaveBeenCalledTimes(1);
  });

  it("fails closed after a consent error when UMP says ads cannot be requested", async () => {
    m.requestInfoUpdate.mockRejectedValue(new Error("consent-update-failed"));
    m.getConsentInfo.mockResolvedValue({ canRequestAds: false });
    const started = ads.initAds();
    await vi.advanceTimersByTimeAsync(0);
    await expect(started).resolves.toBe(false);
    expect(m.requestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(m.initialize).not.toHaveBeenCalled();
  });

  it("stays dark when the form closes without consent, and retries on the next call", async () => {
    m.getConsentInfo.mockResolvedValue({ canRequestAds: false });
    const first = ads.initAds();
    await vi.advanceTimersByTimeAsync(0);
    await expect(first).resolves.toBe(false);

    m.getConsentInfo.mockResolvedValue({ canRequestAds: true });
    const second = ads.initAds();
    await vi.advanceTimersByTimeAsync(0);
    await expect(second).resolves.toBe(true);
    expect(m.initialize).toHaveBeenCalledTimes(1);
  });
});

describe("ad content rating", () => {
  it("caps requests at G before the SDK starts", async () => {
    const started = ads.initAds();
    await vi.advanceTimersByTimeAsync(0);
    await expect(started).resolves.toBe(true);
    expect(m.setRequestConfiguration).toHaveBeenCalledWith({ maxAdContentRating: "G" });
    expect(m.setRequestConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
      m.initialize.mock.invocationCallOrder[0]
    );
    // ATT still comes first.
    expect(m.requestTrackingPermissionsAsync.mock.invocationCallOrder[0]).toBeLessThan(
      m.setRequestConfiguration.mock.invocationCallOrder[0]
    );
  });

  it("stays dark when the rating cannot be set", async () => {
    m.setRequestConfiguration.mockRejectedValue(new Error("config-failed"));
    const started = ads.initAds();
    await vi.advanceTimersByTimeAsync(0);
    await expect(started).resolves.toBe(false);
    expect(m.initialize).not.toHaveBeenCalled();
  });
});

describe("ad privacy options entry point", () => {
  it("is required only when UMP says REQUIRED", async () => {
    m.getConsentInfo.mockResolvedValue({ privacyOptionsRequirementStatus: "REQUIRED" });
    await expect(ads.adPrivacyOptionsRequired()).resolves.toBe(true);
    m.getConsentInfo.mockResolvedValue({ privacyOptionsRequirementStatus: "NOT_REQUIRED" });
    await expect(ads.adPrivacyOptionsRequired()).resolves.toBe(false);
    m.getConsentInfo.mockResolvedValue({ privacyOptionsRequirementStatus: "UNKNOWN" });
    await expect(ads.adPrivacyOptionsRequired()).resolves.toBe(false);
  });

  it("hides the entry point when consent info cannot be read", async () => {
    m.getConsentInfo.mockRejectedValue(new Error("unavailable"));
    await expect(ads.adPrivacyOptionsRequired()).resolves.toBe(false);
  });

  it("opens the UMP privacy options form and swallows its errors", async () => {
    m.showPrivacyOptionsForm.mockRejectedValue(new Error("privacy-options-form-error"));
    await expect(ads.showAdPrivacyOptions()).resolves.toBeUndefined();
    expect(m.showPrivacyOptionsForm).toHaveBeenCalledTimes(1);
  });
});
