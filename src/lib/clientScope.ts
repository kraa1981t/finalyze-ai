import { DEVELOPER_EMAILS } from './clientIds';

export function clientScopeKey(email: string | null | undefined, base: string): string {
  const e = (email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return e ? `cxn_${e}__${base}` : `cxn_anon__${base}`;
}

export const CLIENT_OWN_KEY = 'finalyze_client_own_key';

/**
 * True only for the developer's own account. A paying client is NEVER allowed
 * into the shared-key path, even if a shared key happens to sit in storage.
 */
export function isDeveloperKeyAllowed(): boolean {
  const e = currentUserEmail();
  if (!e) return false;
  if (DEVELOPER_EMAILS.includes(e)) return true;
  try { return localStorage.getItem('finalyze_developer_session') === 'true'; } catch { return false; }
}

/** Gemini keys start with AIza/AQ., Groq keys with gsk_. */
export function detectKeyProvider(key: string): 'gemini' | 'groq' {
  const k = (key || '').trim();
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  return 'groq';
}

function ownKeySlug(email: string): string {
  return email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
}

function ownKeyStorageKey(email: string | null | undefined): string {
  const e = (email || '').toLowerCase().trim();
  return e ? `cxn_${ownKeySlug(e)}__own_key` : '';
}

export function readClientOwnKey(email?: string | null): string {
  // STRICT per-email only — a global/generic key must NEVER satisfy the plan
  // gate. A plan only activates with THIS client's own saved key.
  if (!email) return '';
  try {
    return localStorage.getItem(ownKeyStorageKey(email)) || '';
  } catch {
    return '';
  }
}

/**
 * Email of the currently signed-in account, kept in sync by App on every auth
 * change. Services (geminiService/apiDirect) need it without importing Firebase.
 */
let CURRENT_USER_EMAIL: string | null = null;

export function setCurrentUserEmail(email: string | null | undefined): void {
  const e = (email || '').toLowerCase().trim();
  CURRENT_USER_EMAIL = e && e.includes('@') ? e : null;
  try { sessionStorage.setItem('finalyze_current_user_email', CURRENT_USER_EMAIL || ''); } catch {}
}

export function currentUserEmail(): string | null {
  if (CURRENT_USER_EMAIL) return CURRENT_USER_EMAIL;
  try {
    const v = sessionStorage.getItem('finalyze_current_user_email') || '';
    CURRENT_USER_EMAIL = v || null;
  } catch {}
  return CURRENT_USER_EMAIL;
}

const BUYER_EMAILS_KEY = 'finalyze_plan_buyer_emails';
// Buyer emails are stored PER ACCOUNT. A flat list shared by every account that
// ever used this browser is what let a brand new buyer inherit an older
// customer's key — the plan gate then skipped itself. Each account may only
// reach its own email plus the payment emails recorded against it.
const BUYER_MAP_KEY = 'finalyze_plan_buyer_emails_by_account';
const RUNTIME_KEY = 'finalyze_runtime_client_key';

function readBuyerMap(): Record<string, string[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(BUYER_MAP_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (Array.isArray(v)) out[k] = v.map((x: any) => String(x || '').toLowerCase().trim()).filter(Boolean);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Record `email` as a payment email belonging to `accountEmail`. The account is
 * the identity, the payment email an alias of it. Accounts never mix.
 */
export function rememberBuyerEmail(email: string | null | undefined, accountEmail?: string | null): void {
  const e = (email || '').toLowerCase().trim();
  if (!e || !e.includes('@')) return;
  const account = (accountEmail || currentUserEmail() || e).toLowerCase().trim();
  if (!account || !account.includes('@')) return;
  try {
    const map = readBuyerMap();
    const list = map[account] || [];
    if (!list.includes(e)) list.push(e);
    // One-time migration: the old flat list belonged to whichever account is
    // using this browser now, so a returning client keeps their own key instead
    // of being asked to re-enter it.
    if (!localStorage.getItem(BUYER_EMAILS_KEY + '_migrated')) {
      let legacy: string[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(BUYER_EMAILS_KEY) || '[]');
        if (Array.isArray(parsed)) legacy = parsed;
      } catch {}
      for (const x of legacy) {
        const lx = String(x || '').toLowerCase().trim();
        if (lx && !list.includes(lx)) list.push(lx);
      }
      localStorage.setItem(BUYER_EMAILS_KEY + '_migrated', '1');
    }
    map[account] = list.slice(-12);
    localStorage.setItem(BUYER_MAP_KEY, JSON.stringify(map));
  } catch {}
}

export function rememberedBuyerEmails(accountEmail?: string | null): string[] {
  const account = (accountEmail || currentUserEmail() || '').toLowerCase().trim();
  if (!account) return [];
  const map = readBuyerMap();
  if (map[account]) return map[account];
  if (localStorage.getItem(BUYER_EMAILS_KEY + '_migrated')) return [];
  // Pre-migration browser: the flat list belongs to this account only.
  try {
    const arr = JSON.parse(localStorage.getItem(BUYER_EMAILS_KEY) || '[]');
    return Array.isArray(arr) ? arr.map((x: any) => String(x || '').toLowerCase().trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function clientEmailsFor(loginEmail?: string | null): string[] {
  const out: string[] = [];
  const login = (loginEmail || currentUserEmail() || '').toLowerCase().trim();
  // No identity -> no key at all. This is what stops an anonymous or freshly
  // switched session from spending another account's key.
  if (!login || !login.includes('@')) return out;
  out.push(login);
  for (const e of rememberedBuyerEmails(login)) {
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

export function readClientOwnKeyForEmails(emails: string[]): string {
  for (const e of emails) {
    const k = readClientOwnKey(e);
    if (k) return k;
  }
  return '';
}

/**
 * Marks the current session as running on the client's OWN key.
 * Deliberately does NOT write the shared slots (finalyze_key1_value / key2 /
 * the finalyze_api_key cookie) — those belong to the developer and leaking a
 * client's key there would let every other client reuse it.
 */
export function applyRuntimeAnalysisKey(key: string): void {
  const k = (key || '').trim();
  if (!k) return;
  try {
    sessionStorage.setItem('finalyze_runtime_client_key', k);
    sessionStorage.setItem('finalyze_key_mirror', k);
  } catch {}
}

export function writeClientOwnKey(key: string, email?: string | null): void {
  if (!email) return;
  try {
    const e = email.toLowerCase().trim();
    localStorage.setItem(ownKeyStorageKey(e), key || '');
    rememberOwnEmail(ownKeySlug(e), e);
    applyRuntimeAnalysisKey(key);
  } catch {}
}

/**
 * The key a client is allowed to spend for a model-family fallback. A client
 * only ever gets their own key back; a developer additionally gets the shared
 * slots. Never returns another customer's key.
 */
export function getClientOwnKeyForAnalysis(): string {
  const own = readClientOwnKeyForEmails(clientEmailsFor(currentUserEmail()));
  if (own) return own;
  if (!isDeveloperKeyAllowed()) return '';
  try {
    return (
      sessionStorage.getItem(RUNTIME_KEY) ||
      localStorage.getItem('finalyze_key1_value') ||
      localStorage.getItem('finalyze_key2_value') ||
      localStorage.getItem('finalyze_user_groq_api_key') ||
      sessionStorage.getItem('finalyze_key_mirror') ||
      ''
    );
  } catch {
    return '';
  }
}

const OWN_KEY_PREFIX = 'cxn_';
const OWN_KEY_SUFFIX = '__own_key';

/**
 * Every email-scoped key currently stored. The email is recovered from the
 * companion `cxn_<hash>__own_email` entry rather than by reversing the slug —
 * underscores are not a safe stand-in for '@' in an address.
 */
export function scopedOwnKeyEmails(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(OWN_KEY_PREFIX) || !k.endsWith(OWN_KEY_SUFFIX)) continue;
      const slug = k.slice(OWN_KEY_PREFIX.length, -OWN_KEY_SUFFIX.length);
      const email = (localStorage.getItem(`${OWN_KEY_PREFIX}${slug}__own_email`) || '').toLowerCase().trim();
      if (email && !out.includes(email)) out.push(email);
    }
  } catch {}
  return out;
}

function rememberOwnEmail(slug: string, email: string): void {
  try { localStorage.setItem(`${OWN_KEY_PREFIX}${slug}__own_email`, email); } catch {}
}

function purgeEveryScopedOwnKey(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(OWN_KEY_PREFIX)) continue;
      if (k.endsWith(OWN_KEY_SUFFIX) || k.endsWith('__own_email')) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  } catch {}
}

/**
 * Save a NEW key, permanently discarding the previous one. Any key stored under
 * a different email (earlier login, earlier payment email, another account on the
 * same browser) is deleted FIRST so a stale key can never satisfy the plan gate
 * or be used for analysis. Safe to call repeatedly: each call leaves exactly one
 * key, under the current email(s) only.
 */
export function replaceClientOwnKey(key: string, emails: (string | null | undefined)[]): void {
  const k = (key || '').trim();
  if (!k) return;
  purgeEveryScopedOwnKey();
  const list = emails
    .map((e) => (e || '').toLowerCase().trim())
    .filter((e) => !!e && e.includes('@'));
  if (!list.length) return;
  for (const e of list) {
    try {
      localStorage.setItem(ownKeyStorageKey(e), k);
      rememberOwnEmail(ownKeySlug(e), e);
    } catch {}
  }
  applyRuntimeAnalysisKey(k);
}

/** Drop a single email's key — used when the signed-in account changes. */
export function forgetClientOwnKey(email?: string | null): void {
  const e = (email || '').toLowerCase().trim();
  if (!e) return;
  try {
    localStorage.removeItem(ownKeyStorageKey(e));
    localStorage.removeItem(`cxn_${ownKeySlug(e)}__own_email`);
  } catch {}
}

/**
 * Forget an email AND every key reachable through it. A key saved while the
 * buyer was on the site login email may also sit under the payment email, so
 * deleting only one slot would leave the deleted client able to run analysis.
 * Used when the developer removes a client.
 */
export function purgeOwnKeyForEmail(email?: string | null): void {
  const e = (email || '').toLowerCase().trim();
  if (!e) return;
  forgetClientOwnKey(e);
  try {
    for (const alias of clientEmailsFor(e)) forgetClientOwnKey(alias);
  } catch {}
  // If the key currently cached for this browser session belonged to them, drop
  // it as well, otherwise the live analysis call would still use it.
  if (isDeveloperKeyAllowed()) return;
  try {
    if (clientEmailsFor(e).includes(currentUserEmail() || '')) {
      sessionStorage.removeItem(CLIENT_OWN_KEY);
      sessionStorage.removeItem(RUNTIME_KEY);
    }
  } catch {}
}

export function clearClientOwnKey(email?: string | null): void {
  try {
    sessionStorage.removeItem(CLIENT_OWN_KEY);
    sessionStorage.removeItem(RUNTIME_KEY);
    if (email) {
      const e = email.toLowerCase().trim();
      localStorage.removeItem(ownKeyStorageKey(e));
      localStorage.removeItem(`cxn_${ownKeySlug(e)}__own_email`);
    }
  } catch {}
}