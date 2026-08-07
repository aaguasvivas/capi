import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Sound effects via expo-av. Mirrors apps/web/src/lib/sounds.ts.
//
// On web only slam is file-based (public/sounds/slam.mp3); draw, callout and
// chatReceive are synthesized with WebAudio oscillators. expo-av has no
// synthesis, so those three are approximated by playing the bundled slam
// asset at a different rate/volume (pitch shifts with rate on purpose).
// The rates/volumes below are a first pass; tune on device.

const MUTE_KEY = "capi_muted";

type SoundName = "slam" | "draw" | "callout" | "chatReceive";

const VARIANTS: Record<SoundName, { rate: number; volume: number }> = {
  slam: { rate: 1.0, volume: 1.0 },
  draw: { rate: 1.6, volume: 0.4 },
  callout: { rate: 0.8, volume: 1.0 },
  chatReceive: { rate: 2.0, volume: 0.3 },
};

let _muted = false;
let audioModeSet = false;

// One preloaded Sound instance per logical sound so retriggers are just
// replayAsync. A cached promise per name dedupes concurrent loads; a failed
// load resolves to null and stays null (best-effort, like the web fallback).
const soundPromises = new Map<SoundName, Promise<Audio.Sound | null>>();

async function loadSound(name: SoundName): Promise<Audio.Sound | null> {
  try {
    if (!audioModeSet) {
      audioModeSet = true;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(
        () => {}
      );
    }
    const { rate, volume } = VARIANTS[name];
    const { sound } = await Audio.Sound.createAsync(
      require("../assets/slam.mp3"),
      { volume, rate, shouldCorrectPitch: false }
    );
    return sound;
  } catch {
    return null;
  }
}

function ensureSound(name: SoundName): Promise<Audio.Sound | null> {
  let p = soundPromises.get(name);
  if (!p) {
    p = loadSound(name);
    soundPromises.set(name, p);
  }
  return p;
}

function play(name: SoundName): void {
  if (_muted) return;
  void (async () => {
    try {
      const sound = await ensureSound(name);
      await sound?.replayAsync();
    } catch {
      /* sounds are best-effort; never surface errors */
    }
  })();
}

export function playSlam(): void {
  play("slam");
}

export function playDraw(): void {
  play("draw");
}

export function playCallout(): void {
  play("callout");
}

export function playChatReceive(): void {
  play("chatReceive");
}

export function isMuted(): boolean {
  return _muted;
}

export function setMuted(m: boolean): void {
  _muted = m;
  AsyncStorage.setItem(MUTE_KEY, m ? "1" : "0").catch(() => {});
}

export async function loadMuteState(): Promise<void> {
  try {
    _muted = (await AsyncStorage.getItem(MUTE_KEY)) === "1";
  } catch {
    /* keep default (unmuted) */
  }
}

export function preloadSounds(): void {
  for (const name of Object.keys(VARIANTS) as SoundName[]) {
    void ensureSound(name);
  }
}
