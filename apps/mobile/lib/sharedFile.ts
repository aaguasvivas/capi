// Writes capi-shared.json into the App Group container the iMessage
// extension reads. iOS only. A missing container (Expo Go, a build without
// the entitlement) or any file error is a silent no-op: the extension then
// treats the player as owning no premium designs.
import { Platform } from "react-native";

const APP_GROUP = "group.dev.capi.app";
const FILE_NAME = "capi-shared.json";

// Content of the last successful write, so an unchanged state skips the disk.
let lastWritten: string | null = null;

export function writeSharedFile(content: string): void {
  if (Platform.OS !== "ios" || content === lastWritten) return;
  try {
    // Required here, not imported: the module installs global stream
    // polyfills on load, which Android and every launch before the first
    // write never need, and a load failure must stay inside this catch.
    // Typed from the package's build declarations: its "next" entry is
    // TypeScript source, which fails this project's typecheck.
    const { File, Paths } = require(
      "expo-file-system/next"
    ) as typeof import("expo-file-system/build/next");
    const container = Paths.appleSharedContainers[APP_GROUP];
    if (!container) return;
    new File(container, FILE_NAME).write(content);
    lastWritten = content;
  } catch {
    /* no container or no write access: nothing to share */
  }
}
