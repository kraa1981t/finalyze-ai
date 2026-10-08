import { playClickSound } from './tradeSounds';

// Every pressable thing on the site: real buttons/links plus the divs and spans
// the UI uses as buttons (the codebase marks those with cursor-pointer).
const PRESSABLE = [
  'button',
  'a[href]',
  '[role="button"]',
  'summary',
  'label',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="color"]',
  'input[type="submit"]',
  '[data-click-sound]',
  '[class*="cursor-pointer"]',
].join(', ');

// Typing in a field must stay silent — only presses produce a sound.
const TYPING_INPUTS = new Set(['text', 'email', 'password', 'number', 'search', 'tel', 'url', 'date', 'time']);

export function isUiClickSoundEnabled(): boolean {
  try {
    return localStorage.getItem('finalyze_ui_click_sound') !== 'false';
  } catch {
    return true;
  }
}

export function setUiClickSoundEnabled(on: boolean) {
  try {
    localStorage.setItem('finalyze_ui_click_sound', on ? 'true' : 'false');
  } catch {}
}

/**
 * One capture-phase listener covers every button, icon, page link and section
 * that gets pressed, so no component has to wire a sound by hand.
 *
 * Anything inside [data-no-click-sound] is skipped — that is how the trading
 * chart opts out, because it already plays its own click/drag sounds and a
 * global tick on every pointer press would double up and spam while dragging.
 */
export function installUiClickSound(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (typeof window === 'undefined') return () => {};

  const onPress = (e: Event) => {
    if (!isUiClickSoundEnabled()) return;
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    if (target.closest('[data-no-click-sound]')) return;
    const el = target.closest(PRESSABLE) as HTMLElement | null;
    if (!el) return;
    if (el.tagName === 'INPUT' && TYPING_INPUTS.has(((el as HTMLInputElement).type || 'text').toLowerCase())) return;
    // A press on something the user cannot act on stays silent.
    if ((el as HTMLButtonElement).disabled) return;
    try { playClickSound(); } catch {}
  };

  document.addEventListener('pointerdown', onPress, true);
  document.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === 'function' && target.closest('button, a[href], [role="button"]')) onPress(e);
    }
  }, true);

  return () => {
    document.removeEventListener('pointerdown', onPress, true);
  };
}