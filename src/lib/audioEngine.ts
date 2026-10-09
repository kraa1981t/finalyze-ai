type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let unlocked = false;
const customBuffers: Map<string, AudioBuffer> = new Map();

function createAudioContext(): AudioContext | null {
  try {
    const w = window as AudioWindow;
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    return new AC();
  } catch (e) {
    console.warn('AudioContext unavailable:', e);
    return null;
  }
}

// Shared Web Audio context. Safe to call at any time; returns null only when
// the browser exposes no Web Audio implementation at all.
export function getAudioContext(): AudioContext | null {
  if (!ctx || ctx.state === 'closed') ctx = createAudioContext();
  // 'suspended' (autoplay policy) and 'interrupted' (iOS backgrounding) both
  // need a resume attempt before we can produce sound.
  if (ctx && ctx.state !== 'running') { ctx.resume().catch(() => {}); }
  return ctx;
}

// Must run inside a real user gesture (click/touch). Creates, resumes and
// "primes" the context so iOS/Safari allow later programmatic playback.
export function initAudio() {
  try {
    const ac = getAudioContext();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    // Prime with a 1-sample silent buffer inside the gesture (iOS requirement).
    try {
      const buffer = ac.createBuffer(1, 1, 22050);
      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.connect(ac.destination);
      source.start(0);
    } catch {}
    unlocked = true;
  } catch (e) {
    console.warn('initAudio failed:', e);
  }
}

function getCtx(): AudioContext | null {
  if (!unlocked) { initAudio(); }
  return getAudioContext();
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.5) {
  try {
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch (e) {
    console.warn('Web Audio tone failed:', e);
  }
}

function playBuffer(buffer: AudioBuffer, volume: number) {
  try {
    const ac = getCtx();
    if (!ac) return;
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ac.destination);
    source.start();
  } catch (e) {
    console.warn('Web Audio buffer failed:', e);
  }
}

export async function loadCustomAudio(key: string, blob: Blob) {
  try {
    const ac = getAudioContext();
    if (!ac) return;
    const arrayBuf = await blob.arrayBuffer();
    const buffer = await ac.decodeAudioData(arrayBuf);
    customBuffers.set(key, buffer);
  } catch (e) {
    console.warn('Failed to decode custom audio:', e);
  }
}

// Preload project audio files: 1.mp3 (opportunity), 2.mp3 (completion), 3.mp3 (category change)
const projectAudioBuffers: Map<string, AudioBuffer> = new Map();
const projectAudioElements: Map<string, HTMLAudioElement> = new Map();

async function preloadSound(key: string, url: string) {
  try {
    const el = new Audio(url);
    el.preload = 'auto';
    projectAudioElements.set(key, el);

    const resp = await fetch(url);
    if (resp.ok) {
      const arrayBuf = await resp.arrayBuffer();
      const ac = getAudioContext();
      if (ac) {
        const buffer = await ac.decodeAudioData(arrayBuf);
        projectAudioBuffers.set(key, buffer);
      }
    }
  } catch (e) {
    console.warn(`Preload of ${url} failed:`, e);
  }
}

if (typeof window !== 'undefined') {
  preloadSound('1', '/1.mp3');
  preloadSound('2', '/2.mp3');
  preloadSound('3', '/3.mp3');
}

function playProjectSound(key: string, volume: number, fallbackTone: () => void) {
  const customBuf = customBuffers.get(`custom_${key}`);
  if (customBuf) { playBuffer(customBuf, volume); return; }

  const buf = projectAudioBuffers.get(key);
  if (buf) {
    playBuffer(buf, volume);
    return;
  }

  const el = projectAudioElements.get(key);
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = volume;
      el.play().catch(() => fallbackTone());
      return;
    } catch {
      fallbackTone();
      return;
    }
  }

  fallbackTone();
}

export function playSuccess(volume: number = 0.5) {
  playProjectSound('1', volume, () => {
    playTone(880, 0.12, 'sine', volume);
    setTimeout(() => playTone(1100, 0.15, 'sine', volume), 100);
    setTimeout(() => playTone(1320, 0.2, 'sine', volume), 220);
  });
}

export function playStart(volume: number = 0.5) {
  const buf = customBuffers.get('custom_start');
  if (buf) { playBuffer(buf, volume); return; }
  playTone(660, 0.1, 'sine', volume);
  setTimeout(() => playTone(880, 0.12, 'sine', volume), 80);
  setTimeout(() => playTone(1100, 0.15, 'sine', volume), 170);
}

export function playFail(volume: number = 0.5) {
  playProjectSound('3', volume, () => {
    playTone(300, 0.25, 'square', volume);
    setTimeout(() => playTone(250, 0.3, 'square', volume), 200);
  });
}

export function playCompletion(volume: number = 0.5) {
  playProjectSound('2', volume, () => {
    playTone(523, 0.15, 'sine', volume);
    setTimeout(() => playTone(659, 0.15, 'sine', volume), 120);
    setTimeout(() => playTone(784, 0.15, 'sine', volume), 240);
    setTimeout(() => playTone(1047, 0.3, 'sine', volume), 360);
  });
}

// Short water-drop "plink". Synthesised (no audio file) so it stays crisp and
// instant: a sine whose pitch glides sharply downward the instant the droplet
// "hits", plus a tiny bright partial for the spatter.
export function playDrop(volume: number = 0.5) {
  try {
    const ac = getCtx();
    if (!ac) return;
    const t = ac.currentTime;

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.11);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.18);

    const spark = ac.createOscillator();
    const sparkGain = ac.createGain();
    spark.type = 'triangle';
    spark.frequency.setValueAtTime(2600, t);
    spark.frequency.exponentialRampToValueAtTime(1400, t + 0.06);
    sparkGain.gain.setValueAtTime(0.0001, t);
    sparkGain.gain.exponentialRampToValueAtTime(volume * 0.35, t + 0.005);
    sparkGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    spark.connect(sparkGain);
    sparkGain.connect(ac.destination);
    spark.start(t);
    spark.stop(t + 0.08);
  } catch (e) {
    console.warn('Web Audio drop failed:', e);
  }
}

// Authentic Facebook/Messenger "ping". This is not a random blip: it is the
// real F Major 7 chord designed by Everett Katigbak (Facebook's sound
// designer) — four notes that spell "FACE":
//   F5 (698.46) → A5 (880) → C6 (1046.5) → E6 (1318.51)
// played as a bright, quick arpeggio with a soft bell timbre. Fully
// synthesised (no audio file) so it fires instantly with no settings
// dependency.
const MESSENGER_FACE_NOTES: Array<[number, number, number]> = [
  [698.46, 0.0, 0.26],     // F5  — "F"
  [880.0, 0.09, 0.24],     // A5  — "A"
  [1046.5, 0.18, 0.24],    // C6  — "C"
  [1318.51, 0.27, 0.30],   // E6  — "E" (bright tail, rings a touch longer)
];

// One bright, marimba/bell-like note: a sine fundamental plus a soft partial
// an octave up, with a snappy attack and an exponential decay — this is what
// gives the Messenger ping its rounded, pleasant sheen.
function playBellNote(ac: AudioContext, freq: number, start: number, dur: number, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);

  // Soft 2nd harmonic (octave up) for that rounded bell sheen.
  const harm = ac.createOscillator();
  const harmGain = ac.createGain();
  harm.type = 'triangle';
  harm.frequency.value = freq * 2;
  harmGain.gain.setValueAtTime(0.0001, start);
  harmGain.gain.exponentialRampToValueAtTime(volume * 0.18, start + 0.01);
  harmGain.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.6);
  harm.connect(harmGain);
  harmGain.connect(ac.destination);
  harm.start(start);
  harm.stop(start + dur * 0.6 + 0.02);
}

export function playMessengerPing(volume: number = 0.6) {
  try {
    const ac = getCtx();
    if (!ac) return;
    const now = ac.currentTime;
    for (const [freq, delay, dur] of MESSENGER_FACE_NOTES) {
      playBellNote(ac, freq, now + delay, dur, volume);
    }
  } catch (e) {
    console.warn('Web Audio messenger ping failed:', e);
  }
}

export function playClick(volume: number = 0.3) {
  playTone(1200, 0.05, 'sine', volume);
}
