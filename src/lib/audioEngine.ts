let ctx: AudioContext | null = null;
let unlocked = false;
const customBuffers: Map<string, AudioBuffer> = new Map();

export function initAudio() {
  try {
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    unlocked = true;
  } catch (e) {
    console.warn('initAudio failed:', e);
  }
}

function getCtx(): AudioContext | null {
  if (!unlocked) return null;
  if (!ctx || ctx.state === 'closed') return null;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
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
    if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
    const arrayBuf = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuf);
    customBuffers.set(key, buffer);
  } catch (e) {
    console.warn('Failed to decode custom audio:', e);
  }
}

export function removeCustomAudio(key: string) {
  customBuffers.delete(key);
}

export function playSuccess(volume: number = 0.5) {
  const buf = customBuffers.get('custom_success');
  if (buf) { playBuffer(buf, volume); return; }
  playTone(880, 0.12, 'sine', volume);
  setTimeout(() => playTone(1100, 0.15, 'sine', volume), 100);
  setTimeout(() => playTone(1320, 0.2, 'sine', volume), 220);
}

export function playStart(volume: number = 0.5) {
  const buf = customBuffers.get('custom_start');
  if (buf) { playBuffer(buf, volume); return; }
  playTone(660, 0.1, 'sine', volume);
  setTimeout(() => playTone(880, 0.12, 'sine', volume), 80);
  setTimeout(() => playTone(1100, 0.15, 'sine', volume), 170);
}

export function playFail(volume: number = 0.5) {
  const buf = customBuffers.get('custom_fail');
  if (buf) { playBuffer(buf, volume); return; }
  playTone(300, 0.25, 'square', volume);
  setTimeout(() => playTone(250, 0.3, 'square', volume), 200);
}

export function playCompletion(volume: number = 0.5) {
  const buf = customBuffers.get('custom_completion');
  if (buf) { playBuffer(buf, volume); return; }
  playTone(523, 0.15, 'sine', volume);
  setTimeout(() => playTone(659, 0.15, 'sine', volume), 120);
  setTimeout(() => playTone(784, 0.15, 'sine', volume), 240);
  setTimeout(() => playTone(1047, 0.3, 'sine', volume), 360);
}
