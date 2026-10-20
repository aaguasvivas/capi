import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
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

// A local prebuild over an existing ios/ finds the CapiMessages target and only
// refreshes its build settings. addTarget writes PRODUCT_NAME = "CapiMessages",
// but pod install rewrites the pbxproj without the quotes, so a re-parse reads
// CapiMessages. The 2026-10-19 audit found the appex still at 1.1.0 inside a
// 1.2.0 app that way (App Store Connect rejects the mismatch, ITMS-90473).
describe("withMessagesExtension version refresh on an existing target", () => {
  it("versions the extension like the app whether PRODUCT_NAME is quoted or not", async () => {
    const config = expoConfig();
    config.version = "9.9.0";
    config.ios.buildNumber = "77";
    const withPlugin = withMessagesExtension(config);
    const settings = (name: string) => ({ buildSettings: { PRODUCT_NAME: name, MARKETING_VERSION: "1.1.0" } });
    const appTarget = settings("Capi");
    const unquoted = settings("CapiMessages");
    const quoted = settings('"CapiMessages"');
    const section = { a: appTarget, a_comment: "Release", b: unquoted, c: quoted };
    const proj = { pbxTargetByName: () => ({}), pbxXCBuildConfigurationSection: () => section };
    const root = mkdtempSync(join(tmpdir(), "capi-prebuild-"));
    try {
      // The plugin registers its Xcode step as a mod; run it the way prebuild does.
      const { mods } = withPlugin as unknown as { mods: { ios: { xcodeproj: (c: object) => Promise<unknown> } } };
      await mods.ios.xcodeproj({ ...withPlugin, modResults: proj, modRequest: { platformProjectRoot: root } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    for (const ext of [unquoted, quoted]) {
      expect(ext.buildSettings).toMatchObject({ MARKETING_VERSION: "9.9.0", CURRENT_PROJECT_VERSION: "77" });
    }
    expect(appTarget.buildSettings).toEqual({ PRODUCT_NAME: "Capi", MARKETING_VERSION: "1.1.0" });
  });
});
