// Xcode 26 workaround for ITMS-90725-era toolchains: Apple clang 21 enforces
// stricter consteval rules that break the fmt 11.0.2 vendored by RN 0.76's
// RCT-Folly ("call to consteval function ... is not a constant expression").
// The accepted transitional fix for Expo SDK 52-55 is to flip
// FMT_USE_CONSTEVAL to 0 in fmt's base.h after pods install, moving format
// string validation from compile time to runtime (binary behavior identical).
// REMOVE this plugin when the app moves to Expo SDK 56+ / RN >= 0.83.9, which
// bundle fmt 12.1.0 and compile cleanly on Xcode 26.
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# capi-fmt-consteval-fix";
const RUBY = `    ${MARKER}
    Dir.glob(File.join(installer.sandbox.root.to_s, '**/fmt/**/base.h')).each do |fmt_header|
      contents = File.read(fmt_header)
      patched = contents.gsub('define FMT_USE_CONSTEVAL 1', 'define FMT_USE_CONSTEVAL 0')
      File.write(fmt_header, patched) unless patched == contents
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfile = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes(MARKER)) {
        const anchor = /post_install do \|installer\|\n/;
        if (!anchor.test(contents)) {
          throw new Error(
            "withFmtConstevalFix: could not find `post_install do |installer|` in the generated Podfile"
          );
        }
        contents = contents.replace(anchor, (m) => m + RUBY);
        fs.writeFileSync(podfile, contents);
      }
      return config;
    },
  ]);
};
