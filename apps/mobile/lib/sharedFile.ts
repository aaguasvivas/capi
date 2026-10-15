// Writes capi-shared.json into the App Group container the iMessage
// extension reads, through the local CapiShared module
// (modules/capi-shared). iOS only. Expo Go and Android have no such module,
// so the write is skipped there. A failed write is reported, never thrown:
// the extension then treats the player as owning no premium designs.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import * as Sentry from "@sentry/react-native";

type CapiShared = { writeSharedFile(content: string): string | null };

// Content of the last successful write, so an unchanged state skips the disk.
let lastWritten: string | null = null;
// The last failure reported, so a repeated failure is reported once.
let lastFailure: string | null = null;

export function writeSharedFile(content: string): void {
  if (Platform.OS !== "ios" || content === lastWritten) return;
  const native = requireOptionalNativeModule<CapiShared>("CapiShared");
  if (!native) return;
  let failure: string | null;
  try {
    failure = native.writeSharedFile(content);
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }
  if (failure === null) {
    lastWritten = content;
    return;
  }
  if (failure === lastFailure) return;
  lastFailure = failure;
  if (__DEV__) console.warn(`capi-shared.json not written: ${failure}`);
  else Sentry.captureMessage(`capi-shared.json not written: ${failure}`, "warning");
}
