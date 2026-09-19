import { db } from '../lib/firebase';
import { collection, doc, getDocs, getDoc, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export type SessionStatus = 'active' | 'pending' | 'completed' | 'cancelled';

export interface PaymentSession {
  id: string;
  deviceId: string;
  kind: 'bot' | 'plan';
  botId?: string;
  botName?: string;
  planLabel?: string;
  durationDays?: number;
  amountUsd: number;
  method?: string;
  symbol?: string;
  label?: string;
  address?: string;
  coinId?: string;
  coinName?: string;
  coinAmountExpected?: number;
  buyerEmail?: string;
  requestNo?: number;
  status: SessionStatus;
  timerMinutes: number;
  activeUntil: number;
  createdAt: number;
  updatedAt: number;
}

const LOCAL_KEY = 'finalyze_payment_sessions';
const DEVICE_KEY = 'finalyze_device_id';
const COLLECTION = 'payment_sessions';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
}

export function genSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readLocalSessions(): PaymentSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as PaymentSession[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSessions(list: PaymentSession[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-20)));
  } catch {}
}

export function getCachedSession(id: string): PaymentSession | null {
  return readLocalSessions().find((s) => s.id === id) || null;
}

function upsertLocal(s: PaymentSession): void {
  const list = readLocalSessions().filter((x) => x.id !== s.id);
  list.push(s);
  writeLocalSessions(list);
}

function removeLocal(id: string): void {
  writeLocalSessions(readLocalSessions().filter((x) => x.id !== id));
}

const remoteRef = (id: string) => doc(db, COLLECTION, id);

async function remoteSet(s: PaymentSession): Promise<void> {
  try {
    await setDoc(remoteRef(s.id), s as any, { merge: true });
  } catch {}
}

async function remotePatch(id: string, patch: Partial<PaymentSession>): Promise<void> {
  try {
    await updateDoc(remoteRef(id), patch as any);
  } catch {
    const cur = getCachedSession(id);
    if (cur) await remoteSet({ ...cur, ...patch, updatedAt: Date.now() });
  }
}

async function remoteDelete(id: string): Promise<void> {
  try {
    await deleteDoc(remoteRef(id));
  } catch {}
}

async function remoteList(): Promise<PaymentSession[]> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTION), where('deviceId', '==', getDeviceId()), where('status', 'in', ['active', 'pending'])));
    return snap.docs.map((d) => ({ ...(d.data() as any) })) as PaymentSession[];
  } catch {
    return [];
  }
}

export async function loadSessions(): Promise<PaymentSession[]> {
  const local = readLocalSessions();
  const remote = await remoteList();
  const merged: Map<string, PaymentSession> = new Map();
  local.forEach((s) => merged.set(s.id, s));
  remote.forEach((s) => merged.set(s.id, s));
  return [...merged.values()].filter((s) => s.status === 'active' || s.status === 'pending');
}

export async function createSession(input: Omit<PaymentSession, 'id' | 'deviceId' | 'createdAt' | 'updatedAt' | 'status'>): Promise<PaymentSession> {
  const now = Date.now();
  const s: PaymentSession = {
    ...input,
    id: genSessionId(),
    deviceId: getDeviceId(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  upsertLocal(s);
  await remoteSet(s);
  return s;
}

export async function updateSession(id: string, patch: Partial<PaymentSession>): Promise<void> {
  const local = getCachedSession(id);
  const next = { ...(local || ({ id } as PaymentSession)), ...patch, updatedAt: Date.now() };
  if (local) upsertLocal(next);
  else {
    const list = readLocalSessions();
    list.push(next);
    writeLocalSessions(list);
  }
  await remotePatch(id, { ...patch, updatedAt: Date.now() });
}

export async function completeSession(id: string): Promise<void> {
  await updateSession(id, { status: 'completed' });
}

export async function cancelSession(id: string): Promise<void> {
  await updateSession(id, { status: 'cancelled', activeUntil: Date.now() });
  removeLocal(id);
  await remoteDelete(id);
}

export async function getRemoteSession(id: string): Promise<PaymentSession | null> {
  try {
    const d = await getDoc(remoteRef(id));
    if (d.exists()) return d.data() as PaymentSession;
  } catch {}
  return null;
}