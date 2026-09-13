import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Download, ShoppingCart, FileText, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { StoreBot, fetchStoreBots, downloadBot, formatFileSize } from '../services/storeService';

interface StorePageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
  isDark: boolean;
  onBuyBot: (bot: StoreBot) => void;
}

const MAX_DESC_LEN = 55;

export default function StorePage({ lang, onBack, isDark, onBuyBot }: StorePageProps) {
  const isAr = lang === 'ar';
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<StoreBot | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
  }, []);

  const freeBots = bots.filter((b) => b.price <= 0);
  const paidBots = bots.filter((b) => b.price > 0);
  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  const handleFreeDownload = (bot: StoreBot) => {
    setDownloading(bot);
    setTimeout(() => { downloadBot(bot); setDownloading(null); }, 1100);
  };

  // Theme-inverted cards: black box in light mode, white box in dark mode
  const cardBg = isDark ? 'bg-white' : 'bg-[#0B0F17]';
  const cardBorder = isDark ? 'border-black/10' : 'border-white/15';
  const pageTitle = isDark ? 'text-slate-900' : 'text-white';
  const pageSub = isDark ? 'text-slate-500' : 'text-slate-400';
  const divider = isDark ? 'bg-black/10' : 'bg-white/10';
  const panelBg = isDark ? 'bg-white' : 'bg-[#0B0F17]';

  const renderCard = (bot: StoreBot, isFree: boolean) => {
    const needToggle = bot.description.length > MAX_DESC_LEN;
    const isOpen = !!expanded[bot.id ?? ''];
    const shown = isOpen || !needToggle ? bot.description : bot.description.slice(0, MAX_DESC_LEN) + '…';
    return (
      <motion.div
        key={bot.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} ${cardBorder} border rounded-xl p-3 flex flex-col gap-2 transition-all shadow-lg ${
          isFree
            ? isDark ? 'hover:shadow-emerald-500/20' : 'hover:shadow-emerald-500/10'
            : isDark ? 'hover:shadow-amber-500/20' : 'hover:shadow-amber-500/10'
        }`}
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
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-md ${isFree ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-amber-400 to-orange-600'}`}>
              {isFree ? <Tag size={16} className="text-black" /> : <Download size={16} className="text-black" />}
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
          <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase border-2 ${
            isFree
              ? isDark
                ? 'text-emerald-600 border-emerald-600/60 bg-emerald-500/10'
                : 'text-emerald-400 border-emerald-400/60 bg-emerald-500/10'
              : isDark
                ? 'text-amber-600 border-amber-600/60 bg-amber-500/10'
                : 'text-amber-400 border-amber-400/40 bg-amber-500/10'
          }`}>
            {isFree ? (isAr ? 'مجاني' : 'FREE') : formatPrice(bot.price)}
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

        {isFree ? (
          <button
            onClick={() => handleFreeDownload(bot)}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-500 text-black font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
          >
            <Download size={14} />
            {isAr ? 'تحميل مجاني' : 'Free Download'}
          </button>
        ) : (
          <button
            onClick={() => onBuyBot(bot)}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#F59E0B] text-black font-black text-xs uppercase tracking-wider shadow-md shadow-[#F59E0B]/30 hover:bg-[#d97706] active:scale-95 transition-all"
          >
            <ShoppingCart size={14} />
            {isAr ? 'شراء الآن' : 'Buy Now'}
          </button>
        )}
      </motion.div>
    );
  };

  // Two boxes per level; column scrolls vertically when many
  const renderColumn = (list: StoreBot[], isFree: boolean, headerLabel: string) => (
    <section className="md:max-h-[640px] md:overflow-y-auto custom-scrollbar md:pe-1.5">
      <div className="flex items-center gap-2 mb-3 mt-1">
        <span className={`text-2xl font-black uppercase tracking-wide whitespace-nowrap ${isFree ? 'text-emerald-500' : 'text-red-500'}`}>{headerLabel}</span>
        <div className={`flex-1 h-px ${divider}`} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 items-start">
        {list.map((bot) => renderCard(bot, isFree))}
      </div>
    </section>
  );

  const freeCol = freeBots.length > 0 && renderColumn(freeBots, true, isAr ? 'بوتات مجانية' : 'Free Bots');
  const paidCol = paidBots.length > 0 && renderColumn(paidBots, false, isAr ? 'بوتات مدفوعة' : 'Paid Bots');

  // Dashed vertical rosary-style separator between the two sections
  const separator = (
    <div className="hidden md:block shrink-0 self-stretch w-0 mx-3 border-s-2 border-dashed border-slate-500/50" />
  );

  // Free far LEFT, paid far RIGHT (physical) — RTL flips the DOM order
  const columns = (() => {
    if (freeCol && paidCol) return isAr ? [paidCol, separator, freeCol] : [freeCol, separator, paidCol];
    return [freeCol, paidCol].filter(Boolean) as React.ReactNode[];
  })();

  return (
    <div className="w-full px-2 pb-10">
      <div className="max-w-4xl mx-auto flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className={`p-2 rounded-xl border transition-all ${isDark ? 'bg-black/5 border-black/10 text-slate-600 hover:text-black' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-6 px-4">
        <h2 className={`text-xl sm:text-2xl font-black ${pageTitle}`}>
          {isAr ? 'متجر بوتات التداول' : 'Trading Bots Store'}
        </h2>
        <p className={`text-xs sm:text-sm mt-2 font-bold ${pageSub}`}>
          {isAr ? 'بوتات ومؤشرات ذكية لتحليل التداول — انتبه للقسم المجاني' : 'Smart bots & indicators for trading analysis — check the FREE section'}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <p className={`text-xs mt-3 font-bold ${pageSub}`}>{isAr ? 'جاري تحميل المتجر...' : 'Loading store...'}</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-20">
          <p className={`text-base font-black ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>{isAr ? 'لا توجد بوتات في المتجر بعد' : 'No bots in the store yet'}</p>
          <p className={`text-xs mt-1 font-bold ${pageSub}`}>{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-stretch md:justify-between md:gap-0">
          {columns.map((col, idx) => <React.Fragment key={idx}>{col}</React.Fragment>)}
        </div>
      )}

      {/* Free download overlay (acts as the direct download page) */}
      {downloading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative max-w-md w-full rounded-[28px] p-8 text-center shadow-[0_32px_128px_-12px_rgba(16,185,129,0.4)] ${panelBg} border border-emerald-500/40`}
          >
            <div className="text-5xl mb-4 animate-bounce">📥</div>
            <h3 className={`text-lg font-black ${pageTitle}`}>{isAr ? 'جاري تحميل البوت...' : 'Downloading bot...'}</h3>
            <p className={`text-xs mt-2 font-bold ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>{downloading.name}</p>
            <p className={`text-[10px] mt-1 ${pageSub}`}>{downloading.fileName}</p>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-5 overflow-hidden">
              <div className="h-full w-full bg-emerald-500 animate-pulse rounded-full" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}