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
const SITE_REQ_COLLECTION = 'analysisResults';

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
  // Server-side persistence: the numbered request is created from Vercel so it
  // always lands in Firestore, regardless of client SDK write conditions.
  const resp = await fetch('/api/payment-request/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: input.kind,
      botId: input.botId,
      botName: input.botName,
      planLabel: input.planLabel,
      durationDays: input.durationDays,
      amountUsd: input.amountUsd,
      coinId: input.coinId,
      coinName: input.coinName,
      address: input.address,
      coinAmountExpected: input.coinAmountExpected,
      buyerName: (input.buyerName || '').trim(),
      buyerEmail: (input.buyerEmail || '').trim(),
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.ok) {
    throw new Error(data?.error || 'request create failed');
  }
  return {
    ...input,
    id: data.id,
    requestNo: Number(data.requestNo),
    status: 'pending',
    createdAt: Date.now(),
  };
}

export async function fetchPaymentRequests(): Promise<PaymentRequest[]> {
  try {
    const resp = await fetch('/api/payment-requests-list');
    const data = await resp.json();
    if (data.ok && Array.isArray(data.items)) return data.items as PaymentRequest[];
  } catch {}
  try {
    const snap = await getDocs(query(collection(db, REQUESTS), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentRequest[];
  } catch {
    return [];
  }
}

export async function approvePaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  await fetch('/api/payment-request-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: req.id, action: 'approve', developerEmail }),
  });
}

export async function rejectPaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  await fetch('/api/payment-request-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: req.id, action: 'reject', developerEmail }),
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
    // Source of truth: payment requests still awaiting a developer decision.
    // Notifications are informational only — a decided request must not keep
    // the red badge alive, no matter how old its unread notification is.
    const snap = await getDocs(query(collection(db, REQUESTS), where('status', '==', 'pending')));
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

// ── Website creation requests ──
// Stored in `analysisResults` with _type='siteRequest' (same open collection the
// suggestions use) so anonymous clients can submit and the developer gets a badge.
export interface SiteRequest {
  id?: string;
  name: string;
  contact: string;
  message: string;
  read: boolean;
  createdAt: any;
}

export async function submitSiteRequest(input: { name: string; contact: string; message: string }): Promise<void> {
  await addDoc(collection(db, SITE_REQ_COLLECTION), {
    _type: 'siteRequest',
    name: (input.name || '').trim(),
    contact: (input.contact || '').trim(),
    message: (input.message || '').trim(),
    read: false,
    createdAt: new Date(),
  });
}

export async function fetchSiteRequests(): Promise<SiteRequest[]> {
  try {
    const snap = await getDocs(query(collection(db, SITE_REQ_COLLECTION), where('_type', '==', 'siteRequest')));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }) as SiteRequest)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch {
    return [];
  }
}

export async function markAllSiteRequestsRead(): Promise<void> {
  try {
    const snap = await getDocs(query(collection(db, SITE_REQ_COLLECTION), where('_type', '==', 'siteRequest'), where('read', '==', false)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch {}
}

export async function getUnreadSiteRequestCount(): Promise<number> {
  try {
    const snap = await getDocs(query(collection(db, SITE_REQ_COLLECTION), where('_type', '==', 'siteRequest'), where('read', '==', false)));
    return snap.size;
  } catch {
    return 0;
  }
}

export async function deleteSiteRequest(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SITE_REQ_COLLECTION, id));
  } catch {}
}
