import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

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
    durationDays: Math.max(1, Math.round(Number(toWesternDigits(p.durationDays)) || 30)),
    priceUsd: Math.max(0, Number(toWesternDigits(p.priceUsd)) || 0),
  };
}

export function fallbackPlans(): StorePlan[] {
  return DEFAULT_PLANS.map((p) => sanitizePlan({ ...p, id: `default_${p.key}` }));
}

export async function fetchPlans(): Promise<StorePlan[]> {
  try {
    const snap = await getDocs(query(collection(db, 'store_plans'), orderBy('sortOrder', 'asc')));
    if (snap.empty) return fallbackPlans();
    const list = snap.docs.map((d) => sanitizePlan({ id: d.id, ...(d.data() as Omit<StorePlan, 'id'>) }));
    for (const p of DEFAULT_PLANS) {
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
    durationDays: Math.max(1, Math.round(Number(toWesternDigits(plan.durationDays)) || 30)),
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
  if (patch.durationDays !== undefined) sanitized.durationDays = Math.max(1, Math.round(Number(toWesternDigits(patch.durationDays)) || 30));
  if (patch.priceUsd !== undefined) sanitized.priceUsd = Math.max(0, Number(toWesternDigits(patch.priceUsd)) || 0);
  await setDoc(doc(db, 'store_plans', id), sanitized, { merge: true });
}

export async function deleteStorePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'store_plans', id));
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