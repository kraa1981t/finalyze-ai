import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShoppingCart, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { StoreBot, fetchStoreBots, formatFileSize } from '../services/storeService';

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
  }, []);

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  // Theme-inverted cards: black box in light mode, white box in dark mode
  const cardBg = isDark ? 'bg-white' : 'bg-[#0B0F17]';
  const cardBorder = isDark ? 'border-black/10' : 'border-white/15';
  const pageTitle = isDark ? 'text-slate-900' : 'text-white';
  const pageSub = isDark ? 'text-slate-500' : 'text-slate-400';
  const divider = isDark ? 'bg-black/10' : 'bg-white/10';

  const renderCard = (bot: StoreBot) => {
    const needToggle = bot.description.length > MAX_DESC_LEN;
    const isOpen = !!expanded[bot.id ?? ''];
    const shown = isOpen || !needToggle ? bot.description : bot.description.slice(0, MAX_DESC_LEN) + '…';
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
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center shadow-md bg-gradient-to-br from-amber-400 to-orange-600`}>
              <ShoppingCart size={16} className="text-black" />
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
          <span className="shrink-0 px-2 py-1 rounded-lg text-[10px] font-black uppercase border-2 text-amber-400 border-amber-400/40 bg-amber-500/10">
            {formatPrice(bot.price)}
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

        <button
          onClick={() => onBuyBot(bot)}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#F59E0B] text-black font-black text-xs uppercase tracking-wider shadow-md shadow-[#F59E0B]/30 hover:bg-[#d97706] active:scale-95 transition-all"
        >
          <ShoppingCart size={14} />
          {isAr ? 'اشترِ الآن' : 'Buy Now'}
        </button>
      </motion.div>
    );
  };

  // All bots in a single grid — every bot requires purchase
  const allBots = [...bots];

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
          {isAr ? 'بوتات ومؤشرات ذكية لتحليل التداول' : 'Smart bots & indicators for trading analysis'}
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3 mt-1">
            <span className="text-2xl font-black uppercase tracking-wide whitespace-nowrap text-red-500">{isAr ? 'البوتات' : 'Bots'}</span>
            <div className={`flex-1 h-px ${divider}`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {allBots.map((bot) => renderCard(bot))}
          </div>
        </div>
      )}
    </div>
  );
}