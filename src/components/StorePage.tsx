import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ShoppingCart, FileText, ChevronDown, ChevronUp, RefreshCw, XCircle, Clock, Search, Bot, Activity, Crown, Package, Download, Gift, Sparkles } from 'lucide-react';
import { StoreBot, StoreCategory, fetchStoreBots, formatFileSize, isFree, categoryOf, STORE_CATEGORIES, downloadBot, getDownloadGrant, consumeBotDownload } from '../services/storeService';
import { loadSessions, cancelSession, PaymentSession, getLastEmail, setLastEmail } from '../services/paymentSession';
import { consumeBotGrant } from '../services/paymentRequests';

interface StorePageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
  isDark: boolean;
  onBuyBot: (bot: StoreBot) => void;
  onResumeSession: (session: PaymentSession, bot?: StoreBot) => void;
  knownEmail?: string;
}

const MAX_DESC_LEN = 55;

const CATEGORY_ICONS: Record<StoreCategory, { Icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string; shadow: string }> = {
  bot: { Icon: Bot, gradient: 'from-emerald-400 to-emerald-600', shadow: 'shadow-emerald-500/30' },
  indicator: { Icon: Activity, gradient: 'from-sky-400 to-blue-600', shadow: 'shadow-sky-500/30' },
  plan: { Icon: Crown, gradient: 'from-amber-400 to-orange-600', shadow: 'shadow-amber-500/30' },
  other: { Icon: Package, gradient: 'from-violet-400 to-purple-600', shadow: 'shadow-violet-500/30' },
};

function catLabel(isAr: boolean, key: StoreCategory): string {
  const c = STORE_CATEGORIES.find((x) => x.key === key);
  return isAr ? (c?.labelAr || '') : (c?.labelEn || '');
}

export default function StorePage({ lang, onBack, isDark, onBuyBot, onResumeSession, knownEmail }: StorePageProps) {
  const isAr = lang === 'ar';
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<StoreCategory | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingSessions, setPendingSessions] = useState<PaymentSession[]>([]);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<{ botId: string; text: string } | null>(null);

  const refreshSessions = (email?: string) => {
    loadSessions(email).then((list) => setPendingSessions(list));
  };

  useEffect(() => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
    refreshSessions(knownEmail || getLastEmail() || undefined);
  }, [knownEmail]);

  const handleCancelSession = async (id: string) => {
    await cancelSession(id);
    refreshSessions(knownEmail || getLastEmail() || undefined);
  };

  const handleLookup = () => {
    if (lookupEmail.trim()) { setLastEmail(lookupEmail.trim()); refreshSessions(lookupEmail.trim()); setSearched(true); }
  };

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  // Theme-inverted cards: black box in light mode, white box in dark mode
  const cardBg = isDark ? 'bg-white' : 'bg-[#0B0F17]';
  const cardBorder = isDark ? 'border-black/10' : 'border-white/15';
  const pageTitle = isDark ? 'text-slate-900' : 'text-white';
  const pageSub = isDark ? 'text-slate-500' : 'text-slate-400';
  const divider = isDark ? 'bg-black/10' : 'bg-white/10';

  const counts = useMemo(() => {
    const out: Record<StoreCategory, { free: number; paid: number }> = { bot: { free: 0, paid: 0 }, indicator: { free: 0, paid: 0 }, plan: { free: 0, paid: 0 }, other: { free: 0, paid: 0 } };
    for (const b of bots) {
      const c = categoryOf(b);
      if (isFree(b)) out[c].free++;
      else out[c].paid++;
    }
    return out;
  }, [bots]);

  const handleProductAction = (bot: StoreBot) => {
    setDownloadMsg(null);
    if (isFree(bot)) {
      downloadBot(bot);
      setDownloadMsg({ botId: bot.id || '', text: isAr ? '✓ جاري تحميل الملف المجاني' : '✓ Downloading the free file' });
      setTimeout(() => setDownloadMsg(null), 3000);
      return;
    }
    onBuyBot(bot);
  };

  const handleGrantedDownload = (bot: StoreBot) => {
    setDownloadMsg(null);
    downloadBot(bot);
    consumeBotDownload(bot.id || '');
    if (knownEmail) consumeBotGrant(knownEmail, bot.id || '');
    setDownloadMsg({ botId: bot.id || '', text: isAr ? '✓ تم تنزيل المنتج على سطح مكتبك' : '✓ Product downloaded to your desktop' });
    setTimeout(() => setDownloadMsg(null), 3000);
  };

  const renderCard = (bot: StoreBot) => {
    const needToggle = bot.description.length > MAX_DESC_LEN;
    const isOpen = !!expanded[bot.id ?? ''];
    const shown = isOpen || !needToggle ? bot.description : bot.description.slice(0, MAX_DESC_LEN) + '…';
    const free = isFree(bot);
    const granted = !free && !!getDownloadGrant(bot.id ?? '');
    const showMsg = downloadMsg?.botId === bot.id;
    return (
      <motion.div
        key={bot.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} ${cardBorder} border rounded-xl p-3 flex flex-col gap-2 transition-all shadow-lg ${isDark ? 'hover:shadow-amber-500/20' : 'hover:shadow-amber-500/10'}`}
      >
        {bot.imageData && (
          <div className="relative -mt-3 -mx-3 mb-0">
            <img src={bot.imageData} alt={bot.name} className="w-full h-28 object-cover rounded-t-xl rounded-b-lg" />
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[9px] font-black uppercase tracking-wider">
              {isAr ? 'آلية العمل' : 'How it works'}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br ${CATEGORY_ICONS[categoryOf(bot)].gradient}`}>
              {free ? <Gift size={16} className="text-black" /> : <ShoppingCart size={16} className="text-black" />}
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm font-black truncate ${isDark ? 'text-slate-900' : 'text-white'}`}>{bot.name}</h3>
              {bot.fileName && (
                <span className={`text-[9px] flex items-center gap-1 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-300'}`}>
                  <FileText size={9} /> {bot.fileName} {bot.fileSize ? `(${formatFileSize(bot.fileSize)})` : ''}
                </span>
              )}
            </div>
          </div>
          <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase border-2 ${free ? 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10' : 'text-amber-400 border-amber-400/40 bg-amber-500/10'}`}>
            {free ? (isAr ? 'مجاني' : 'Free') : formatPrice(bot.price)}
          </span>
        </div>

        {bot.description && (
          <div>
            <p className={`text-xs leading-relaxed break-words ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{shown}</p>
            {needToggle && (
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [bot.id ?? '']: !isOpen }))}
                className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide transition-all ${isDark ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
              >
                {isOpen ? (isAr ? 'عرض أقل' : 'Read Less') : (isAr ? 'اقرأ المزيد' : 'Read More')}
                {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>
        )}

        {showMsg && (
          <p className="text-[11px] font-black text-emerald-500 text-center">{downloadMsg?.text}</p>
        )}

        <button
          onClick={() => (granted ? handleGrantedDownload(bot) : handleProductAction(bot))}
          className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-black font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all ${
            granted || free
              ? 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-400'
              : 'bg-[#F59E0B] shadow-[#F59E0B]/30 hover:bg-[#d97706]'
          }`}
        >
          {granted ? <Download size={14} /> : free ? <Gift size={14} /> : <ShoppingCart size={14} />}
          {granted ? (isAr ? 'تحميل الآن' : 'Download Now')
            : free ? (isAr ? 'تحميل مجاني' : 'Download Free')
              : (isAr ? 'اشترِ الآن' : 'Buy Now')}
        </button>
      </motion.div>
    );
  };

  const renderStack = (list: StoreBot[], free: boolean) => {
    const catBots = list.filter((b) => isFree(b) === free);
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 mt-1">
          <span className={`text-xl font-black uppercase tracking-wide whitespace-nowrap ${free ? 'text-emerald-500' : 'text-red-500'}`}>
            {isAr ? (free ? 'مجاني' : 'مدفوع') : (free ? 'Free' : 'Paid')}
          </span>
          <div className={`flex-1 h-px ${divider}`} />
          <span className={`text-[10px] font-black uppercase ${pageSub}`}>{catBots.length}</span>
        </div>
        {catBots.length === 0 ? (
          <p className={`text-xs font-bold text-center py-6 ${pageSub}`}>
            {isAr ? (free ? 'لا توجد منتجات مجانية هنا بعد' : 'لا توجد منتجات مدفوعة هنا بعد') : (free ? 'No free products here yet' : 'No paid products here yet')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <AnimatePresence>{catBots.map((bot) => renderCard(bot))}</AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const catBots = useMemo(
    () => (activeCat ? [...bots].filter((b) => categoryOf(b) === activeCat) : []),
    [bots, activeCat]
  );

  return (
    <div className="w-full px-2 pb-10">
      <div className="max-w-4xl mx-auto flex items-center gap-3 mb-4">
        <button
          onClick={() => (activeCat ? setActiveCat(null) : onBack())}
          className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-black/5 border-black/10 text-slate-600 hover:text-black' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
        >
          <ArrowLeft size={18} />
        </button>
        {activeCat && (
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br ${CATEGORY_ICONS[activeCat].gradient}`}>
              {(() => { const I = CATEGORY_ICONS[activeCat].Icon; return <I size={16} className="text-black" />; })()}
            </div>
            <h2 className={`text-base sm:text-lg font-black ${pageTitle}`}>{catLabel(isAr, activeCat)}</h2>
          </div>
        )}
      </div>

      {!activeCat && (
        <>
          {/* Pending payment sessions */}
          {!knownEmail && (
            <div className="max-w-4xl mx-auto mb-4">
              <button
                onClick={() => setLookupOpen((v) => !v)}
                className={`w-full flex items-center justify-center gap-1.5 rounded-2xl border py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  lookupOpen
                    ? (isDark ? 'bg-slate-100 border-black/10 text-slate-600' : 'bg-white/5 border-white/10 text-slate-400')
                    : (isDark ? 'bg-transparent border-black/10 text-slate-500 hover:text-slate-700' : 'bg-transparent border-white/10 text-slate-400 hover:text-slate-200')
                }`}
              >
                <Search size={12} />
                {lookupOpen
                  ? (isAr ? 'إغلاق البحث' : 'Close search')
                  : (isAr ? 'بحث عن معاملة بريد آخر' : 'Search another email for a transaction')}
              </button>
              {lookupOpen && (
                <div className={`rounded-2xl border p-3 mt-2 ${isDark ? 'bg-slate-100 border-black/10' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => { setLookupEmail(e.target.value); setSearched(false); }}
                      placeholder={isAr ? 'أدخل بريدك الإلكتروني الذي استخدمته' : 'Enter the email you used'}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none border ${isDark ? 'bg-white border-black/10 text-slate-800' : 'bg-black/40 border-white/10 text-white'}`}
                    />
                    <button
                      onClick={handleLookup}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-black font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all"
                    >
                      <Search size={13} />
                      {isAr ? 'بحث' : 'Search'}
                    </button>
                  </div>
                  {searched && pendingSessions.length === 0 && (
                    <p className={`text-[10px] font-bold text-center mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {isAr ? 'لا توجد معاملات معلقة بهذا البريد' : 'No pending transactions found for this email'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {pendingSessions.length > 0 && (
            <div className="max-w-4xl mx-auto mb-5 space-y-2">
              <div className={`flex items-center gap-2 ${isDark ? 'text-slate-600' : 'text-slate-300'} px-1`}>
                <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-500">
                  <RefreshCw size={16} />
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest">{isAr ? 'معاملة معلقة — استأنف الآن' : 'Pending transaction — resume now'}</span>
              </div>
              {pendingSessions.map((s) => (
                <div
                  key={s.id}
                  className={`${cardBg} ${cardBorder} border rounded-2xl p-3.5 shadow-lg ${isDark ? 'bg-amber-50' : 'bg-white/5'}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-500">
                        <RefreshCw size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-black truncate ${isDark ? 'text-slate-900' : 'text-white'}`}>
                          {isAr ? 'لديك معاملة سابقة قيد الانتظار' : 'You have a pending transaction'}
                        </h4>
                        <p className={`text-[11px] font-bold truncate ${isDark ? 'text-slate-500' : 'text-slate-300'}`}>
                          {s.kind === 'bot' ? s.botName || 'Bot' : s.planLabel || 'Plan'} · ${s.amountUsd.toFixed(2)} USDT
                          {s.requestNo ? ` · #${s.requestNo}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onResumeSession(s, bots.find((b) => b.id === s.botId))}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F59E0B] text-black font-black text-[11px] uppercase tracking-wider shadow-md shadow-[#F59E0B]/30 hover:bg-[#d97706] active:scale-95 transition-all"
                      >
                        <RefreshCw size={13} />
                        {isAr ? 'متابعة المعاملة' : 'Continue'}
                      </button>
                      <button
                        onClick={() => handleCancelSession(s.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border font-black text-[11px] uppercase tracking-wider transition-all ${
                          isDark ? 'border-black/10 text-slate-500 hover:text-red-500 hover:border-red-400' : 'border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/40'
                        }`}
                      >
                        <XCircle size={13} />
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Title */}
          <div className="text-center mb-6 px-4">
            <h2 className={`text-xl sm:text-2xl font-black ${pageTitle}`}>
              {isAr ? 'متجر التداول' : 'Trading Store'}
            </h2>
            <p className={`text-xs sm:text-sm mt-2 font-bold ${pageSub}`}>
              {isAr ? 'بوتات ومؤشرات وخطط ومنتجات — مجاني ومدفوع' : 'Bots, indicators, plans & products — free and paid'}
            </p>
          </div>
        </>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <p className={`text-xs mt-3 font-bold ${pageSub}`}>{isAr ? 'جاري تحميل المتجر...' : 'Loading store...'}</p>
        </div>
      ) : activeCat ? (
        <div className="max-w-4xl mx-auto">
          {catBots.length === 0 ? (
            <div className="text-center py-20">
              <p className={`text-base font-black ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                {isAr ? 'لا توجد منتجات في هذا القسم بعد' : 'No products in this section yet'}
              </p>
              <p className={`text-xs mt-1 font-bold ${pageSub}`}>{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
            </div>
          ) : (
            <>
              {renderStack(catBots, true)}
              {renderStack(catBots, false)}
            </>
          )}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-20">
          <p className={`text-base font-black ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>{isAr ? 'لا توجد منتجات في المتجر بعد' : 'No products in the store yet'}</p>
          <p className={`text-xs mt-1 font-bold ${pageSub}`}>{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(CATEGORY_ICONS) as StoreCategory[]).map((key) => {
              const { Icon, gradient, shadow } = CATEGORY_ICONS[key];
              const c = counts[key];
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setActiveCat(key)}
                  className={`${cardBg} ${cardBorder} border rounded-2xl p-4 flex flex-col items-center gap-2.5 transition-all shadow-lg ${shadow} hover:scale-[1.03] active:scale-95 text-center`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                    <Icon size={26} className="text-black" />
                  </div>
                  <span className={`text-sm font-black ${isDark ? 'text-slate-900' : 'text-white'}`}>{catLabel(isAr, key)}</span>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center gap-1">
                      <Gift size={10} /> {c.free} {isAr ? 'مجاني' : 'Free'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
                      <Sparkles size={10} /> {c.paid} {isAr ? 'مدفوع' : 'Paid'}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
          <p className={`text-center text-[10px] font-bold mt-5 ${pageSub}`}>
            {isAr ? 'اضغط على أي قسم لفتح صفحته الخاصة' : 'Tap a section to open its dedicated page'}
          </p>
        </div>
      )}
    </div>
  );
}