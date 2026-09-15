import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PaymentAddress {
  id: string;
  name: string;
  address: string;
}

export interface PaymentSettingsData {
  addresses: PaymentAddress[];
  updatedAt: number;
}

const PAYMENTS_SETTINGS_DOC = 'payments';

export async function savePaymentSettings(data: Partial<PaymentSettingsData>): Promise<void> {
  try {
    await setDoc(doc(db, 'shared_settings', PAYMENTS_SETTINGS_DOC), {
      ...data,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (e) {
    console.warn('[PAYMENT] Failed to save payment settings to Firestore:', e);
  }
}

export async function loadPaymentSettings(): Promise<Partial<PaymentSettingsData> | null> {
  try {
    const snap = await getDoc(doc(db, 'shared_settings', PAYMENTS_SETTINGS_DOC));
    if (snap.exists()) return snap.data() as Partial<PaymentSettingsData>;
  } catch (e) {
    console.warn('[PAYMENT] Failed to load payment settings from Firestore:', e);
  }
  return null;
}