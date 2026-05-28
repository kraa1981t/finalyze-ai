let rateLimitedUntil = 0;
let observers: (() => void)[] = [];

export function onRateLimited(durationMs = 60000) {
  const candidate = Date.now() + durationMs;
  if (candidate > rateLimitedUntil) rateLimitedUntil = candidate;
  notify();
}

export function getStatus(): { active: boolean; remainingSec: number } {
  const now = Date.now();
  if (rateLimitedUntil > now) {
    return { active: false, remainingSec: Math.ceil((rateLimitedUntil - now) / 1000) };
  }
  return { active: true, remainingSec: 0 };
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
