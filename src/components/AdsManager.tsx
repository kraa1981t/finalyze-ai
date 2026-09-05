import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Eye, EyeOff, Pause, Play, Monitor, Code, X, Copy, Check, Globe, Users, Tag, ArrowLeft, ExternalLink, Clipboard, RotateCcw, Save, AlertTriangle, Link2, Unlink, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/i18n';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  loadMoneytizerConfig, saveMoneytizerConfig, deleteMoneytizerConfig,
  applyMoneytizer, MoneytizerConfig
} from '../lib/moneytizer';

export interface Ad {
  id: string;
  name: string;
  code: string;
  type: 'adsense' | 'adsterra' | 'custom';
  adUnitType: 'social_bar' | 'popunder' | 'banner' | 'native' | 'interstitial';
  position: 'header' | 'sidebar' | 'footer' | 'between' | 'popup' | 'inline';
  size?: string;
  adsterraId?: string;
  enabled: boolean;
  paused: boolean;
  assignedClients: string[];
  createdAt: number;
}

interface AdsManagerProps {
  lang: Language;
  onBack: () => void;
}

export const STORAGE_KEY = 'finalyze_ads_config';

const PRESET_AD_UNITS: Partial<Ad>[] = [
  { name: 'Social Bar', adUnitType: 'social_bar', size: 'Responsive', type: 'adsterra', position: 'between' },
  { name: 'Popunder', adUnitType: 'popunder', size: 'Full Page', type: 'adsterra', position: 'popup' },
  { name: 'Banner 728x90', adUnitType: 'banner', size: '728x90', type: 'adsterra', position: 'header' },
  { name: 'Banner 300x250', adUnitType: 'banner', size: '300x250', type: 'adsterra', position: 'sidebar' },
  { name: 'Banner 160x600', adUnitType: 'banner', size: '160x600', type: 'adsterra', position: 'sidebar' },
  { name: 'Banner 160x300', adUnitType: 'banner', size: '160x300', type: 'adsterra', position: 'sidebar' },
  { name: 'Banner 468x60', adUnitType: 'banner', size: '468x60', type: 'adsterra', position: 'header' },
  { name: 'Banner 320x50', adUnitType: 'banner', size: '320x50', type: 'adsterra', position: 'footer' },
];

const AD_UNIT_TYPE_ICONS: Record<string, string> = {
  social_bar: '📱',
  popunder: '🪟',
  banner: '🖼️',
  native: '📰',
  interstitial: '🔲',
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const ADS_DOC = 'config/site_ads';

function loadAdsLocal(): Ad[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return stored.map((ad: any) => ({
      id: ad.id || generateId(),
      name: ad.name || 'Untitled Ad',
      code: ad.code || '',
      type: ad.type || 'adsterra',
      adUnitType: ad.adUnitType || 'banner',
      position: ad.position || 'header',
      size: ad.size || undefined,
      adsterraId: ad.adsterraId || undefined,
      enabled: ad.enabled === true,
      paused: ad.paused === true,
      assignedClients: Array.isArray(ad.assignedClients) ? ad.assignedClients : [],
      createdAt: ad.createdAt || Date.now(),
    }));
  } catch { return []; }
}

export async function loadAdsFromFirestore(): Promise<Ad[]> {
  try {
    const snap = await getDoc(doc(db, ADS_DOC));
    if (snap.exists()) {
      const data = snap.data();
      return (data.ads || []).map((ad: any) => ({
        id: ad.id || generateId(),
        name: ad.name || 'Untitled Ad',
        code: ad.code || '',
        type: ad.type || 'adsterra',
        adUnitType: ad.adUnitType || 'banner',
        position: ad.position || 'header',
        size: ad.size || undefined,
        adsterraId: ad.adsterraId || undefined,
        enabled: ad.enabled === true,
        paused: ad.paused === true,
        assignedClients: Array.isArray(ad.assignedClients) ? ad.assignedClients : [],
        createdAt: ad.createdAt || Date.now(),
      }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveAdsToFirestore(ads: Ad[]): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
  const clean = ads.map(ad => {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(ad)) {
      if (v !== undefined) obj[k] = v;
    }
    return obj;
  });
  await setDoc(doc(db, ADS_DOC), { ads: clean, updatedAt: Date.now() }, { merge: true });
}

function loadAds(): Ad[] {
  return loadAdsLocal();
}

function saveAds(ads: Ad[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
}

function loadClientEmails(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem('finalyze_client_emails') || '[]');
    if (Array.isArray(raw) && raw.length > 0) {
      if (typeof raw[0] === 'string') return raw;
      return raw.map((c: any) => c.email || c).filter(Boolean);
    }
    return [];
  } catch { return []; }
}

const POSITIONS: Record<string, { ar: string; en: string }> = {
  header: { ar: 'أعلى الصفحة', en: 'Top of Page' },
  sidebar: { ar: 'الشريط الجانبي', en: 'Sidebar' },
  footer: { ar: 'أسفل الصفحة', en: 'Bottom of Page' },
  between: { ar: 'بين الأقسام', en: 'Between Sections' },
  popup: { ar: 'نافذة منبثقة', en: 'Popup' },
  inline: { ar: 'داخل المحتوى', en: 'Inline Content' },
};

const AD_UNIT_TYPES: Record<string, { ar: string; en: string }> = {
  social_bar: { ar: 'شريط اجتماعي', en: 'Social Bar' },
  popunder: { ar: 'نافذة منبثقة خلفية', en: 'Popunder' },
  banner: { ar: 'بانر', en: 'Banner' },
  native: { ar: 'إعلان أصلي', en: 'Native Ad' },
  interstitial: { ar: 'شاشة كاملة', en: 'Interstitial' },
};

export default function AdsManager({ lang, onBack }: AdsManagerProps) {
  const isAr = lang === 'ar';
  const [ads, setAds] = useState<Ad[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadAdsFromFirestore().then(firestoreAds => {
      if (firestoreAds.length > 0) {
        setAds(firestoreAds);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreAds));
      } else {
        const local = loadAds();
        setAds(local);
        if (local.length > 0) {
          saveAdsToFirestore(local);
        }
      }
    }).catch(() => {
      setAds(loadAds());
    });
  }, []);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [editAd, setEditAd] = useState<string | null>(null);
  const [codeModal, setCodeModal] = useState<Ad | null>(null);
  const [copied, setCopied] = useState(false);
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [assignModal, setAssignModal] = useState<Ad | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const [newAd, setNewAd] = useState({
    name: '',
    code: '',
    type: 'adsterra' as Ad['type'],
    adUnitType: 'banner' as Ad['adUnitType'],
    position: 'header' as Ad['position'],
    size: '',
    adsterraId: '',
  });

  useEffect(() => { setClientEmails(loadClientEmails()); }, []);

  // ── Moneytizer (موقع إعلانات) ──
  const [mtz, setMtz] = useState<MoneytizerConfig>({
    enabled: false,
    publisherId: '',
    adsTxtContent: '',
    headCode: '',
  });
  const [mtzLoaded, setMtzLoaded] = useState(false);
  const [mtzDirty, setMtzDirty] = useState(false);
  const [mtzSaving, setMtzSaving] = useState(false);

  useEffect(() => {
    loadMoneytizerConfig().then(cfg => {
      if (cfg) setMtz(cfg);
      setMtzLoaded(true);
    }).catch(() => setMtzLoaded(true));
  }, []);

  const updateMtz = (updates: Partial<MoneytizerConfig>) => {
    setMtz(prev => ({ ...prev, ...updates }));
    setMtzDirty(true);
  };

  const handleMtzSave = async () => {
    setMtzSaving(true);
    try {
      await saveMoneytizerConfig(mtz);
      applyMoneytizer(mtz);
      setMtzDirty(false);
      showToast(
        mtz.enabled
          ? (isAr ? 'تم ربط موقع إعلانات وتفعيله بنجاح' : 'Ad network linked & enabled successfully')
          : (isAr ? 'تم حفظ إعدادات موقع إعلانات (معطل)' : 'Ad network settings saved (disabled)'),
        'ok'
      );
    } catch (e: any) {
      console.error('Moneytizer save error:', e);
      showToast(isAr ? `خطأ: ${e.message}` : `Error: ${e.message}`, 'err');
    }
    setMtzSaving(false);
  };

  const handleMtzDelete = async () => {
    if (!confirm(isAr ? 'فك ربط موقع إعلانات وحذف كل إعداداته؟' : 'Unlink ad network and delete all its settings?')) return;
    await deleteMoneytizerConfig();
    applyMoneytizer(null);
    setMtz({ enabled: false, publisherId: '', adsTxtContent: '', headCode: '' });
    setMtzDirty(false);
    showToast(isAr ? 'تم فك الربط بنجاح — لن تظهر إعلاناته' : 'Unlinked successfully — no more ads from it', 'ok');
  };

  const mtzLinked = mtzLoaded && mtz.enabled && !!(mtz.headCode?.trim()) && !!(mtz.adsTxtContent?.trim());

  const addAd = () => {
    if (!newAd.name.trim()) return;
    const ad: Ad = {
      id: generateId(),
      name: newAd.name.trim(),
      code: newAd.code.trim(),
      type: newAd.type,
      adUnitType: newAd.adUnitType,
      position: newAd.position,
      size: newAd.size || undefined,
      adsterraId: newAd.adsterraId || undefined,
      enabled: true,
      paused: false,
      assignedClients: [],
      createdAt: Date.now(),
    };
    setAds(prev => [...prev, ad]);
    setHasUnsavedChanges(true);
    setNewAd({ name: '', code: '', type: 'adsterra', adUnitType: 'banner', position: 'header', size: '', adsterraId: '' });
    setShowAdd(false);
  };

  const addFromPreset = (preset: Partial<Ad>) => {
    const ad: Ad = {
      id: generateId(),
      name: preset.name || '',
      code: '',
      type: preset.type || 'adsterra',
      adUnitType: preset.adUnitType || 'banner',
      position: preset.position || 'header',
      size: preset.size,
      adsterraId: '',
      enabled: false,
      paused: false,
      assignedClients: [],
      createdAt: Date.now(),
    };
    setAds(prev => [...prev, ad]);
    setHasUnsavedChanges(true);
    setShowPresetPicker(false);
    setEditAd(ad.id);
  };

  const updateAd = (id: string, updates: Partial<Ad>) => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    setHasUnsavedChanges(true);
  };

  const deleteAd = (id: string) => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Are you sure you want to delete this ad?')) return;
    setAds(prev => prev.filter(a => a.id !== id));
    setHasUnsavedChanges(true);
  };

  const toggleClientAssignment = (adId: string, clientEmail: string) => {
    setAds(prev => prev.map(a => {
      if (a.id !== adId) return a;
      const has = a.assignedClients.includes(clientEmail);
      return {
        ...a,
        assignedClients: has
          ? a.assignedClients.filter(c => c !== clientEmail)
          : [...a.assignedClients, clientEmail],
      };
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAdsToFirestore(ads);
      setHasUnsavedChanges(false);
      showToast(isAr ? 'تم الحفظ بنجاح' : 'Saved successfully', 'ok');
    } catch (e: any) {
      console.error('Save error:', e);
      showToast(isAr ? `خطأ: ${e.message}` : `Error: ${e.message}`, 'err');
    }
    setSaving(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredAds = filterType === 'all' ? ads : ads.filter(a => a.adUnitType === filterType);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white">{isAr ? 'إدارة الإعلانات' : 'Ads Manager'}</h1>
            <p className="text-xs text-slate-400">{isAr ? 'إدارة إعلانات Adsterra لحسابات العملاء' : 'Manage Adsterra ads for client accounts'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://beta.publishers.adsterra.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-3 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <ExternalLink size={12} />
            {isAr ? 'لوحة Adsterra' : 'Adsterra Panel'}
          </a>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving}
            className={`flex items-center gap-2 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg ${
              hasUnsavedChanges
                ? 'bg-amber-400 hover:bg-amber-500 text-black shadow-amber-400/20 animate-pulse'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}
          >
            <RotateCcw size={14} className={saving ? 'animate-spin' : ''} />
            {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
          </button>
          <button
            onClick={() => setShowPresetPicker(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all"
          >
            <Plus size={16} />
            {isAr ? 'قالب سريع' : 'Quick Add'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary hover:bg-emerald-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={16} />
            {isAr ? 'إعلان مخصص' : 'Custom Ad'}
          </button>
        </div>
      </div>

      {/* ── موقع إعلانات (The Moneytizer) ── */}
      <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5 md:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
              <Globe size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                {isAr ? 'موقع إعلانات' : 'Ad Network'}
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/20 text-indigo-300">The Moneytizer</span>
              </h2>
              <p className="text-[11px] text-slate-400">{isAr ? 'ربط شبكة إعلانات خارجية (Header Bidding) بموقعك' : 'Link an external ad network (Header Bidding) to your site'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mtzLoaded && (
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black ${
                mtzLinked ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                mtz.enabled ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                'bg-white/5 text-slate-500 border border-white/10'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mtzLinked ? 'bg-emerald-400 animate-pulse' : mtz.enabled ? 'bg-amber-400' : 'bg-slate-500'}`} />
                {mtzLinked ? (isAr ? 'مرتبط ومفعل' : 'Linked & Active') : mtz.enabled ? (isAr ? 'مفعل — أكمل الأكواد' : 'Enabled — finish codes') : (isAr ? 'غير مرتبط' : 'Not linked')}
              </span>
            )}
            <button
              onClick={() => updateMtz({ enabled: !mtz.enabled })}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition-all ${
                mtz.enabled ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
              }`}
              title={mtz.enabled ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
            >
              {mtz.enabled ? <EyeOff size={12} /> : <Eye size={12} />}
              {isAr ? (mtz.enabled ? 'تعطيل' : 'تفعيل') : (mtz.enabled ? 'Disable' : 'Enable')}
            </button>
          </div>
        </div>

        {!mtzLoaded ? (
          <div className="text-center py-6 text-xs text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'معرّف الناشر (Publisher ID)' : 'Publisher ID'}</label>
                <input
                  type="text"
                  value={mtz.publisherId}
                  onChange={(e) => updateMtz({ publisherId: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="142894"
                  dir="ltr"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-400/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'حالة الربط' : 'Link Status'}</label>
                <a
                  href="/ads.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-indigo-300 hover:border-indigo-400/50 transition-all break-all"
                >
                  <ExternalLink size={11} />
                  /ads.txt
                </a>
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">
                {isAr ? 'محتوى ملف ads.txt' : 'ads.txt content'}
                <span className="text-amber-400"> *</span>
                <span className="text-slate-600"> — {isAr ? 'من لوحة "معدلة" عندهم' : 'from their "Edit" panel'}</span>
              </label>
              <textarea
                value={mtz.adsTxtContent}
                onChange={(e) => updateMtz({ adsTxtContent: e.target.value })}
                placeholder={"google.com, pub-xxxxxxxx, DIRECT, ...\nimprove-digital.com, 142894, DIRECT\n..."}
                rows={4}
                dir="ltr"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-400/50 resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold block mb-1">
                {isAr ? 'كود الرأس الرئيسي' : 'Main head code'}
                <span className="text-amber-400"> *</span>
                <span className="text-slate-600"> — {isAr ? 'الذي يعطيك إياه بعد التحقق (خطوة 3+)' : 'they give after verification (step 3+)'}</span>
              </label>
              <textarea
                value={mtz.headCode}
                onChange={(e) => updateMtz({ headCode: e.target.value })}
                placeholder={'<script src="//cdn.themoneytizer.com/lib/form_manager.js" data-ad="142894" async></script>'}
                rows={3}
                dir="ltr"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-400/50 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
              <Info size={12} className="text-indigo-400 shrink-0" />
              <span>
                {isAr
                  ? 'بعد الحفظ: /ads.txt يُحدَّث فوراً، وكود الرأس يُحقن في موقعك. فك الربط يحذف الإعدادات ويوقف الإعلانات.'
                  : 'After save: /ads.txt updates instantly and the head code is injected. Unlink deletes settings and stops the ads.'}
              </span>
            </div>

            <div className="flex gap-2 pt-1 flex-wrap items-center">
              <button
                onClick={handleMtzSave}
                disabled={mtzSaving}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg ${
                  mtzDirty
                    ? 'bg-indigo-400 hover:bg-indigo-500 text-black shadow-indigo-400/20 animate-pulse'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {mtz.enabled ? <Link2 size={13} /> : <Save size={13} />}
                {mtzSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : mtz.enabled ? (isAr ? 'حفظ وتفعيل الربط' : 'Save & Link') : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
              </button>
              <button
                onClick={handleMtzDelete}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
              >
                <Unlink size={13} />
                {isAr ? 'فك الربط وحذف' : 'Unlink & Delete'}
              </button>
              {mtz.enabled && !mtzLinked && (
                <span className="text-[10px] text-amber-400 font-bold">
                  {isAr ? '⚠️ أكمل معرّف الناشر + ads.txt + كود الرأس ليكتمل الربط' : '⚠️ Finish Publisher ID + ads.txt + head code to complete linking'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <p className="text-xs text-amber-300 font-bold">
            {isAr ? 'لديك تغييرات غير محفوظة. اضغط "حفظ التغييرات" لتطبيقها.' : 'You have unsaved changes. Click "Save Changes" to apply them.'}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
          <div className="text-2xl font-black text-white">{ads.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{isAr ? 'إجمالي' : 'Total'}</div>
        </div>
        <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20 text-center">
          <div className="text-2xl font-black text-emerald-400">{ads.filter(a => a.enabled && !a.paused).length}</div>
          <div className="text-[10px] text-emerald-400 uppercase tracking-wider">{isAr ? 'نشط' : 'Active'}</div>
        </div>
        <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 text-center">
          <div className="text-2xl font-black text-amber-400">{ads.filter(a => !a.enabled || a.paused).length}</div>
          <div className="text-[10px] text-amber-400 uppercase tracking-wider">{isAr ? 'معطل' : 'Disabled'}</div>
        </div>
        <div className="bg-blue-500/10 rounded-2xl p-4 border border-blue-500/20 text-center">
          <div className="text-2xl font-black text-blue-400">{ads.filter(a => a.code).length}</div>
          <div className="text-[10px] text-blue-400 uppercase tracking-wider">{isAr ? 'جاهز' : 'Ready'}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: 'all', label: isAr ? 'الكل' : 'All' },
          ...Object.entries(AD_UNIT_TYPES).map(([key, val]) => ({ key, label: val[isAr ? 'ar' : 'en'] })),
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterType === tab.key
                ? 'bg-primary text-black shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {tab.key !== 'all' && AD_UNIT_TYPE_ICONS[tab.key]} {tab.label}
          </button>
        ))}
      </div>

      {/* Ad List */}
      {filteredAds.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <Monitor size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400 font-bold">{isAr ? 'لا توجد إعلانات' : 'No ads found'}</p>
          <p className="text-slate-500 text-xs mt-1">
            {isAr ? 'اضغط "قالب سريع" لإضافة إعلان Adsterra' : 'Click "Quick Add" to add an Adsterra ad'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAds.map((ad) => (
            <motion.div
              key={ad.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 transition-all ${
                ad.enabled && !ad.paused && ad.code
                  ? 'bg-white/5 border-emerald-500/20'
                  : ad.code
                    ? 'bg-white/[0.02] border-white/5'
                    : 'bg-amber-500/[0.03] border-amber-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-black text-white">{ad.name}</span>
                    <span className="text-lg">{AD_UNIT_TYPE_ICONS[ad.adUnitType] || '📢'}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ad.type === 'adsterra' ? 'bg-purple-500/20 text-purple-400' :
                      ad.type === 'adsense' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {ad.type === 'adsterra' ? 'Adsterra' : ad.type === 'adsense' ? 'AdSense' : isAr ? 'مخصص' : 'Custom'}
                    </span>
                    {ad.size && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-slate-300">
                        {ad.size}
                      </span>
                    )}
                    {!ad.code && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">
                        {isAr ? '⚠️ يحتاج كود' : '⚠️ Needs Code'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                    <span>{isAr ? 'الموضع:' : 'Position:'} {POSITIONS[ad.position]?.[isAr ? 'ar' : 'en']}</span>
                    <span>•</span>
                    <span>{isAr ? 'النوع:' : 'Type:'} {AD_UNIT_TYPES[ad.adUnitType]?.[isAr ? 'ar' : 'en']}</span>
                    {ad.adsterraId && (
                      <>
                        <span>•</span>
                        <span className="text-purple-400">ID: {ad.adsterraId}</span>
                      </>
                    )}
                    {ad.assignedClients.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-blue-400">
                          <Users size={10} className="inline mr-1" />
                          {ad.assignedClients.length} {isAr ? 'عميل' : 'clients'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => updateAd(ad.id, { enabled: !ad.enabled })}
                    className={`p-2 rounded-lg transition-all ${ad.enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                    title={ad.enabled ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                  >
                    {ad.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => updateAd(ad.id, { paused: !ad.paused })}
                    className={`p-2 rounded-lg transition-all ${ad.paused ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
                    title={ad.paused ? (isAr ? 'استئناف' : 'Resume') : (isAr ? 'إيقاف مؤقت' : 'Pause')}
                  >
                    {ad.paused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button
                    onClick={() => setAssignModal(ad)}
                    className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all"
                    title={isAr ? 'تعيين لعملاء' : 'Assign to clients'}
                  >
                    <Users size={14} />
                  </button>
                  <button
                    onClick={() => setEditAd(editAd === ad.id ? null : ad.id)}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-all"
                    title={isAr ? 'تعديل' : 'Edit'}
                  >
                    <Code size={14} />
                  </button>
                  <button
                    onClick={() => setCodeModal(ad)}
                    className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
                    title={isAr ? 'عرض الكود' : 'View Code'}
                  >
                    <Clipboard size={14} />
                  </button>
                  <button
                    onClick={() => deleteAd(ad.id)}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                    title={isAr ? 'حذف' : 'Delete'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Inline Edit */}
              {editAd === ad.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-white/5 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                      <input
                        type="text"
                        value={ad.name}
                        onChange={(e) => updateAd(ad.id, { name: e.target.value })}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الموضع' : 'Position'}</label>
                      <select
                        value={ad.position}
                        onChange={(e) => updateAd(ad.id, { position: e.target.value as Ad['position'] })}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50"
                      >
                        {Object.entries(POSITIONS).map(([key, val]) => (
                          <option key={key} value={key}>{val[isAr ? 'ar' : 'en']}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'الحجم' : 'Size'}</label>
                      <input
                        type="text"
                        value={ad.size || ''}
                        onChange={(e) => updateAd(ad.id, { size: e.target.value })}
                        placeholder="728x90, 300x250..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'رقم الوحدة' : 'Adsterra Unit ID'}</label>
                      <input
                        type="text"
                        value={ad.adsterraId || ''}
                        onChange={(e) => updateAd(ad.id, { adsterraId: e.target.value })}
                        placeholder="30121119"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">{isAr ? 'كود الإعلان' : 'Ad Code'}</label>
                    <textarea
                      value={ad.code}
                      onChange={(e) => updateAd(ad.id, { code: e.target.value })}
                      placeholder={isAr ? 'الصق كود الإعلان من Adsterra هنا...' : 'Paste Adsterra ad code here...'}
                      rows={4}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-primary/50 resize-none"
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Preset Picker Modal */}
      <AnimatePresence>
        {showPresetPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-alt w-full max-w-2xl rounded-3xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black text-white">{isAr ? 'قالب إعلان Adsterra' : 'Adsterra Ad Templates'}</h3>
                  <p className="text-xs text-slate-400 mt-1">{isAr ? 'اختر نوع الإعلان ثم الصق الكود من لوحة Adsterra' : 'Choose ad type then paste code from Adsterra panel'}</p>
                </div>
                <button onClick={() => setShowPresetPicker(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {PRESET_AD_UNITS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => addFromPreset(preset)}
                    className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-primary/30 hover:bg-white/[0.07] transition-all text-left"
                  >
                    <span className="text-2xl">{AD_UNIT_TYPE_ICONS[preset.adUnitType || 'banner']}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {AD_UNIT_TYPES[preset.adUnitType || 'banner']?.[isAr ? 'ar' : 'en']} • {preset.size}
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">
                        {isAr ? 'الموضع:' : 'Position:'} {POSITIONS[preset.position || 'header']?.[isAr ? 'ar' : 'en']}
                      </div>
                    </div>
                    <Plus size={16} className="text-primary mt-1 shrink-0" />
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <p className="text-xs text-purple-300 font-bold mb-1">{isAr ? '💡 كيف تحصل على الأكواد:' : '💡 How to get the codes:'}</p>
                <ol className="text-[10px] text-purple-400/70 space-y-1 list-decimal list-inside">
                  <li>{isAr ? 'افتح لوحة ناشر Adsterra' : 'Open Adsterra Publisher Panel'}</li>
                  <li>{isAr ? 'اختر موقعك Joseph.Trading.app' : 'Select your site Joseph.Trading.app'}</li>
                  <li>{isAr ? 'اضغط "GET CODE" بجانب وحدة الإعلان' : 'Click "GET CODE" next to the ad unit'}</li>
                  <li>{isAr ? 'الصق الكود هنا بعد إضافة الإعلان' : 'Paste the code here after adding the ad'}</li>
                </ol>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Custom Ad Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-alt w-full max-w-lg rounded-3xl border border-white/10 p-6 shadow-2xl"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white">{isAr ? 'إضافة إعلان مخصص' : 'Add Custom Ad'}</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'اسم الإعلان' : 'Ad Name'}</label>
                  <input
                    type="text"
                    value={newAd.name}
                    onChange={(e) => setNewAd(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={isAr ? 'مثال: بانر الرئيسية' : 'e.g. Homepage Banner'}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'النوع' : 'Type'}</label>
                    <select
                      value={newAd.adUnitType}
                      onChange={(e) => setNewAd(prev => ({ ...prev, adUnitType: e.target.value as Ad['adUnitType'] }))}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50"
                    >
                      {Object.entries(AD_UNIT_TYPES).map(([key, val]) => (
                        <option key={key} value={key}>{AD_UNIT_TYPE_ICONS[key]} {val[isAr ? 'ar' : 'en']}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'الموضع' : 'Position'}</label>
                    <select
                      value={newAd.position}
                      onChange={(e) => setNewAd(prev => ({ ...prev, position: e.target.value as Ad['position'] }))}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50"
                    >
                      {Object.entries(POSITIONS).map(([key, val]) => (
                        <option key={key} value={key}>{val[isAr ? 'ar' : 'en']}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'الحجم' : 'Size'}</label>
                    <input
                      type="text"
                      value={newAd.size}
                      onChange={(e) => setNewAd(prev => ({ ...prev, size: e.target.value }))}
                      placeholder="728x90, 300x250..."
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'رقم الوحدة' : 'Adsterra Unit ID'}</label>
                    <input
                      type="text"
                      value={newAd.adsterraId}
                      onChange={(e) => setNewAd(prev => ({ ...prev, adsterraId: e.target.value }))}
                      placeholder="30121119"
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'كود الإعلان' : 'Ad Code'}</label>
                  <textarea
                    value={newAd.code}
                    onChange={(e) => setNewAd(prev => ({ ...prev, code: e.target.value }))}
                    placeholder={isAr ? 'الصق كود الإعلان هنا...' : 'Paste ad code here...'}
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAdd(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 font-bold rounded-xl text-sm transition-all"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={addAd}
                    disabled={!newAd.name.trim()}
                    className="flex-1 py-3 bg-primary hover:bg-emerald-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isAr ? 'إضافة' : 'Add'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign to Clients Modal */}
      <AnimatePresence>
        {assignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-alt w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl max-h-[70vh] overflow-y-auto"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{isAr ? 'تعيين إعلان لعملاء' : 'Assign Ad to Clients'}</h3>
                  <p className="text-xs text-slate-400 mt-1">{assignModal.name}</p>
                </div>
                <button onClick={() => setAssignModal(null)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                  <X size={18} />
                </button>
              </div>

              {clientEmails.length === 0 ? (
                <div className="text-center py-8 bg-white/5 rounded-2xl">
                  <Users size={32} className="mx-auto text-slate-500 mb-3" />
                  <p className="text-slate-400 text-sm font-bold">{isAr ? 'لا يوجد عملاء مسجلين' : 'No registered clients'}</p>
                  <p className="text-slate-500 text-xs mt-1">{isAr ? 'سيظهر القائمة عندما يسجل عملاء جدد' : 'List will appear when new clients register'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const allEmails = clientEmails;
                      const allAssigned = allEmails.every(e => assignModal.assignedClients.includes(e));
                      setAds(prev => prev.map(a =>
                        a.id === assignModal.id
                          ? { ...a, assignedClients: allAssigned ? [] : [...allEmails] }
                          : a
                      ));
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      clientEmails.every(e => assignModal.assignedClients.includes(e))
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-sm font-bold">{isAr ? 'تحديد الكل' : 'Select All'}</span>
                    <Check size={16} className={clientEmails.every(e => assignModal.assignedClients.includes(e)) ? 'text-primary' : 'text-slate-600'} />
                  </button>

                  {clientEmails.map(email => {
                    const isAssigned = assignModal.assignedClients.includes(email);
                    return (
                      <button
                        key={email}
                        onClick={() => toggleClientAssignment(assignModal.id, email)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isAssigned
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {email.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm truncate">{email}</span>
                        </div>
                        <Check size={16} className={isAssigned ? 'text-blue-400' : 'text-slate-600'} />
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => setAssignModal(null)}
                className="w-full mt-4 py-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 font-bold rounded-xl text-sm transition-all"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Code Modal */}
      <AnimatePresence>
        {codeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-brand-alt w-full max-w-lg rounded-3xl border border-white/10 p-6 shadow-2xl"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">{isAr ? 'كود الإعلان' : 'Ad Code'}</h3>
                  <p className="text-xs text-slate-400 mt-1">{codeModal.name}</p>
                </div>
                <button onClick={() => setCodeModal(null)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                  <X size={18} />
                </button>
              </div>

              {codeModal.code ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{isAr ? 'كود الإعلان' : 'Ad Code'}</span>
                    <button
                      onClick={() => copyCode(codeModal.code)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-emerald-400 transition-colors font-bold"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ الكود' : 'Copy Code')}
                    </button>
                  </div>
                  <pre className="bg-black/40 rounded-xl p-4 text-[11px] text-slate-300 overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">{codeModal.code}</pre>
                </div>
              ) : (
                <div className="text-center py-8 bg-white/5 rounded-2xl">
                  <Code size={32} className="mx-auto text-amber-400 mb-3" />
                  <p className="text-amber-300 text-sm font-bold">{isAr ? 'لم يتم إضافة الكود بعد' : 'Code not added yet'}</p>
                  <p className="text-slate-500 text-xs mt-1">{isAr ? 'اضغطتعديل لإضافة كود الإعلان' : 'Click edit to add the ad code'}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-sm shadow-2xl backdrop-blur-xl border ${
              toast.type === 'ok'
                ? 'bg-emerald-500/90 text-white border-emerald-400/30'
                : 'bg-red-500/90 text-white border-red-400/30'
            }`}
          >
            {toast.type === 'ok' ? <Check size={18} /> : <AlertTriangle size={18} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Public component to render ads on pages
export function AdSlot({ position, lang }: { position: Ad['position']; lang: Language }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    loadAdsFromFirestore().then(firestoreAds => {
      setAds(firestoreAds);
    }).catch(() => {
      setAds([]);
    });

    const interval = setInterval(() => {
      loadAdsFromFirestore().then(firestoreAds => {
        setAds(firestoreAds);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!containerRef.current || ads.length === 0) return;

    let currentUserEmail = '';
    try {
      const user = JSON.parse(localStorage.getItem('finalyze_user') || '{}');
      currentUserEmail = user.email || '';
    } catch {}

    const visibleAds = ads.filter(a => {
      if (!a.enabled || a.paused || !a.code || a.position !== position) return false;
      if (a.assignedClients.length === 0) return true;
      return currentUserEmail && a.assignedClients.includes(currentUserEmail);
    });

    const container = containerRef.current;
    container.innerHTML = '';

    visibleAds.forEach(ad => {
      const wrapper = document.createElement('div');
      wrapper.className = 'my-3 flex justify-center';
      wrapper.setAttribute('data-ad-id', ad.id);

      if (ad.code.includes('<script')) {
        const temp = document.createElement('div');
        temp.innerHTML = ad.code;
        const scripts = temp.querySelectorAll('script');
        const nonScript = temp.innerHTML.replace(/<script[\s\S]*?<\/script>/gi, '');

        if (nonScript.trim()) {
          const content = document.createElement('div');
          content.innerHTML = nonScript;
          wrapper.appendChild(content);
        }

        scripts.forEach(oldScript => {
          const script = document.createElement('script');
          if (oldScript.src) {
            script.src = oldScript.src;
          } else {
            script.textContent = oldScript.textContent;
          }
          Array.from(oldScript.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
          wrapper.appendChild(script);
        });
      } else {
        wrapper.innerHTML = ad.code;
      }

      container.appendChild(wrapper);
    });

    return () => { if (container) container.innerHTML = ''; };
  }, [ads, position]);

  let currentUserEmail = '';
  try {
    const user = JSON.parse(localStorage.getItem('finalyze_user') || '{}');
    currentUserEmail = user.email || '';
  } catch {}

  const visibleAds = ads.filter(a => {
    if (!a.enabled || a.paused || !a.code || a.position !== position) return false;
    if (a.assignedClients.length === 0) return true;
    return currentUserEmail && a.assignedClients.includes(currentUserEmail);
  });

  if (visibleAds.length === 0) return null;

  return <div ref={containerRef} className="max-w-full overflow-hidden" />;
}
