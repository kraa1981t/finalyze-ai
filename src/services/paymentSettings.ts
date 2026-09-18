import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PaymentAddress {
  id: string;
  name: string;
  address: string;
}

// Two confirmation methods are available. Both are confirmed MANUALLY by the
// developer from the store settings — the difference is only the customer-facing
// instructions and how the developer cross-checks the incoming payment.
//   'binance_email' -> developer periodically reviews the Binance confirmation
//                      email (kraamohamed478@gmail.com) and matches it by
//                      amount + date/time with the numbered request.
//   'manual'        -> developer reviews the numbered request directly and
//                      releases once the amount is confirmed received.
export type ConfirmMode = 'binance_email' | 'manual';

export const DEFAULT_CONFIRM_MODE: ConfirmMode = 'binance_email';
export const DEFAULT_BINANCE_EMAIL = 'kraamohamed478@gmail.com';

export interface PaymentSettingsData {
  addresses: PaymentAddress[];
  confirmMode: ConfirmMode;
  binanceNotifyEmail: string;
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
