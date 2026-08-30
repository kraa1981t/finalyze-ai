let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function playOpenSound() {
  try {
    const c = ctx();
    // Pop: two-tone ascending beep
    const o1 = c.createOscillator();
    const g1 = c.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(600, c.currentTime);
    o1.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.08);
    g1.gain.setValueAtTime(0.35, c.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.12);
    o1.connect(g1);
    g1.connect(c.destination);
    o1.start(c.currentTime);
    o1.stop(c.currentTime + 0.12);

    // Second pop slightly delayed
    const o2 = c.createOscillator();
    const g2 = c.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(900, c.currentTime + 0.06);
    o2.frequency.exponentialRampToValueAtTime(1600, c.currentTime + 0.14);
    g2.gain.setValueAtTime(0, c.currentTime);
    g2.gain.setValueAtTime(0.25, c.currentTime + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.18);
    o2.connect(g2);
    g2.connect(c.destination);
    o2.start(c.currentTime + 0.06);
    o2.stop(c.currentTime + 0.18);
  } catch {}
}

export function playCloseSound() {
  try {
    const c = ctx();
    // Click: short sharp tick
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1200, c.currentTime);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.04);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime);
    o.stop(c.currentTime + 0.04);
  } catch {}
}

export function playClickSound() {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1000, c.currentTime);
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.05);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime); o.stop(c.currentTime + 0.05);
  } catch {}
}

export function playDragTick() {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, c.currentTime);
    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.04);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime); o.stop(c.currentTime + 0.04);
  } catch {}
}
