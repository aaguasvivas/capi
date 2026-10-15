// Xcode 27 refuses any target whose iOS deployment target is below 15.0.
// A few pods still declare older ones for their resource bundles
// (Google-Mobile-Ads-SDK, GoogleUserMessagingPlatform, Sentry,
// RNCAsyncStorage at 9.0-12.0), so the build fails before compiling. This
// raises every pod target below the app's own 15.1 to 15.1 after pods
// install. Xcode 26 only warned about the same settings, so the binary does
// not change.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# capi-pods-deployment-target";
const RUBY = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && Gem::Version.new(current) < Gem::Version.new('15.1')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        const anchor = /post_install do \|installer\|\n/;
        if (!anchor.test(contents)) {
          throw new Error(
            "withPodsDeploymentTarget: could not find `post_install do |installer|` in the generated Podfile"
          );
        }
        contents = contents.replace(anchor, (m) => m + RUBY);
        fs.writeFileSync(podfile, contents);
      }
      return config;
    },
  ]);
};
