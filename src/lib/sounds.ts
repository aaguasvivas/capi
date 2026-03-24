"use client";

let ctx: AudioContext | null = null;
let _muted = false;
let slamBuffer: AudioBuffer | null = null;
let slamArrayBuf: ArrayBuffer | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return _muted;
}

export function setMuted(m: boolean) {
  _muted = m;
  if (typeof window !== "undefined") {
    localStorage.setItem("capi_muted", m ? "1" : "0");
  }
}

export function loadMuteState() {
  if (typeof window === "undefined") return;
  _muted = localStorage.getItem("capi_muted") === "1";
}

export function preloadSounds() {
  if (slamArrayBuf) return;
  fetch("/sounds/slam.mp3")
    .then((res) => res.arrayBuffer())
    .then((buf) => {
      slamArrayBuf = buf;
    })
    .catch(() => {});
}

async function ensureSlamBuffer(): Promise<boolean> {
  if (slamBuffer) return true;
  if (!slamArrayBuf) return false;
  try {
    const c = getCtx();
    slamBuffer = await c.decodeAudioData(slamArrayBuf.slice(0));
    return true;
  } catch {
    return false;
  }
}

export async function playSlam() {
  if (_muted) return;
  try {
    const c = getCtx();

    const hasBuffer = await ensureSlamBuffer();
    if (hasBuffer && slamBuffer) {
      const source = c.createBufferSource();
      source.buffer = slamBuffer;
      source.connect(c.destination);
      source.start();
      return;
    }

    // Fallback: noise-only synthesis
    const t = c.currentTime;

    const impact = c.createBufferSource();
    const impactLen = Math.floor(c.sampleRate * 0.06);
    const impactBuf = c.createBuffer(1, impactLen, c.sampleRate);
    const id = impactBuf.getChannelData(0);
    for (let i = 0; i < impactLen; i++) {
      id[i] = (Math.random() * 2 - 1) * 0.8;
    }
    impact.buffer = impactBuf;
    const impactFilter = c.createBiquadFilter();
    impactFilter.type = "bandpass";
    impactFilter.frequency.setValueAtTime(300, t);
    impactFilter.Q.setValueAtTime(1.5, t);
    const impactGain = c.createGain();
    impactGain.gain.setValueAtTime(0.5, t);
    impactGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    impact.connect(impactFilter);
    impactFilter.connect(impactGain);
    impactGain.connect(c.destination);
    impact.start(t);
    impact.stop(t + 0.06);

    const decay = c.createBufferSource();
    const decayLen = Math.floor(c.sampleRate * 0.18);
    const decayBuf = c.createBuffer(1, decayLen, c.sampleRate);
    const dd = decayBuf.getChannelData(0);
    for (let i = 0; i < decayLen; i++) {
      const env = Math.exp(-i / (decayLen * 0.15));
      dd[i] = (Math.random() * 2 - 1) * 0.4 * env;
    }
    decay.buffer = decayBuf;
    const decayFilter = c.createBiquadFilter();
    decayFilter.type = "lowpass";
    decayFilter.frequency.setValueAtTime(500, t);
    decayFilter.frequency.exponentialRampToValueAtTime(120, t + 0.18);
    const decayGain = c.createGain();
    decayGain.gain.setValueAtTime(0.3, t);
    decayGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    decay.connect(decayFilter);
    decayFilter.connect(decayGain);
    decayGain.connect(c.destination);
    decay.start(t);
    decay.stop(t + 0.18);
  } catch {
    /* silent fail */
  }
}

export function playDraw() {
  if (_muted) return;
  try {
    const c = getCtx();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.1);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch {
    /* silent fail */
  }
}

export function playCallout() {
  if (_muted) return;
  try {
    const c = getCtx();
    const t = c.currentTime;
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = i < 3 ? "triangle" : "sine";
      const start = t + i * 0.08;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    /* silent fail */
  }
}
