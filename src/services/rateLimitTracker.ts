let rateLimitedUntil = 0;
let observers: (() => void)[] = [];

export function onRateLimited() {
  rateLimitedUntil = Date.now() + 60000;
  notify();
}

export function getStatus(): { active: boolean; remainingSec: number } {
  const now = Date.now();
  if (rateLimitedUntil > now) {
    return { active: false, remainingSec: Math.ceil((rateLimitedUntil - now) / 1000) };
  }
  return { active: true, remainingSec: 0 };
}

function notify() { observers.forEach(fn => fn()); }

export function subscribe(fn: () => void) {
  observers.push(fn);
  return () => { observers = observers.filter(f => f !== fn); };
}
