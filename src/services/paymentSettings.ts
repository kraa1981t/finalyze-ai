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

// Payment confirmation is MANUAL only. When the customer clicks "I have paid",
// a numbered request lands in the developer panel (store settings) carrying the
// customer email, product, price and the EXACT GMT timestamp of the click.
// The developer compares that timestamp with the deposit arrival in their
// wallet, then either confirms (releases the download) or rejects the request.
export type ConfirmMode = 'manual';

export const DEFAULT_CONFIRM_MODE: ConfirmMode = 'manual';
export const DEFAULT_BINANCE_EMAIL = 'kraamohamed478@gmail.com';

// Only STABLE coins are accepted. USDT variants are pegged (1 USDT = $1),
// so no live-price conversion is needed and the amount is always exact.
// Volatile coins (LTC / TRX / SOL ...) were removed deliberately.
export const PAYMENT_METHODS: PaymentMethodDef[] = [
  { method: 'usdt_trc20', label: 'USDT (TRC20)', symbol: 'USDT', stable: true },
  { method: 'usdt_erc20', label: 'USDT (ERC20)', symbol: 'USDT', stable: true },
  { method: 'usdt_bep20', label: 'USDT (BEP20)', symbol: 'USDT', stable: true },
  { method: 'usdt_polygon', label: 'USDT (Polygon)', symbol: 'USDT', stable: true },
  { method: 'usdt_solana', label: 'USDT (Solana)', symbol: 'USDT', stable: true },
  { method: 'usdt_optimism', label: 'USDT (Optimism)', symbol: 'USDT', stable: true },
  { method: 'usdt_arbitrum', label: 'USDT (Arbitrum)', symbol: 'USDT', stable: true },
];

// CoinGecko key for live price display in the customer payment screen.
export const SYMBOL_TO_PRICE_KEY: Record<string, string> = {
  USDT: 'tether',
};

// Ensure every address has the full shape (method, label, symbol, stable).
// Old records may store only { id, name, address } with no method — infer from
// the display name; fill missing fields from the PAYMENT_METHODS definition.
export function normalizeAddresses(list: any[] | undefined): PaymentAddress[] {
  if (!Array.isArray(list)) return [];
  const out: PaymentAddress[] = [];
  for (const a of list) {
    if (!a || typeof a !== 'object' || !a.address) continue;
    const method = String(a.method || '');
    let def = PAYMENT_METHODS.find((m) => m.method === method);
    if (!def && a.name) {
      const byLabel = PAYMENT_METHODS.find((m) => m.label.toLowerCase() === String(a.name).toLowerCase());
      const bySymbol = PAYMENT_METHODS.find((m) => m.symbol.toLowerCase() === String(a.symbol || a.name || '').toLowerCase());
      if (byLabel) def = byLabel;
      else if (bySymbol) def = bySymbol;
      else if (String(a.name).toLowerCase().includes('usdt')) def = PAYMENT_METHODS[0];
    }
    if (!def) continue;
    out.push({
      method: def.method,
      label: def.label,
      symbol: def.symbol,
      stable: a.stable === true || def.stable,
      address: String(a.address),
    });
  }
  return out;
}

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
  if (Array.isArray(direct) && direct.length) return normalizeAddresses(direct);
  const legacy = data?.[LEGACY_USDT_FIELD];
  if (Array.isArray(legacy) && legacy.length) {
    return normalizeAddresses(
      (legacy as any[])
        .filter((a) => a?.network && a?.address)
        .map((a) => ({
          method: `usdt_${a.network}`,
          name: `USDT (${a.networkLabel || a.network})`,
          symbol: 'USDT',
          stable: true,
          address: a.address,
        }))
    );
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