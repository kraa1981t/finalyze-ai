import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, EyeOff, Pause, Play, Monitor, Code, X, Copy, Check, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/i18n';

interface Ad {
  id: string;
  name: string;
  code: string;
  type: 'adsense' | 'adsterra' | 'custom';
  position: 'header' | 'sidebar' | 'footer' | 'between' | 'popup';
  enabled: boolean;
  paused: boolean;
  createdAt: number;
}

interface AdsManagerProps {
  lang: Language;
  onBack: () => void;
}

const STORAGE_KEY = 'finalyze_ads_config';

function loadAds(): Ad[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (stored.length === 0) {
      const defaultAds: Ad[] = [
        {
          id: 'adsterra-socialbar-default',
          name: 'Adsterra Social Bar',
          code: '<script src="https://pl30221617.effectivecpmnetwork.com/1c/a5/8c/1ca58cfd0b20f79d64654344f1912c74.js"></script>',
          type: 'adsterra',
          position: 'between',
          enabled: true,
          paused: false,
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAds));
      return defaultAds;
    }
    return stored;
  } catch { return []; }
}

function saveAds(ads: Ad[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ads));
}

const POSITIONS = {
  header: { ar: 'أعلى الصفحة', en: 'Top of Page' },
  sidebar: { ar: 'الشريط الجانبي', en: 'Sidebar' },
  footer: { ar: 'أسفل الصفحة', en: 'Bottom of Page' },
  between: { ar: 'بين الأقسام', en: 'Between Sections' },
  popup: { ar: 'نافذة منبثقة', en: 'Popup' },
};

const AD_TYPES = {
  adsense: { ar: 'Google AdSense', en: 'Google AdSense' },
  adsterra: { ar: 'Adsterra', en: 'Adsterra' },
  custom: { ar: 'كود مخصص', en: 'Custom Code' },
};

export default function AdsManager({ lang, onBack }: AdsManagerProps) {
  const isAr = lang === 'ar';
  const [ads, setAds] = useState<Ad[]>(loadAds);
  const [showAdd, setShowAdd] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [newAd, setNewAd] = useState({ name: '', code: '', type: 'adsense' as Ad['type'], position: 'header' as Ad['position'] });
  const [copied, setCopied] = useState(false);

  useEffect(() => { saveAds(ads); }, [ads]);

  const addAd = () => {
    if (!newAd.name.trim() || !newAd.code.trim()) return;
    const ad: Ad = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newAd.name.trim(),
      code: newAd.code.trim(),
      type: newAd.type,
      position: newAd.position,
      enabled: true,
      paused: false,
      createdAt: Date.now(),
    };
    setAds(prev => [...prev, ad]);
    setNewAd({ name: '', code: '', type: 'adsense', position: 'header' });
    setShowAdd(false);
  };

  const updateAd = (id: string, updates: Partial<Ad>) => {
    setAds(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  const deleteAd = (id: string) => {
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الإعلان؟' : 'Are you sure you want to delete this ad?')) return;
    setAds(prev => prev.filter(a => a.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
            <span className="text-lg">{isAr ? '→' : '←'}</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-white">{isAr ? 'إدارة الإعلانات' : 'Ads Manager'}</h1>
            <p className="text-xs text-slate-400">{isAr ? 'إضافة وإدارة إعلانات موقعك' : 'Add and manage your site ads'}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary hover:bg-emerald-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={16} />
          {isAr ? 'إضافة إعلان' : 'Add Ad'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
          <div className="text-2xl font-black text-white">{ads.length}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{isAr ? 'إجمالي' : 'Total'}</div>
        </div>
        <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20 text-center">
          <div className="text-2xl font-black text-emerald-400">{ads.filter(a => a.enabled && !a.paused).length}</div>
          <div className="text-[10px] text-emerald-400 uppercase tracking-wider">{isAr ? 'نشط' : 'Active'}</div>
        </div>
        <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 text-center">
          <div className="text-2xl font-black text-amber-400">{ads.filter(a => a.paused).length}</div>
          <div className="text-[10px] text-amber-400 uppercase tracking-wider">{isAr ? 'متوقف' : 'Paused'}</div>
        </div>
      </div>

      {/* Ad List */}
      {ads.length === 0 ? (
        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
          <Monitor size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-400 font-bold">{isAr ? 'لا توجد إعلانات بعد' : 'No ads yet'}</p>
          <p className="text-slate-500 text-xs mt-1">{isAr ? 'اضغط "إضافة إعلان" للبدء' : 'Click "Add Ad" to get started'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <motion.div
              key={ad.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 transition-all ${
                ad.enabled && !ad.paused
                  ? 'bg-white/5 border-white/10'
                  : 'bg-white/[0.02] border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black text-white truncate">{ad.name}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      ad.type === 'adsense' ? 'bg-blue-500/20 text-blue-400' :
                      ad.type === 'adsterra' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {AD_TYPES[ad.type][lang === 'ar' ? 'ar' : 'en']}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{isAr ? 'الموضع:' : 'Position:'} {POSITIONS[ad.position][lang === 'ar' ? 'ar' : 'en']}</span>
                    <span>•</span>
                    <span>{isAr ? 'الحالة:' : 'Status:'} {ad.paused ? (isAr ? 'متوقف مؤقتاً' : 'Paused') : ad.enabled ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Disabled')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
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
                    onClick={() => setEditAd(editAd?.id === ad.id ? null : ad)}
                    className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-all"
                    title={isAr ? 'عرض الكود' : 'View Code'}
                  >
                    <Code size={14} />
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

              {/* Code Preview */}
              {editAd?.id === ad.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-white/5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">{isAr ? 'كود الإعلان' : 'Ad Code'}</span>
                    <button
                      onClick={() => copyCode(ad.code)}
                      className="flex items-center gap-1 text-[10px] text-primary hover:text-emerald-400 transition-colors"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
                    </button>
                  </div>
                  <pre className="bg-black/40 rounded-xl p-3 text-[10px] text-slate-300 overflow-x-auto max-h-32 font-mono">{ad.code}</pre>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Ad Modal */}
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
                <h3 className="text-lg font-black text-white">{isAr ? 'إضافة إعلان جديد' : 'Add New Ad'}</h3>
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
                    placeholder={isAr ? 'مثال: إعلان الرئيسية' : 'e.g. Homepage Banner'}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'نوع الإعلان' : 'Ad Type'}</label>
                    <select
                      value={newAd.type}
                      onChange={(e) => setNewAd(prev => ({ ...prev, type: e.target.value as Ad['type'] }))}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50"
                    >
                      <option value="adsense">{AD_TYPES.adsense[lang === 'ar' ? 'ar' : 'en']}</option>
                      <option value="adsterra">{AD_TYPES.adsterra[lang === 'ar' ? 'ar' : 'en']}</option>
                      <option value="custom">{AD_TYPES.custom[lang === 'ar' ? 'ar' : 'en']}</option>
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
                        <option key={key} value={key}>{val[lang === 'ar' ? 'ar' : 'en']}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-bold block mb-1.5">{isAr ? 'كود الإعلان' : 'Ad Code'}</label>
                  <textarea
                    value={newAd.code}
                    onChange={(e) => setNewAd(prev => ({ ...prev, code: e.target.value }))}
                    placeholder={isAr ? 'الصق كود الإعلان هنا (Script/HTML)...' : 'Paste your ad code here (Script/HTML)...'}
                    rows={6}
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
                    disabled={!newAd.name.trim() || !newAd.code.trim()}
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
    </div>
  );
}

// Public component to render ads on pages
export function AdSlot({ position, lang }: { position: Ad['position']; lang: Language }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    setAds(loadAds());
    const interval = setInterval(() => setAds(loadAds()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!containerRef.current || ads.length === 0) return;
    const visibleAds = ads.filter(a => a.enabled && !a.paused && a.position === position);
    const container = containerRef.current;
    container.innerHTML = '';

    visibleAds.forEach(ad => {
      const wrapper = document.createElement('div');
      wrapper.className = 'my-4 flex justify-center';
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

  const visibleAds = ads.filter(a => a.enabled && !a.paused && a.position === position);
  if (visibleAds.length === 0) return null;

  return <div ref={containerRef} className="max-w-full overflow-hidden" />;
}
