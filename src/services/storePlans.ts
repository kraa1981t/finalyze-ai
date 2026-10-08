import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, getDoc, query, orderBy } from 'firebase/firestore';

export type PlanPeriodUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface StorePlan {
  id?: string;
  key: string;
  labelAr: string;
  labelEn: string;
  durationDays: number;
  priceUsd: number;
  badgeAr?: string;
  badgeEn?: string;
  featuresAr: string;
  featuresEn: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  /** Explicit calendar unit + count, so approval grants exactly the period bought. */
  planUnit?: PlanPeriodUnit;
  planUnits?: number;
}

// Duration presets offered in the plan editor: one hour up to one year.
// `days` is only the display/fallback number; the real period is unit+count.
// `nameAr/nameEn` are the PLAN NAME for that period — the editor writes them
// automatically, so a plan is named after its own duration (Hourly, Weekly…)
// and two plans can never end up sharing a name by mistake.
export const DURATION_OPTIONS: { days: number; unit: PlanPeriodUnit; count: number; labelAr: string; labelEn: string; nameAr: string; nameEn: string }[] = [
  { days: 1 / 24, unit: 'hour', count: 1, labelAr: 'ساعة واحدة', labelEn: '1 hour', nameAr: 'الخطة الساعية', nameEn: 'Hourly' },
  { days: 0.5, unit: 'hour', count: 12, labelAr: '12 ساعة', labelEn: '12 hours', nameAr: 'الخطة نصف اليومية', nameEn: 'Half-Day' },
  { days: 1, unit: 'day', count: 1, labelAr: 'يوم واحد', labelEn: '1 day', nameAr: 'الخطة اليومية', nameEn: 'Daily' },
  { days: 7, unit: 'week', count: 1, labelAr: 'أسبوع', labelEn: '1 week', nameAr: 'الخطة الأسبوعية', nameEn: 'Weekly' },
  { days: 14, unit: 'week', count: 2, labelAr: 'أسبوعان', labelEn: '2 weeks', nameAr: 'الخطة نصف الأسبوعية', nameEn: 'Biweekly' },
  { days: 30, unit: 'month', count: 1, labelAr: 'شهر', labelEn: '1 month', nameAr: 'الخطة الشهرية', nameEn: 'Monthly' },
  { days: 90, unit: 'month', count: 3, labelAr: '3 أشهر', labelEn: '3 months', nameAr: 'الخطة الربع سنوية', nameEn: 'Quarterly' },
  { days: 180, unit: 'month', count: 6, labelAr: '6 أشهر', labelEn: '6 months', nameAr: 'الخطة نصف السنوية', nameEn: 'Semi-Annual' },
  { days: 365, unit: 'year', count: 1, labelAr: 'سنة', labelEn: '1 year', nameAr: 'الخطة السنوية', nameEn: 'Yearly' },
];

// Every plan advertises the SAME feature list: one fixed description, written
// once in both languages, so a new plan needs no copywriting and can never show
// a stale or half-translated feature list.
export const DEFAULT_FEATURES_EN = [
  'Access to the client area with manual analysis',
  'Access to the client area with automatic analysis',
  'Instant buy and sell signals with entry and exit points',
  'Radar alerts on every important market movement',
  'Full technical analysis of Bitcoin and the major cryptocurrencies',
  'Every timeframe from one minute up to one month',
  'Early access to new features before anyone else',
  'Priority customer support',
].join('\n');

export const DEFAULT_FEATURES_AR = [
  'فتح قسم التحليل اليدوي في منطقة العميل',
  'فتح قسم التحليل التلقائي في منطقة العميل',
  'إشارات شراء وبيع فورية مع نقاط الدخول والخروج',
  'تنبيهات رادار على كل حركة مهمة في السوق',
  'تحليل فني كامل للبيتكوين والعملات الرقمية الكبرى',
  'كل الفترات الزمنية من دقيقة حتى شهر',
  'وصول مبكر إلى المزايا الجديدة قبل الجميع',
  'دعم فني ذو أولوية',
].join('\n');

export function durationOptionFor(days: number) {
  const d = Number(days) || 0;
  return DURATION_OPTIONS.find((o) => Math.abs(o.days - d) < 0.002) || null;
}

/** The plan name for a duration, in the language the site is showing. */
export function planNameForDuration(days: number, isAr: boolean): string {
  const opt = durationOptionFor(days);
  if (opt) return isAr ? opt.nameAr : opt.nameEn;
  return durationLabel({ durationDays: days } as StorePlan, isAr);
}

export function durationLabel(plan: StorePlan, isAr: boolean): string {
  const opt = durationOptionFor(plan.durationDays);
  if (opt) return isAr ? opt.labelAr : opt.labelEn;
  const d = toWesternDigits(plan.durationDays);
  return isAr ? `${d} يوم` : `${d} days`;
}

export const DEFAULT_PLANS: StorePlan[] = [
  {
    key: 'weekly',
    labelAr: 'أسبوعي',
    labelEn: 'Weekly',
    durationDays: 7,
    priceUsd: 2,
    badgeAr: '',
    badgeEn: '',
    featuresAr: 'تحليل احترافي لمدة 7 أيام\nإشارات رادار فورية\nدعم أساسي',
    featuresEn: '7 days of institutional analysis\nInstant radar alerts\nBasic support',
    active: true,
    sortOrder: 1,
    createdAt: 0,
  },
  {
    key: 'monthly',
    labelAr: 'شهري',
    labelEn: 'Monthly',
    durationDays: 30,
    priceUsd: 6,
    badgeAr: 'الأكثر شعبية',
    badgeEn: 'Popular',
    featuresAr: 'كل ميزات الأسبوعي\nوصول كامل للسوق وإشارات ذات أولوية\nتحليل يدوي لكل الرموز',
    featuresEn: 'All Weekly features\nFull market access & priority signals\nManual analysis for any symbol',
    active: true,
    sortOrder: 2,
    createdAt: 0,
  },
  {
    key: 'yearly',
    labelAr: 'سنوي',
    labelEn: 'Yearly',
    durationDays: 365,
    priceUsd: 60,
    badgeAr: 'أفضل قيمة',
    badgeEn: 'Best Value',
    featuresAr: 'كل ميزات الشهري\nأفضل سعر سنوياً\nدعم VIP خاص',
    featuresEn: 'All Monthly features\nBest value over the year\nVIP support',
    active: true,
    sortOrder: 3,
    createdAt: 0,
  },
];

export function toWesternDigits(val: any): string {
  if (val == null) return '';
  const str = String(val);
  const arabicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return str.replace(/[٠-٩۰-۹]/g, (ch) => arabicMap[ch] || ch);
}

export function sanitizePlan(p: StorePlan): StorePlan {
  return {
    ...p,
    labelAr: toWesternDigits(p.labelAr),
    labelEn: toWesternDigits(p.labelEn),
    badgeAr: p.badgeAr ? toWesternDigits(p.badgeAr) : '',
    badgeEn: p.badgeEn ? toWesternDigits(p.badgeEn) : '',
    featuresAr: toWesternDigits(p.featuresAr),
    featuresEn: toWesternDigits(p.featuresEn),
    durationDays: sanitizeDurationDays(p.durationDays),
    priceUsd: Math.max(0, Number(toWesternDigits(p.priceUsd)) || 0),
  };
}

// Durations may be fractional (1 hour = 1/24 day), so no integer rounding here.
function sanitizeDurationDays(v: any): number {
  const n = Number(toWesternDigits(v));
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.max(1 / 24, Math.round(n * 1000000) / 1000000);
}

export function fallbackPlans(): StorePlan[] {
  const removed = removedDefaultKeys();
  return DEFAULT_PLANS.filter((p) => !removed.includes(p.key)).map((p) => sanitizePlan({ ...p, id: `default_${p.key}` }));
}

// ── Removing the built-in plans ────────────────────────────────────────────
// The three starter plans are code, not documents, so there is nothing in
// Firestore to delete. A removal is therefore recorded as a KEY in
// shared_settings/removed_default_plans: fetchPlans skips those keys, so a plan
// the developer deleted stays deleted (on every device) instead of reappearing
// on the next load. Removing a real document also records its key, otherwise the
// built-in plan of the same key would spring back the moment it is deleted.
const REMOVED_DOC_ID = 'removed_default_plans';
const REMOVED_LS_KEY = 'finalyze_removed_default_plans';

export function removedDefaultKeys(): string[] {
  try {
    const raw = localStorage.getItem(REMOVED_LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function cacheRemovedKeys(keys: string[]) {
  try { localStorage.setItem(REMOVED_LS_KEY, JSON.stringify(keys)); } catch {}
}

async function syncRemovedKeys(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'shared_settings', REMOVED_DOC_ID));
    const data = snap.data() as any;
    const keys: string[] = Array.isArray(data?.keys) ? data.keys.filter((k: any) => typeof k === 'string') : [];
    cacheRemovedKeys(keys);
    return keys;
  } catch {
    return removedDefaultKeys();
  }
}

export async function markPlansRemoved(keys: string[]): Promise<void> {
  const merged = Array.from(new Set([...removedDefaultKeys(), ...keys.filter(Boolean)]));
  cacheRemovedKeys(merged);
  try {
    await setDoc(doc(db, 'shared_settings', REMOVED_DOC_ID), { keys: merged, updatedAt: Date.now() }, { merge: true });
  } catch {}
}

export async function restoreDefaultPlans(): Promise<string[]> {
  cacheRemovedKeys([]);
  try {
    await setDoc(doc(db, 'shared_settings', REMOVED_DOC_ID), { keys: [], updatedAt: Date.now() }, { merge: true });
  } catch {}
  return removedDefaultKeys();
}

export async function fetchPlans(): Promise<StorePlan[]> {
  const removed = await syncRemovedKeys();
  try {
    const snap = await getDocs(query(collection(db, 'store_plans'), orderBy('sortOrder', 'asc')));
    if (snap.empty) return fallbackPlans();
    const list = snap.docs.map((d) => sanitizePlan({ id: d.id, ...(d.data() as Omit<StorePlan, 'id'>) }));
    for (const p of DEFAULT_PLANS) {
      if (removed.includes(p.key)) continue;
      if (!list.some((x) => x.key === p.key)) {
        const fp = sanitizePlan({ ...p, id: `default_${p.key}` });
        list.push(fp);
      }
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return fallbackPlans();
  }
}

export async function addStorePlan(plan: Omit<StorePlan, 'id'>): Promise<string> {
  const sanitized = {
    ...plan,
    labelAr: toWesternDigits(plan.labelAr),
    labelEn: toWesternDigits(plan.labelEn),
    badgeAr: plan.badgeAr ? toWesternDigits(plan.badgeAr) : '',
    badgeEn: plan.badgeEn ? toWesternDigits(plan.badgeEn) : '',
    featuresAr: toWesternDigits(plan.featuresAr),
    featuresEn: toWesternDigits(plan.featuresEn),
    durationDays: sanitizeDurationDays(plan.durationDays),
    priceUsd: Math.max(0, Number(toWesternDigits(plan.priceUsd)) || 0),
  };
  const ref = await addDoc(collection(db, 'store_plans'), sanitized);
  return ref.id;
}

export async function updateStorePlan(id: string, patch: Partial<Omit<StorePlan, 'id'>>): Promise<void> {
  const sanitized: Record<string, any> = { ...patch };
  if (patch.labelAr !== undefined) sanitized.labelAr = toWesternDigits(patch.labelAr);
  if (patch.labelEn !== undefined) sanitized.labelEn = toWesternDigits(patch.labelEn);
  if (patch.badgeAr !== undefined) sanitized.badgeAr = toWesternDigits(patch.badgeAr);
  if (patch.badgeEn !== undefined) sanitized.badgeEn = toWesternDigits(patch.badgeEn);
  if (patch.featuresAr !== undefined) sanitized.featuresAr = toWesternDigits(patch.featuresAr);
  if (patch.featuresEn !== undefined) sanitized.featuresEn = toWesternDigits(patch.featuresEn);
  if (patch.durationDays !== undefined) sanitized.durationDays = sanitizeDurationDays(patch.durationDays);
  if (patch.priceUsd !== undefined) sanitized.priceUsd = Math.max(0, Number(toWesternDigits(patch.priceUsd)) || 0);
  await setDoc(doc(db, 'store_plans', id), sanitized, { merge: true });
}

/**
 * Deletes a plan for good. A real document is removed from Firestore; a
 * built-in plan (or a document whose key matches one) is recorded as removed so
 * it cannot reappear on the next load. Either way the plan is gone.
 */
export async function deleteStorePlan(id: string, key?: string): Promise<void> {
  const isDefaultRow = id.startsWith('default_');
  const planKey = key || (isDefaultRow ? id.replace('default_', '') : '');
  if (isDefaultRow) {
    await markPlansRemoved([planKey]);
    return;
  }
  await deleteDoc(doc(db, 'store_plans', id));
  // A deleted document that shadows a built-in key would let that built-in plan
  // come back on the next fetch, so the key is retired as well.
  if (planKey && DEFAULT_PLANS.some((p) => p.key === planKey)) await markPlansRemoved([planKey]);
}

export function planFeatures(plan: StorePlan, isAr: boolean): string[] {
  const raw = isAr ? plan.featuresAr : plan.featuresEn;
  return (toWesternDigits(raw) || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function planLabel(plan: StorePlan, isAr: boolean): string {
  const lbl = (isAr ? plan.labelAr : plan.labelEn) || plan.key;
  return toWesternDigits(lbl);
}

// Auto-translate English plan features into Arabic through the server's
// developer-only /api/translate (pooled AI keys). Returns null on failure so
// the caller can fall back to showing the English text.
export async function translateToArabic(text: string): Promise<string | null> {
  const src = (text || '').trim();
  if (!src) return null;
  try {
    const token = await auth.currentUser?.getIdToken();
    const resp = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text: src }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    let ar = typeof data?.ar === 'string' ? data.ar.trim() : '';
    if (!ar) return null;
    // Strip model chatter: quotes, backticks, leading "translation:" labels.
    ar = ar.replace(/^```[\s\S]*?```$/m, (m) => m.replace(/^```[a-z]*\n?|\n?```$/g, ''));
    ar = ar.replace(/^["'`“”]+|["'`“”]+$/g, '');
    ar = ar.replace(/^(translation|الترجمة)\s*:\s*/i, '');
    return ar.trim() || null;
  } catch {
    return null;
  }
}