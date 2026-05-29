let rateLimitedUntil = 0;
let observers: (() => void)[] = [];
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute (matches Groq/Google per-minute limits)

export function onRateLimited(durationMs = RATE_LIMIT_COOLDOWN) {
  const now = Date.now();
  if (rateLimitedUntil <= now) {
    rateLimitedUntil = now + durationMs;
  }
  notify();
}

export function getStatus(): { active: boolean; remainingSec: number } {
  const now = Date.now();
  if (rateLimitedUntil > now) {
    return { active: true, remainingSec: Math.ceil((rateLimitedUntil - now) / 1000) };
  }
  return { active: false, remainingSec: 0 };
}

export async function waitIfRateLimited(): Promise<void> {
  const remaining = rateLimitedUntil - Date.now();
  if (remaining > 0) {
    await new Promise(r => setTimeout(r, remaining));
  }
}

function notify() { observers.forEach(fn => fn()); }

export function subscribe(fn: () => void) {
  observers.push(fn);
  return () => { observers = observers.filter(f => f !== fn); };
}
