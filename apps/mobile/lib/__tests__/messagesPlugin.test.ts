import { describe, expect, it } from "vitest";
import withMessagesExtension from "../../plugins/withMessagesExtension";
import app from "../../app.json";

// The plugin mutates the config it gets, so every call takes a fresh copy.
function expoConfig() {
  return JSON.parse(JSON.stringify(app.expo));
}

// The app's own required-reason declarations (app.json ios.privacyManifests).
// Without them, pod install wires the extension's PrivacyInfo.xcprivacy into
// the app (build 22). The pods re-add most reasons at build time, but not
// 0A2A.1, 3B52.1 or 85F4.1 unless a pod declares them.
const APP_REASONS: Record<string, string[]> = {
  NSPrivacyAccessedAPICategoryUserDefaults: ["CA92.1"],
  NSPrivacyAccessedAPICategoryFileTimestamp: ["C617.1", "0A2A.1", "3B52.1"],
  NSPrivacyAccessedAPICategoryDiskSpace: ["E174.1", "85F4.1"],
  NSPrivacyAccessedAPICategorySystemBootTime: ["35F9.1"],
};

describe("withMessagesExtension privacy manifest guard", () => {
  it("refuses to run without the app's own privacy manifest", () => {
    const config = expoConfig();
    delete config.ios.privacyManifests;
    expect(() => withMessagesExtension(config)).toThrow(/privacyManifests/);
  });

  it("runs with app.json", () => {
    expect(() => withMessagesExtension(expoConfig())).not.toThrow();
  });

  it("app.json declares every required reason the app uses", () => {
    const types: { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }[] =
      app.expo.ios.privacyManifests.NSPrivacyAccessedAPITypes;
    for (const [type, reasons] of Object.entries(APP_REASONS)) {
      const entry = types.find((t) => t.NSPrivacyAccessedAPIType === type);
      expect(entry?.NSPrivacyAccessedAPITypeReasons, type).toEqual(expect.arrayContaining(reasons));
    }
  });
});
