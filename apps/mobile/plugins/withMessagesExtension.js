// Adds the CapiMessages iMessage extension target to the generated Xcode
// project. Hand-rolled because @bacons/apple-targets has no Messages type and
// requires SDK 53 (we are pinned to 52). Pattern follows the community share
// extension plugins: add target, wire build phases, embed into the app.
const { withXcodeProject, withEntitlementsPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const TARGET = "CapiMessages";
const BUNDLE_ID = "dev.capi.app.messages";
const GROUP = "group.dev.capi.app";
const SRC_DIR = path.join(__dirname, "..", "targets", "messages");
const SWIFT_FILES = [
  "MessagesViewController.swift",
  "CreateJoinViews.swift",
  "GameWebView.swift",
  "CapiAPI.swift",
  "CapiStore.swift",
  "CapiStrings.swift",
];

function withMessagesTarget(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projRoot = config.modRequest.platformProjectRoot;

    // Sources refresh on every prebuild; only the pbxproj wiring below is
    // idempotent-guarded.
    // 1. Copy sources + plist + entitlements + assets into ios/CapiMessages/
    const dest = path.join(projRoot, TARGET);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of [...SWIFT_FILES, "Info.plist", "CapiMessages.entitlements"]) {
      fs.copyFileSync(path.join(SRC_DIR, f), path.join(dest, f));
    }
    fs.cpSync(path.join(SRC_DIR, "Assets.xcassets"), path.join(dest, "Assets.xcassets"), { recursive: true });

    if (proj.pbxTargetByName(TARGET)) return config; // idempotent re-runs

    // 2. Create the target (also creates product + appex embed wiring group)
    //
    // NOTE (Gate B iteration 2): addTarget()'s app_extension branch is
    // documented to wire two things automatically: a "Copy Files" phase on
    // the FIRST target (Capi) with dstSubfolderSpec 13 (PlugIns) containing
    // the new .appex, and a target dependency from Capi to CapiMessages
    // (`this.addTargetDependency(this.getFirstTarget().uuid, [target.uuid])`
    // runs unconditionally for every non-watch2_extension type, i.e. ours).
    // The first half worked (confirmed in the generated pbxproj: a Copy Files
    // phase on Capi with dstSubfolderSpec = 13 and CapiMessages.appex in its
    // files list). The second half silently did nothing: addTargetDependency
    // only writes PBXTargetDependency/PBXContainerItemProxy entries when
    // `this.hash.project.objects['PBXTargetDependency']` and
    // ['PBXContainerItemProxy'] ALREADY exist -- see the
    // `if (pbxContainerItemProxySection && pbxTargetDependencySection)` guard
    // in node_modules/xcode/lib/pbxProject.js. A fresh single-target Expo app
    // has neither section (no pre-existing target dependency of any kind), so
    // the guard fails and the call is a no-op with no error or warning. Gate
    // B (full build) caught this as: xcodebuild BUILD SUCCEEDED and
    // CapiMessages.appex built as a standalone product (it's still in the
    // scheme's default build action), but Capi.app/PlugIns/ came out empty,
    // because there was no dependency edge forcing Capi's Copy Files phase to
    // wait for CapiMessages. Pre-creating the two sections (empty is enough)
    // before addTarget runs makes its own internal call succeed instead of
    // adding a second, redundant embed phase (which would risk a "Multiple
    // commands produce CapiMessages.appex" error against the one addTarget
    // already wires correctly).
    proj.hash.project.objects["PBXTargetDependency"] = proj.hash.project.objects["PBXTargetDependency"] || {};
    proj.hash.project.objects["PBXContainerItemProxy"] = proj.hash.project.objects["PBXContainerItemProxy"] || {};

    const target = proj.addTarget(TARGET, "app_extension", TARGET, BUNDLE_ID);

    // 3. Groups + build phases
    //
    // NOTE (Gate B iteration): the group is created with NO path (name only).
    // Every file below supplies its own path as "CapiMessages/<file>", so the
    // group must not ALSO contribute a "CapiMessages" prefix -- a pathed group
    // plus addFile(path.join(TARGET, f), groupKey) double-prefixes children to
    // "CapiMessages/CapiMessages/<file>". That was this plugin's first cut;
    // Gate A's grep/plutil checks can't see it (they just check the files
    // exist on disk), but Gate B's xcodebuild caught it as
    // "CompileAssetCatalogVariant ... ios/Assets.xcassets: No such file or
    // directory" followed by a missing-icon-set error, because
    // addBuildPhase(SWIFT_FILES, ...) with bare filenames creates file
    // references with NO group parent at all, and Xcode resolves an
    // unparented "<group>"-sourceTree reference relative to SRCROOT (ios/)
    // directly -- not ios/CapiMessages/ where prebuild actually copied the
    // files. addSourceFile()/addResourceFile() would normally be the fix (one
    // call each grouped + build-phase-wired), and addSourceFile is used below,
    // but addResourceFile is NOT: it unconditionally calls
    // correctForResourcesPath(), which reads
    // project.pbxGroupByName("Resources").path -- and this project has no
    // PBXGroup literally named "Resources" (only a same-named build phase),
    // so that lookup returns undefined and the call throws. Assets.xcassets
    // is wired manually below instead, replicating addResourceFile() minus
    // that call. Bare "Assets.xcassets" also collides via addFile()'s
    // hasFile() check with the main app's own (differently-grouped)
    // Assets.xcassets reference, which is a second reason every path here is
    // the full "CapiMessages/<file>" string rather than a bare filename.
    const groupKey = proj.pbxCreateGroup(TARGET, undefined);
    const mainGroupId = proj.getFirstProject().firstProject.mainGroup;
    proj.getPBXGroupByKey(mainGroupId).children.push({ value: groupKey, comment: TARGET });

    proj.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
    proj.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
    proj.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    for (const f of SWIFT_FILES) {
      proj.addSourceFile(path.join(TARGET, f), { target: target.uuid }, groupKey);
    }

    const assets = proj.addFile(path.join(TARGET, "Assets.xcassets"), groupKey);
    assets.uuid = proj.generateUuid();
    assets.target = target.uuid;
    proj.addToPbxBuildFileSection(assets);
    proj.addToPbxResourcesBuildPhase(assets);

    for (const f of ["Info.plist", "CapiMessages.entitlements"]) {
      proj.addFile(path.join(TARGET, f), groupKey);
    }

    // 4. Build settings for the extension target
    const configurations = proj.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (typeof entry === "object" && entry.buildSettings &&
          entry.buildSettings.PRODUCT_NAME === `"${TARGET}"`) {
        Object.assign(entry.buildSettings, {
          PRODUCT_BUNDLE_IDENTIFIER: BUNDLE_ID,
          SWIFT_VERSION: "5.0",
          IPHONEOS_DEPLOYMENT_TARGET: "15.1",
          TARGETED_DEVICE_FAMILY: `"1"`,
          INFOPLIST_FILE: `${TARGET}/Info.plist`,
          CODE_SIGN_ENTITLEMENTS: `${TARGET}/CapiMessages.entitlements`,
          GENERATE_INFOPLIST_FILE: "NO",
          // EAS injects the remote build number into the config on its
          // workers; reading it here keeps the appex version-locked to the
          // container app forever.
          CURRENT_PROJECT_VERSION: String(config.ios?.buildNumber ?? "1"),
          MARKETING_VERSION: config.version ?? "1.1.0",
          ASSETCATALOG_COMPILER_APPICON_NAME: `"iMessage App Icon"`,
          SKIP_INSTALL: "YES",
        });
      }
    }
    return config;
  });
}

function withAppGroup(config) {
  return withEntitlementsPlist(config, (config) => {
    const groups = config.modResults["com.apple.security.application-groups"] ?? [];
    if (!groups.includes(GROUP)) groups.push(GROUP);
    config.modResults["com.apple.security.application-groups"] = groups;
    return config;
  });
}

module.exports = function withMessagesExtension(config) {
  return withAppGroup(withMessagesTarget(config));
};
