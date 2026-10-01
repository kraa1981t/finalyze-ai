import { auth } from '../lib/firebase';

// ── Analysis on the developer's key pool ────────────────────────────────────
// The browser holds NO key. It proves who it is (a Firebase ID token) and the
// server decides which pooled key runs the prompt — after checking that this
// account has a plan that is actually running. Nothing here can be pointed at
// a key from outside the site, because no key is ever sent to the browser.

export interface PoolKeySummary {
  id: string;
  label: string;
  provider: string;
  masked: string;
  enabled: boolean;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
  failCount: number;
  disabledUntil: number;
  cooling: boolean;
  lastError: string;
}

async function idToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return '';
  // A force refresh keeps a long analysis session from dying on an expired token.
  try { return await user.getIdToken(); } catch { return ''; }
}

/**
 * Runs one analysis through the pool. The response shape matches what the
 * analysis pipeline already expects, so nothing downstream had to change.
 */
export async function callAIServer(prompt: string): Promise<any> {
  const token = await idToken();
  if (!token) return { error: 'sign_in_required' };
  try {
    const resp = await fetch('/api/ai-analysis', {
      method: 'POST',
      // The Authorization header is what lets the server read THIS client's plan
      // grant under the same Firestore rules the browser is held to.
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, idToken: token }),
    });
    const data: any = await resp.json().catch(() => ({}));
    if (!resp.ok) return { error: data?.error || `HTTP ${resp.status}` };
    return data;
  } catch (e: any) {
    return { error: e?.message || 'network error' };
  }
}

// ── Developer-only pool management ──────────────────────────────────────────

async function devRequest(path: string, method: 'GET' | 'POST' | 'DELETE', payload?: Record<string, any>): Promise<any> {
  const token = await idToken();
  if (!token) return { ok: false, error: 'sign_in_required' };
  try {
    const resp = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      // The ID token travels with the request and the server verifies it for
      // real — it is never taken on trust from the browser.
      body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });
    const data: any = await resp.json().catch(() => ({}));
    return { ...data, status: resp.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}

export async function fetchPoolKeys(): Promise<{ ok: boolean; items: PoolKeySummary[]; error?: string }> {
  const r = await devRequest('/api/key-pool', 'GET');
  return { ok: !!r.ok, items: Array.isArray(r.items) ? r.items : [], error: r.error };
}

export async function addPoolKey(key: string, label?: string): Promise<{ ok: boolean; item?: PoolKeySummary; error?: string }> {
  const r = await devRequest('/api/key-pool', 'POST', { key, label: label || '' });
  return { ok: !!r.ok, item: r.item || undefined, error: r.error };
}

export async function setPoolKeyEnabled(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const r = await devRequest('/api/key-pool-toggle', 'POST', { id, enabled });
  return { ok: !!r.ok, error: r.error };
}

export async function removePoolKey(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await devRequest(`/api/key-pool?id=${encodeURIComponent(id)}`, 'DELETE');
  return { ok: !!r.ok, error: r.error };
}
