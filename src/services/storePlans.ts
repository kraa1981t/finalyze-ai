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

export function fallbackPlans(): StorePlan[] {
  return DEFAULT_PLANS.map((p) => ({ ...p, id: `default_${p.key}` }));
}

export async function fetchPlans(): Promise<StorePlan[]> {
  try {
    const snap = await getDocs(query(collection(db, 'store_plans'), orderBy('sortOrder', 'asc')));
    if (snap.empty) return fallbackPlans();
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StorePlan, 'id'>) }));
    for (const p of DEFAULT_PLANS) {
      if (!list.some((x) => x.key === p.key)) {
        const fp = { ...p, id: `default_${p.key}` };
        list.push(fp);
      }
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch {
    return fallbackPlans();
  }
}

export async function addStorePlan(plan: Omit<StorePlan, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'store_plans'), plan);
  return ref.id;
}

export async function updateStorePlan(id: string, patch: Partial<Omit<StorePlan, 'id'>>): Promise<void> {
  await setDoc(doc(db, 'store_plans', id), patch, { merge: true });
}

export async function deleteStorePlan(id: string): Promise<void> {
  await deleteDoc(doc(db, 'store_plans', id));
}

export function planFeatures(plan: StorePlan, isAr: boolean): string[] {
  const raw = isAr ? plan.featuresAr : plan.featuresEn;
  return (raw || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function planLabel(plan: StorePlan, isAr: boolean): string {
  return (isAr ? plan.labelAr : plan.labelEn) || plan.key;
}