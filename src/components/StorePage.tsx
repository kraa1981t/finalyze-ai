import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, FileText, ChevronDown, ChevronUp, Bot, Activity, Crown, Package, Download, Gift, Sparkles } from 'lucide-react';
import { StoreBot, StoreCategory, fetchStoreBots, formatFileSize, isFree, categoryOf, STORE_CATEGORIES, downloadBot, getDownloadGrant, consumeBotDownload } from '../services/storeService';

interface StorePageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
  isDark: boolean;
  onBuyBot: (bot: StoreBot) => void;
}

const MAX_DESC_LEN = 55;

const TILE_ICONS: Record<StoreCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  bot: Bot,
  indicator: Activity,
  plan: Crown,
  other: Package,
};

function catLabel(isAr: boolean, key: StoreCategory): string {
  const c = STORE_CATEGORIES.find((x) => x.key === key);
  return isAr ? (c?.labelAr || '') : (c?.labelEn || '');
}

export default function StorePage({ lang, onBack, isDark, onBuyBot }: StorePageProps) {
  const isAr = lang === 'ar';
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<StoreCategory | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [downloadMsg, setDownloadMsg] = useState<{ botId: string; text: string } | null>(null);

  useEffect(() => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
  }, []);

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  const pageTitle = isDark ? 'text-slate-900' : 'text-white';
  const pageSub = isDark ? 'text-slate-500' : 'text-slate-400';

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
    // Solid brand-colored boxes (no product image): green = free, blue = paid
    const accent = free
      ? {
          card: 'bg-gradient-to-br from-emerald-400 to-emerald-700 border-emerald-300/50 shadow-emerald-600/40',
          box: 'bg-white/20',
          title: 'text-white',
          sub: 'text-emerald-50',
          body: 'text-emerald-50',
          link: 'text-white underline decoration-emerald-200/60 hover:decoration-white',
          pill: 'bg-white text-emerald-700 border-white',
          btn: 'bg-white text-emerald-600 hover:bg-emerald-50 shadow-black/20',
        }
      : {
          card: 'bg-gradient-to-br from-sky-400 to-blue-700 border-sky-300/50 shadow-blue-600/40',
          box: 'bg-white/20',
          title: 'text-white',
          sub: 'text-sky-50',
          body: 'text-sky-50',
          link: 'text-white underline decoration-sky-200/60 hover:decoration-white',
          pill: 'bg-white text-sky-700 border-white',
          btn: 'bg-white text-sky-600 hover:bg-sky-50 shadow-black/20',
        };
    return (
      <motion.div
        key={bot.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${accent.card} border rounded-xl overflow-hidden transition-all shadow-lg hover:scale-[1.02]`}
      >
        <div className="flex items-stretch">
          {bot.imageData && (
            <img
              src={bot.imageData}
              alt={bot.name}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="w-32 sm:w-40 shrink-0 object-cover min-h-full"
            />
          )}
          <div className="flex-1 flex flex-col gap-2.5 p-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center keep-white ${accent.box}`}>
                  {free ? <Gift size={18} /> : <ShoppingCart size={18} />}
                </div>
                <div className="min-w-0">
                  <h3 className={`text-sm font-black truncate keep-white ${accent.title}`}>{bot.name}</h3>
                  {bot.fileName && (
                    <span className={`text-[9px] flex items-center gap-1 mt-0.5 keep-white ${accent.sub}`}>
                      <FileText size={9} /> {bot.fileName} {bot.fileSize ? `(${formatFileSize(bot.fileSize)})` : ''}
                    </span>
                  )}
                </div>
              </div>
              <span className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-black uppercase border-2 ${accent.pill}`}>
                {free ? (isAr ? 'مجاني' : 'Free') : formatPrice(bot.price)}
              </span>
            </div>

            {bot.description && (
              <div>
                <p className={`text-xs leading-relaxed break-words font-medium keep-white ${accent.body}`}>{shown}</p>
                {needToggle && (
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [bot.id ?? '']: !isOpen }))}
                    className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide transition-all keep-white ${accent.link}`}
                  >
                    {isOpen ? (isAr ? 'عرض أقل' : 'Read Less') : (isAr ? 'اقرأ المزيد' : 'Read More')}
                    {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                )}
              </div>
            )}

            {showMsg && (
              <p className="text-[11px] font-black text-center keep-white bg-black/30 rounded-lg py-1 px-2">{downloadMsg?.text}</p>
            )}

            <button
              onClick={() => (granted ? handleGrantedDownload(bot) : handleProductAction(bot))}
              className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all ${accent.btn}`}
            >
              {granted ? <Download size={14} /> : free ? <Gift size={14} /> : <ShoppingCart size={14} />}
              {granted ? (isAr ? 'تحميل الآن' : 'Download Now')
                : free ? (isAr ? 'تحميل مجاني' : 'Download Free')
                  : (isAr ? 'اشترِ الآن' : 'Buy Now')}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderStack = (list: StoreBot[], free: boolean, cat: StoreCategory) => {
    const catBots = list.filter((b) => isFree(b) === free);
    const base = catLabel(isAr, cat);
    const title = isAr ? `${base} ${free ? 'مجانية' : 'مدفوعة'}` : `${free ? 'Free' : 'Paid'} ${base}`;
    const empty = isAr
      ? (free ? `لا توجد ${base} مجانية هنا بعد` : `لا توجد ${base} مدفوعة هنا بعد`)
      : (free ? `No free ${base.toLowerCase()} here yet` : `No paid ${base.toLowerCase()} here yet`);
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4 mt-2">
          <span className={`px-3 py-1.5 rounded-xl border-2 text-base sm:text-lg font-black uppercase tracking-wide whitespace-nowrap ${free ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : 'bg-sky-500/10 border-sky-500/50 text-sky-500'}`}>
            {title}
          </span>
          <div className={`flex-1 h-[3px] rounded-full ${isDark ? 'bg-black/15' : 'bg-white/20'}`} />
          <span className={`px-2.5 py-1 rounded-lg text-sm font-black ${pageSub}`}>{catBots.length}</span>
        </div>
        {catBots.length === 0 ? (
          <p className={`text-sm font-bold text-center py-6 ${pageSub}`}>{empty}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AnimatePresence>{catBots.map((bot) => renderCard(bot))}</AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  const sectionDivider = () => (
    <div className="flex items-center gap-3 my-7 px-1">
      <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-transparent via-[#F59E0B]/80 to-[#F59E0B]" />
      <div className="w-4 h-4 rotate-45 border-[3px] border-[#F59E0B] bg-[#F59E0B]/20 shadow-[0_0_14px_rgba(245,158,11,0.7)]" />
      <div className="flex-1 h-1 rounded-full bg-gradient-to-l from-transparent via-[#F59E0B]/80 to-[#F59E0B]" />
    </div>
  );

  const catBots = useMemo(
    () => (activeCat ? [...bots].filter((b) => categoryOf(b) === activeCat) : []),
    [bots, activeCat]
  );

  return (
    <div className="w-full px-2 pb-10">
      {!activeCat && (
        <div className="text-center mb-6 px-4">
          <h2 className={`text-xl sm:text-2xl font-black ${pageTitle}`}>
            {isAr ? 'متجر التداول' : 'Trading Store'}
          </h2>
          <p className={`text-xs sm:text-sm mt-2 font-bold ${pageSub}`}>
            {isAr ? 'بوتات ومؤشرات وخطط ومنتجات — مجاني ومدفوع' : 'Bots, indicators, plans & products — free and paid'}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <p className={`text-xs mt-3 font-bold ${pageSub}`}>{isAr ? 'جاري تحميل المتجر...' : 'Loading store...'}</p>
        </div>
      ) : activeCat ? (
        <div className="w-full">
          <div className="flex flex-col items-center mb-3">
            <h2 className={`text-lg sm:text-xl font-black mb-2 ${pageTitle}`}>{catLabel(isAr, activeCat)}</h2>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br from-sky-500 to-blue-700 keep-white">
              {(() => { const I = TILE_ICONS[activeCat]; return <I size={52} />; })()}
            </div>
          </div>
          {catBots.length === 0 ? (
            <div className="text-center py-20">
              <p className={`text-base font-black ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>
                {isAr ? 'لا توجد منتجات في هذا القسم بعد' : 'No products in this section yet'}
              </p>
              <p className={`text-xs mt-1 font-bold ${pageSub}`}>{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
            </div>
          ) : (
            <>
              {renderStack(catBots, true, activeCat)}
              {sectionDivider()}
              {renderStack(catBots, false, activeCat)}
            </>
          )}
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-20">
          <p className={`text-base font-black ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>{isAr ? 'لا توجد منتجات في المتجر بعد' : 'No products in the store yet'}</p>
          <p className={`text-xs mt-1 font-bold ${pageSub}`}>{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
        </div>
      ) : (
        <div className="w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STORE_CATEGORIES.map((s) => {
              const key = s.key;
              const Icon = TILE_ICONS[key];
              const c = counts[key];
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setActiveCat(key)}
                  className="bg-gradient-to-br from-sky-400 to-blue-700 border border-sky-300/50 rounded-2xl p-4 flex flex-col items-center gap-3 transition-all shadow-lg shadow-blue-600/40 ring-1 ring-white/10 hover:scale-[1.03] active:scale-95 text-center"
                >
                  <div className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center keep-white shadow-inner">
                    <Icon size={38} strokeWidth={2.1} />
                  </div>
                  <span className="text-lg font-black keep-white">{catLabel(isAr, key)}</span>
                  <div className="flex items-center gap-2 text-sm font-black uppercase keep-white">
                    <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/40 flex items-center gap-1 keep-white">
                      <Gift size={14} /> {c.free} {isAr ? 'مجاني' : 'Free'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/20 border border-white/40 flex items-center gap-1 keep-white">
                      <Sparkles size={14} /> {c.paid} {isAr ? 'مدفوع' : 'Paid'}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
          <p className={`text-center text-[10px] font-bold mt-5 ${pageSub}`}>
            {isAr ? 'اضغط على أي قسم لفتح صفحته الخاصة' : 'Tap a section to open its dedicated page'}
          </p>
          <p className={`text-center text-[9px] font-bold mt-1 ${pageSub}`}>
            {isAr ? 'معاملاتك تظهر في صفحة «معاملاتي» من القائمة الجانبية' : 'Your transactions show under Transactions in the side menu'}
          </p>
        </div>
      )}
    </div>
  );
}