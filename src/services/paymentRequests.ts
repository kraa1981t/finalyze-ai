import { db } from '../lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

export type ConfirmMethod = 'binance_email' | 'manual';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type ProductKind = 'bot' | 'plan';

export interface PaymentRequest {
  id?: string;
  requestNo: number;
  kind: ProductKind;
  botId?: string;
  botName?: string;
  planLabel?: string;
  durationDays?: number;
  amountUsd: number;
  coinId?: string;
  coinName?: string;
  address?: string;
  coinAmountExpected?: number;
  buyerName: string;
  buyerEmail: string;
  method: ConfirmMethod;
  status: RequestStatus;
  note?: string;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
}

export interface PaymentGrant {
  id?: string;
  email: string;
  kind: ProductKind;
  botId?: string;
  botName?: string;
  planLabel?: string;
  expiryDate?: string;
  status: 'active' | 'consumed';
  requestNo?: number;
  createdAt: number;
}

export interface DevNotification {
  id?: string;
  type: 'request' | 'approved' | 'rejected';
  requestNo?: number;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  read: boolean;
  createdAt: number;
}

const REQUESTS = 'payment_requests';
const GRANTS = 'payment_grants';
const NOTIFS = 'dev_notifications';
const COUNTER = 'payment_counter';

const sanitize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

export function grantKey(kind: ProductKind, botId?: string): string {
  return kind === 'bot' ? `bot_${botId || 'unknown'}` : 'plan';
}

export function grantDocId(email: string, kind: ProductKind, botId?: string): string {
  return `${sanitize(email)}__${grantKey(kind, botId)}`;
}

// ── Sequential request numbers (1001, 1002, …) via a single counter doc ──
export async function reserveRequestNo(): Promise<number> {
  const ref = doc(db, 'shared_settings', COUNTER);
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number((snap.data() as any).last) || 1000 : 1000;
    const next = current + 1;
    tx.set(ref, { last: next, updatedAt: Date.now() }, { merge: true });
    return next;
  });
}

export async function createPaymentRequest(
  input: Omit<PaymentRequest, 'id' | 'requestNo' | 'status' | 'createdAt'>
): Promise<PaymentRequest> {
  const requestNo = await reserveRequestNo();
  const payload: Omit<PaymentRequest, 'id'> = {
    ...input,
    buyerEmail: (input.buyerEmail || '').toLowerCase(),
    requestNo,
    status: 'pending',
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, REQUESTS), payload as any);
  const product = input.kind === 'bot' ? (input.botName || 'Bot') : (input.planLabel || 'Plan');
  await addDevNotification({
    type: 'request',
    requestNo,
    titleAr: `طلب تأكيد دفع جديد #${requestNo}`,
    titleEn: `New payment request #${requestNo}`,
    bodyAr: `${input.buyerName || input.buyerEmail} — ${product} — $${input.amountUsd}`,
    bodyEn: `${input.buyerName || input.buyerEmail} — ${product} — $${input.amountUsd}`,
    read: false,
    createdAt: Date.now(),
  });
  return { id: ref.id, ...payload };
}

export async function fetchPaymentRequests(): Promise<PaymentRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, REQUESTS), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentRequest[];
  } catch {
    return [];
  }
}

export async function approvePaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  const now = Date.now();
  await updateDoc(doc(db, REQUESTS, req.id), {
    status: 'approved',
    decidedAt: now,
    decidedBy: developerEmail,
  });

  const id = grantDocId(req.buyerEmail, req.kind, req.botId);
  const grant: Omit<PaymentGrant, 'id'> = {
    email: (req.buyerEmail || '').toLowerCase(),
    kind: req.kind,
    botId: req.botId,
    botName: req.botName,
    planLabel: req.planLabel,
    status: 'active',
    requestNo: req.requestNo,
    createdAt: now,
  };
  if (req.kind === 'plan') {
    const days = Number(req.durationDays) > 0 ? Number(req.durationDays) : 30;
    grant.expiryDate = new Date(now + days * 86400000).toISOString();
  }
  await setDoc(doc(db, GRANTS, id), grant as any, { merge: true });

  await addDevNotification({
    type: 'approved',
    requestNo: req.requestNo,
    titleAr: `تم إفراج الطلب #${req.requestNo}`,
    titleEn: `Request #${req.requestNo} released`,
    bodyAr: `${req.buyerName || req.buyerEmail} — تم تحرير التحميل/الخطة`,
    bodyEn: `${req.buyerName || req.buyerEmail} — download/plan released`,
    read: false,
    createdAt: Date.now(),
  });
}

export async function rejectPaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  await updateDoc(doc(db, REQUESTS, req.id), {
    status: 'rejected',
    decidedAt: Date.now(),
    decidedBy: developerEmail,
  });
}

// ── Grants (persisted server-side so release works whether the site is open or closed) ──
export async function checkUserGrant(
  email: string,
  kind: ProductKind,
  botId?: string
): Promise<PaymentGrant | null> {
  if (!email) return null;
  try {
    const snap = await getDoc(doc(db, GRANTS, grantDocId(email, kind, botId)));
    if (snap.exists()) {
      const g = { id: snap.id, ...(snap.data() as any) } as PaymentGrant;
      if (g.status === 'active') return g;
    }
  } catch {}
  return null;
}

export async function fetchUserGrants(email: string): Promise<PaymentGrant[]> {
  if (!email) return [];
  try {
    const snap = await getDocs(
      query(collection(db, GRANTS), where('email', '==', email.toLowerCase()))
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentGrant[];
  } catch {
    return [];
  }
}

export async function consumeBotGrant(email: string, botId: string): Promise<void> {
  if (!email) return;
  try {
    await updateDoc(doc(db, GRANTS, grantDocId(email, 'bot', botId)), {
      status: 'consumed',
      consumedAt: Date.now(),
    });
  } catch {}
}

// ── Developer notifications ──
export async function addDevNotification(n: Omit<DevNotification, 'id'>): Promise<void> {
  try {
    await addDoc(collection(db, NOTIFS), n as any);
  } catch {}
}

export async function fetchDevNotifications(): Promise<DevNotification[]> {
  try {
    const snap = await getDocs(query(collection(db, NOTIFS), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DevNotification[];
  } catch {
    return [];
  }
}

export async function getUnreadDevNotificationCount(): Promise<number> {
  try {
    const snap = await getDocs(query(collection(db, NOTIFS), where('read', '==', false)));
    return snap.size;
  } catch {
    return 0;
  }
}

export async function markDevNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, NOTIFS, id), { read: true });
  } catch {}
}

export async function markAllDevNotificationsRead(): Promise<void> {
  try {
    const snap = await getDocs(query(collection(db, NOTIFS), where('read', '==', false)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch {}
}

export async function deleteDevNotification(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, NOTIFS, id));
  } catch {}
}
