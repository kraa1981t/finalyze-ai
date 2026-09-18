import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface PaymentAddress {
  method: string;
  label: string;
  symbol: string;
  stable: boolean;
  address: string;
}

export interface PaymentMethodDef {
  method: string;
  label: string;
  symbol: string;
  stable: boolean;
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

// All supported payment methods. USDT variants are stable (1 USDT = $1).
// LTC / TRX / SOL are volatile coins — for those the system matches on the
// exact coin amount the customer was told to send, with a small $ tolerance.
export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { method: 'usdt_trc20', label: 'USDT (TRC20)', symbol: 'USDT', stable: true },
  { method: 'usdt_erc20', label: 'USDT (ERC20)', symbol: 'USDT', stable: true },
  { method: 'usdt_bep20', label: 'USDT (BEP20)', symbol: 'USDT', stable: true },
  { method: 'usdt_polygon', label: 'USDT (Polygon)', symbol: 'USDT', stable: true },
  { method: 'usdt_solana', label: 'USDT (Solana)', symbol: 'USDT', stable: true },
  { method: 'usdt_optimism', label: 'USDT (Optimism)', symbol: 'USDT', stable: true },
  { method: 'usdt_arbitrum', label: 'USDT (Arbitrum)', symbol: 'USDT', stable: true },
  { method: 'ltc', label: 'Litecoin (LTC)', symbol: 'LTC', stable: false },
  { method: 'trx', label: 'TRON (TRX)', symbol: 'TRX', stable: false },
  { method: 'sol', label: 'Solana (SOL)', symbol: 'SOL', stable: false },
];

// CoinGecko key for live price display in the customer payment screen.
export const SYMBOL_TO_PRICE_KEY: Record<string, string> = {
  USDT: 'tether',
  LTC: 'litecoin',
  TRX: 'tron',
  SOL: 'solana',
};

// Legacy field name for USDT-only addresses saved by an earlier version.
const LEGACY_USDT_FIELD = 'usdtAddresses';

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

// Normalize legacy `usdtAddresses` (network list) into the new `addresses` shape.
function normalizeLegacy(data: any): PaymentAddress[] | undefined {
  const direct = data?.addresses;
  if (Array.isArray(direct) && direct.length) return direct as PaymentAddress[];
  const legacy = data?.[LEGACY_USDT_FIELD];
  if (Array.isArray(legacy) && legacy.length) {
    return (legacy as any[])
      .filter((a) => a?.network && a?.address)
      .map((a) => ({
        method: `usdt_${a.network}`,
        label: `USDT (${a.networkLabel || a.network})`,
        symbol: 'USDT',
        stable: true,
        address: a.address,
      }));
  }
  return undefined;
}

export async function loadPaymentSettings(): Promise<Partial<PaymentSettingsData> | null> {
  try {
    const snap = await getDoc(doc(db, 'shared_settings', PAYMENTS_SETTINGS_DOC));
    if (snap.exists()) {
      const raw = snap.data() as any;
      const normalized = normalizeLegacy(raw);
      const out: Partial<PaymentSettingsData> = {
        confirmMode: raw?.confirmMode,
        binanceNotifyEmail: raw?.binanceNotifyEmail,
        updatedAt: raw?.updatedAt,
      };
      if (normalized) out.addresses = normalized;
      return out;
    }
  } catch (e) {
    console.warn('[PAYMENT] Failed to load payment settings from Firestore:', e);
  }
  return null;
}