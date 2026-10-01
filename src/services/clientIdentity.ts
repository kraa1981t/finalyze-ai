import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { clientDocId, DEVELOPER_EMAILS } from '../lib/clientIds';

// ── Automatic client registration ───────────────────────────────────────────
// The FREE plan still needs no login at all — a visitor walks straight in.
// What is automatic is the BUYER: the first successful purchase gives this
// browser an identity for the payment email, so the plan, the key and every
// later visit resolve to the same customer instead of an anonymous session
// (which the rules correctly refuse to hand private data to).
//
// The password is random and lives ONLY in this browser. Nobody can type an
// email into the payment form and become that customer: an existing account
// can only be opened with its own password, and the real owner always
// recovers access through their mailbox.

const CREDS_KEY = 'finalyze_client_credentials';

export interface ClientCredentials {
  email: string;
  password: string;
}

export function readClientCredentials(): ClientCredentials | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && typeof c.email === 'string' && typeof c.password === 'string' && c.email.includes('@')) {
      return { email: c.email.toLowerCase().trim(), password: String(c.password) };
    }
  } catch {}
  return null;
}

export function clearClientCredentials(): void {
  try { localStorage.removeItem(CREDS_KEY); } catch {}
}

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex}Aa1!`;
}

// The row the Monitor shows. Created with plan:free — only the developer can
// ever raise it, so registering never hands anyone a paid plan.
async function ensureClientRow(email: string): Promise<void> {
  try {
    await setDoc(
      doc(db, 'clients', clientDocId(email)),
      {
        email,
        status: 'verified',
        plan: 'free',
        planExpiry: null,
        registeredAt: serverTimestamp(),
        rank: 0,
      },
      { merge: true }
    );
  } catch {}
}

/**
 * Make THIS browser's session belong to `email`.
 * Returns true when Firebase now holds that identity.
 */
export async function ensureClientIdentity(email: string): Promise<boolean> {
  const e = (email || '').toLowerCase().trim();
  if (!e.includes('@')) return false;
  try {
    const current = (auth.currentUser?.email || '').toLowerCase().trim();
    if (current === e) return true;
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      // A developer session is never touched (their reads are already allowed
      // by the rules), another customer's session is simply replaced: this
      // browser is buying under the address just typed.
      if (DEVELOPER_EMAILS.includes(current)) return false;
      try { await signOut(auth); } catch {}
    }

    const creds = readClientCredentials();
    if (creds && creds.email === e) {
      try {
        await signInWithEmailAndPassword(auth, e, creds.password);
        await ensureClientRow(e);
        return true;
      } catch {}
    }

    const password = randomPassword();
    await createUserWithEmailAndPassword(auth, e, password);
    try { localStorage.setItem(CREDS_KEY, JSON.stringify({ email: e, password })); } catch {}
    await ensureClientRow(e);
    return true;
  } catch (err: any) {
    const code = err?.code || err?.message || 'unknown';
    console.warn('[identity] could not register', e, '->', code);
    return (auth.currentUser?.email || '').toLowerCase().trim() === e;
  }
}

/** Silent sign-in for a returning customer — no prompt, no password typing. */
export async function silentClientLogin(): Promise<boolean> {
  const creds = readClientCredentials();
  if (!creds) return false;
  try {
    const current = (auth.currentUser?.email || '').toLowerCase().trim();
    if (current === creds.email) return true;
    if (auth.currentUser && !auth.currentUser.isAnonymous) return false;
    await signInWithEmailAndPassword(auth, creds.email, creds.password);
    await ensureClientRow(creds.email);
    return true;
  } catch {
    return (auth.currentUser?.email || '').toLowerCase().trim() === creds.email;
  }
}
