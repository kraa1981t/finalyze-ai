import { db, auth } from '../lib/firebase';
import { clientDocId } from '../lib/clientIds';
import { ensureClientIdentity } from './clientIdentity';
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
  Timestamp,
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
  planUnit?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  planUnits?: number;
  amountUsd?: number;
  expiryDate?: string;
  durationDays?: number;
  status: 'active' | 'consumed';
  requestNo?: number;
  activatedAt?: any;
  /** The instant the developer approved. Approval IS the release. */
  releasedAt?: any;
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

// Firestore is locked down by rules that only recognise a signed-in account, so
// every server call carries this session's own ID token. The server replays it
// on the Firestore REST call and the rules decide — the server itself never
// needs (and never holds) a privileged credential.
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ── The plan clock ─────────────────────────────────────────────────────────
// A grant stores only WHEN the plan started (a Firestore Timestamp written by
// the owner, bounded by the rules to within 5 minutes of server time and
// frozen after the first write). The END of the period is computed from
// start + duration at read time, so no hand-written "expires in 2099" date
// can ever reach the app. A release-time expiryDate (developer-written) wins.
function toMillis(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  // Firestore returns plain numbers as strings in some paths ("1790600575145")
  if (typeof v === 'string' && /^\d{10,}$/.test(v.trim())) return Number(v.trim());
  const t = new Date(v).getTime();
  return isFinite(t) ? t : 0;
}

export function deriveGrantExpiry<T extends { expiryDate?: string; activatedAt?: any; durationDays?: number; createdAt?: any }>(g: T): T {
  if (g.expiryDate) return g;
  // Clock: the activation instant when it exists, otherwise the moment the
  // developer approved it. An approval that never got activated still counts —
  // otherwise a paid plan silently reads as free after a page reload.
  const start = toMillis(g.activatedAt) || toMillis(g.createdAt);
  if (!start) return g;
  const days = Number(g.durationDays || 0) > 0 ? Number(g.durationDays) : 30;
  return { ...g, expiryDate: new Date(start + days * 86400000).toISOString() };
}

const grantStarted = (g: { expiryDate?: string; activatedAt?: any }): boolean =>
  !!g.expiryDate || toMillis(g.activatedAt) > 0;

export function grantKey(kind: ProductKind, botId?: string, planReqNo?: number): string {
  // Bots are keyed per-product (bot_<id>). Plans are keyed PER REQUEST
  // (plan_<requestNo>) so a new purchase with the same email can never match an
  // older plan grant — every plan purchase must wait for its own developer approval.
  return kind === 'bot' ? `bot_${botId || 'unknown'}` : `plan_${planReqNo ? String(planReqNo) : 'none'}`;
}

export function grantDocId(email: string, kind: ProductKind, botId?: string, planReqNo?: number): string {
  return `${sanitize(email)}__${grantKey(kind, botId, planReqNo)}`;
}

// ── Plan grants: the single most sensitive collection ───────────────────────
// A grant unlocks a paid plan, so the Firestore rules allow CREATING one only
// for the developer. The grant is therefore written from the developer's own
// signed-in browser (not from the public-key server call), which is what makes
// it impossible for a client — or any visitor — to hand themselves a plan.
export async function writeGrantFromDeveloper(req: PaymentRequest): Promise<void> {
  const email = String(req.buyerEmail || '').toLowerCase().trim();
  if (!email) return;
  const kind = (req.kind || 'bot') as ProductKind;
  const days = Number(req.durationDays) > 0 ? Number(req.durationDays) : 30;
  const grant: Record<string, any> = {
    email,
    kind,
    botId: req.botId,
    botName: req.botName,
    planLabel: req.planLabel,
    status: 'active',
    requestNo: req.requestNo,
    createdAt: Date.now(),
  };
  if (kind === 'plan') grant.durationDays = days;
  const docKey = grantDocId(email, kind, req.botId, kind === 'plan' ? req.requestNo : undefined);
  await Promise.allSettled([
    setDoc(doc(db, GRANTS, docKey), grant, { merge: true }),
    setDoc(doc(db, 'shared_settings', `grant_${docKey}`), grant, { merge: true }),
    setDoc(doc(db, 'shared_status', `grant_${docKey}`), grant, { merge: true }),
  ]);
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
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
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
    const resp = await fetch('/api/payment-requests-list', { headers: await authHeaders() });
    const data = await resp.json();
    if (data.ok && Array.isArray(data.items)) return data.items as PaymentRequest[];
  } catch {}
  return [];
}

// A client's own purchase requests. Scoped by their own address: the rules do
// not allow a client to list the whole collection, so the developer list and the
// customer list are fetched through separate, separately-permitted paths.
export async function fetchUserPaymentRequests(email: string): Promise<PaymentRequest[]> {
  const e = (email || '').toLowerCase().trim();
  if (!e) return [];
  try {
    const snap = await getDocs(query(collection(db, REQUESTS), where('buyerEmail', '==', e)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaymentRequest[];
  } catch {
    return [];
  }
}

export async function approvePaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  await fetch('/api/payment-request-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ id: req.id, action: 'approve', developerEmail }),
  });
}

export async function rejectPaymentRequest(req: PaymentRequest, developerEmail: string): Promise<void> {
  if (!req.id) return;
  await fetch('/api/payment-request-decision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ id: req.id, action: 'reject', developerEmail }),
  });
}

// ── Grants (persisted server-side so release works whether the site is open or closed) ──
// Newest numbered request this address has ever opened. Used only when the
// pending number did not make it into component state (page reopened, session
// restored after a reload) — without it the grant would be looked up as
// `plan_none`, return nothing, and the customer would wait forever.
async function pendingRequestNoFor(email: string, kind: ProductKind, botId?: string): Promise<number | undefined> {
  const snap = await getDocs(
    query(collection(db, 'payment_sessions'), where('buyerEmail', '==', (email || '').toLowerCase()))
  );
  let best = 0;
  for (const d of snap.docs) {
    const s: any = d.data() || {};
    if (String(s.kind || '') !== kind) continue;
    if (kind === 'bot' && String(s.botId || '') !== String(botId || '')) continue;
    const n = Number(s.requestNo) || 0;
    if (n > best) best = n;
  }
  return best || undefined;
}

export async function checkUserGrant(
  email: string,
  kind: ProductKind,
  botId?: string,
  planReqNo?: number
): Promise<PaymentGrant | null> {
  const e = (email || '').toLowerCase().trim();
  if (!e) return null;

  // 1. Check open collections in Firestore (shared_settings & shared_status) — 100% permission-safe in every browser
  try {
    let no = planReqNo;
    if (kind === 'plan' && !no) no = await pendingRequestNoFor(e, kind, botId);
    if (kind !== 'plan' || no) {
      const docKey = grantDocId(e, kind, botId, kind === 'plan' ? no : undefined);
      const sharedSnap = await getDoc(doc(db, 'shared_settings', `grant_${docKey}`));
      if (sharedSnap.exists()) {
        const g = deriveGrantExpiry({ id: sharedSnap.id, ...(sharedSnap.data() as any) } as PaymentGrant);
        if (g.status === 'active' || !g.status) return g;
      }
      const statusSnap = await getDoc(doc(db, 'shared_status', `grant_${docKey}`));
      if (statusSnap.exists()) {
        const g = deriveGrantExpiry({ id: statusSnap.id, ...(statusSnap.data() as any) } as PaymentGrant);
        if (g.status === 'active' || !g.status) return g;
      }
    }
  } catch (err) {
    console.warn('Open collection grant check error:', err);
  }

  // 2. Check via server endpoint
  try {
    const params = new URLSearchParams({ email: e, kind });
    if (botId) params.set('botId', botId);
    if (planReqNo) params.set('requestNo', String(planReqNo));
    const resp = await fetch(`/api/payment-grant/check?${params.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.ok && data.grant) {
        const g = deriveGrantExpiry(data.grant as PaymentGrant);
        if (g.status === 'active' || !g.status) return g;
      }
    }
  } catch (err) {
    console.warn('Server grant check fetch failed:', err);
  }

  // 3. Fallback check via direct GRANTS collection
  const attempt = async (): Promise<PaymentGrant | null> => {
    let no = planReqNo;
    if (kind === 'plan' && !no) no = await pendingRequestNoFor(e, kind, botId);
    if (kind === 'plan' && !no) return null;
    const snap = await getDoc(doc(db, GRANTS, grantDocId(e, kind, botId, kind === 'plan' ? no : undefined)));
    if (!snap.exists()) return null;
    const g = deriveGrantExpiry({ id: snap.id, ...(snap.data() as any) } as PaymentGrant);
    return g.status === 'active' ? g : null;
  };
  try {
    return await attempt();
  } catch {
    try {
      if (await ensureClientIdentity(e)) return await attempt();
    } catch {}
    return null;
  }
}

// Developer view: every plan grant at once, so Client Monitor can show the
// crown from the AUTHORITATIVE source instead of the client's own row (which
// the rules no longer let a client raise by themselves).
export async function fetchAllPlanGrants(): Promise<PaymentGrant[]> {
  try {
    const snap = await getDocs(query(collection(db, GRANTS), where('kind', '==', 'plan')));
    return snap.docs
      .map((d) => deriveGrantExpiry({ id: d.id, ...(d.data() as any) } as PaymentGrant))
      .filter((g) => g.status === 'active');
  } catch {
    return [];
  }
}

export async function fetchUserGrants(email: string): Promise<PaymentGrant[]> {
  const e = (email || '').toLowerCase().trim();
  if (!e) return [];

  // 1. Primary check via server endpoint
  try {
    const resp = await fetch(`/api/user-grants?email=${encodeURIComponent(e)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data?.ok && Array.isArray(data.grants)) {
        return data.grants
          .map((d: any) => deriveGrantExpiry(d as PaymentGrant))
          .filter((g: PaymentGrant) => g.status === 'active' || !g.status);
      }
    }
  } catch {}

  // 2. Fallback check via direct Firestore Client SDK
  try {
    const snap = await getDocs(
      query(collection(db, GRANTS), where('email', '==', e))
    );
    return snap.docs
      .map((d) => deriveGrantExpiry({ id: d.id, ...(d.data() as any) } as PaymentGrant));
  } catch {
    return [];
  }
}

export async function fetchUserGrantsForEmails(emails: string[]): Promise<PaymentGrant[]> {
  const unique = [...new Set(emails.map((e) => (e || '').toLowerCase().trim()).filter(Boolean))];
  const lists = await Promise.all(unique.map((e) => fetchUserGrants(e)));
  const byId = new Map<string, PaymentGrant>();
  for (const list of lists) {
    for (const g of list) {
      const id = g.id || `${g.email}_${g.requestNo}_${g.createdAt}`;
      if (!byId.has(id)) byId.set(id, g);
    }
  }
  return [...byId.values()];
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

// Client plan activation: start the grace period now that the key is entered.
// Only the START instant is written — as a real Firestore Timestamp, which the
// rules cap to 5 minutes of server time and freeze after the first write. The
// END of the period is derived at read time (start + duration), so the owner
// can never hand themselves a longer plan. Runs in the owner's own session, so
// it keeps working without the server (which is anonymous and now rejected).
export async function activateClientPlan(email: string, requestNo?: number | null): Promise<void> {
  if (!email) return;
  try {
    // The session email is the source of truth here; auth.currentUser is empty
    // on a restored session and used to make this a silent no-op.
    const me = ((auth.currentUser?.email || email) || '').toLowerCase().trim();
    if (!me) return;
    const snap = await getDocs(query(collection(db, GRANTS), where('email', '==', me)));
    for (const d of snap.docs) {
      const g: any = d.data() || {};
      if (String(g.kind || '') !== 'plan') continue;
      if (String(g.status || '') !== 'active') continue;
      if (requestNo && Number(g.requestNo) !== Number(requestNo)) continue;
      if (grantStarted(g)) continue; // already started — keep the original period
      await updateDoc(doc(db, GRANTS, d.id), { activatedAt: Timestamp.now() });
    }
  } catch {}
}

// Dev-only: remove a transaction from the developer purchase history. Client
// data (request + grant) is untouched — the entry only hides in the dev view.
export async function hideTransactionFromDev(id: string): Promise<void> {
  if (!id) return;
  try {
    await fetch('/api/payment-request-hide', {
      method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ id }),
    });
  } catch {}
}

// Client plan deletion: revoke every active plan grant for the email so the
// plan is fully gone and cannot be re-activated by the grants poll, and drop
// the crown off the client row. Both writes run in a signed-in session: the
// rules allow the owner (their own grant/row) and the developer (anything),
// and only ever let a client LOWER their own plan — never raise it.
export async function revokeClientPlanGrants(email: string): Promise<void> {
  const e = (email || '').toLowerCase().trim();
  if (!e) return;
  try {
    const snap = await getDocs(query(collection(db, GRANTS), where('email', '==', e)));
    for (const d of snap.docs) {
      const g: any = d.data() || {};
      if (String(g.kind || '') !== 'plan') continue;
      if (String(g.status || '') !== 'active') continue;
      await updateDoc(doc(db, GRANTS, d.id), { status: 'revoked', revokedAt: Date.now() });
    }
  } catch {}
  try {
    await setDoc(doc(db, 'clients', clientDocId(e)), { plan: 'free', planExpiry: null }, { merge: true });
  } catch {}
}

// Dev-only: full purchase history (all clients, newest first) with GMT dates.
export async function fetchDevHistory(): Promise<PaymentRequest[]> {
  try {
    const resp = await fetch('/api/transaction-history', { headers: await authHeaders() });
    const data = await resp.json();
    if (data.ok && Array.isArray(data.items)) return data.items as PaymentRequest[];
  } catch {}
  return [];
}

// Dev-only: list transaction IDs hidden from the developer history.
export async function fetchDevHiddenTransactionIds(): Promise<string[]> {
  try {
    const resp = await fetch('/api/payment-requests-list', { headers: await authHeaders() });
    const data = await resp.json();
    if (data?.ok && Array.isArray(data.hiddenIds)) return data.hiddenIds as string[];
  } catch {}
  return [];
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
