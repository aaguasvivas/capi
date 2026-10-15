import ExpoModulesCore

// Writes capi-shared.json at the root of the App Group container, where the
// iMessage extension reads it (CapiStore.swift). Foundation directly, not
// expo-file-system: that package's permission check refuses the first write
// into a group container on a device, because it compares /private/var and
// /var forms of the same path.
public class CapiSharedModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CapiShared")

    // Nil when the file was written, else the reason, so the caller can
    // report it. Atomic, so the extension never reads half a file.
    Function("writeSharedFile") { (content: String) -> String? in
      guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.dev.capi.app") else {
        return "no App Group container"
      }
      do {
        try content.write(to: dir.appendingPathComponent("capi-shared.json"), atomically: true, encoding: .utf8)
        return nil
      } catch {
        return error.localizedDescription
      }
    }
  }
}
