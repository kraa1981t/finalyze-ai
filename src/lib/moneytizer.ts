import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { MTZ_DEFAULT_ADS_TXT } from './moneytizer-default';
import { MTZ_DEFAULT_HEAD_CODE } from './moneytizer-cmp';

export interface MoneytizerConfig {
  enabled: boolean;
  publisherId: string;
  adsTxtContent: string;
  headCode: string;
}

const MTZ_DOC = 'config/site_moneytizer';
export const MTZ_STORAGE_KEY = 'finalyze_moneytizer_config';

export const DEFAULT_CFG: MoneytizerConfig = {
  enabled: true,
  publisherId: '142894',
  adsTxtContent: MTZ_DEFAULT_ADS_TXT,
  headCode: MTZ_DEFAULT_HEAD_CODE,
};

function normalize(cfg: any): MoneytizerConfig {
  return {
    enabled: cfg?.enabled === true,
    publisherId: cfg?.publisherId || '',
    adsTxtContent: cfg?.adsTxtContent || '',
    headCode: cfg?.headCode || '',
  };
}

function readLocal(): MoneytizerConfig | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MTZ_STORAGE_KEY) || 'null');
    return raw ? normalize(raw) : null;
  } catch { return null; }
}

function writeLocal(cfg: MoneytizerConfig) {
  try { localStorage.setItem(MTZ_STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

export async function loadMoneytizerConfig(): Promise<MoneytizerConfig | null> {
  const local = readLocal();
  try {
    const snap = await getDoc(doc(db, MTZ_DOC));
    if (snap.exists()) {
      const remote = normalize(snap.data());
      writeLocal(remote);
      return remote;
    }
  } catch {}
  return local;
}

export async function saveMoneytizerConfig(cfg: MoneytizerConfig): Promise<void> {
  writeLocal(cfg);
  await setDoc(doc(db, MTZ_DOC), { ...normalize(cfg), updatedAt: Date.now() }, { merge: true });
}

export async function deleteMoneytizerConfig(): Promise<void> {
  try { localStorage.removeItem(MTZ_STORAGE_KEY); } catch {}
  try { await deleteDoc(doc(db, MTZ_DOC)); } catch {}
}

function executeScriptsIn(code: string) {
  const root = document.getElementById('moneytizer-root');
  if (!root) return;

  const temp = document.createElement('div');
  temp.innerHTML = code.trim();

  const scripts = Array.from(temp.querySelectorAll('script'));
  const nonScript = temp.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  if (nonScript) {
    const frag = document.createElement('div');
    frag.innerHTML = nonScript;
    root.appendChild(frag);
  }

  scripts.forEach(oldScript => {
    const script = document.createElement('script');
    if (oldScript.src) {
      script.src = oldScript.src;
    } else {
      script.textContent = oldScript.textContent;
    }
    Array.from(oldScript.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
    script.setAttribute('data-moneytizer', 'true');
    document.head.appendChild(script);
  });
}

export function removeMoneytizer() {
  document.querySelectorAll('script[data-moneytizer]').forEach(el => el.remove());
  document.querySelectorAll('#moneytizer-root').forEach(el => el.remove());
  document.querySelectorAll('[id*="mntz"], [class*="mntz"], [data-zone], [class*="themoneytizer"]').forEach(el => {
    try { el.remove(); } catch {}
  });
}

export function applyMoneytizer(cfg: MoneytizerConfig | null) {
  removeMoneytizer();
  if (cfg && cfg.enabled && cfg.headCode && cfg.headCode.trim()) {
    const root = document.createElement('div');
    root.id = 'moneytizer-root';
    root.style.display = 'none';
    document.head.appendChild(root);
    setTimeout(() => { try { root.style.display = ''; } catch {} }, 600);
    executeScriptsIn(cfg.headCode);
  }
}

export async function initMoneytizer() {
  const cfg = await loadMoneytizerConfig();
  applyMoneytizer(cfg);
}