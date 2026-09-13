import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Download, ShoppingCart, FileText, Tag } from 'lucide-react';
import { StoreBot, fetchStoreBots, downloadBot, formatFileSize } from '../services/storeService';

interface StorePageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
  onBuyBot: (bot: StoreBot) => void;
}

export default function StorePage({ lang, onBack, onBuyBot }: StorePageProps) {
  const isAr = lang === 'ar';
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<StoreBot | null>(null);

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

  const renderCard = (bot: StoreBot, isFree: boolean) => (
    <motion.div
      key={bot.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/[0.04] border rounded-2xl p-5 flex flex-col gap-3 transition-all hover:border-white/25 shadow-lg ${
        isFree ? 'border-emerald-500/40 hover:shadow-emerald-500/10' : 'border-white/10 hover:shadow-amber-500/10'
      }`}
    >
      {bot.imageData && (
        <div className="relative -mt-5 -mx-5 mb-1">
          <img src={bot.imageData} alt={bot.name} className="w-full h-40 object-cover rounded-t-2xl rounded-b-xl" />
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[9px] font-black uppercase tracking-wider">
            {isAr ? 'آلية العمل' : 'How it works'}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${isFree ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-amber-400 to-orange-600'}`}>
            {isFree ? <Tag size={22} className="text-black" /> : <Download size={22} className="text-black" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-black text-white truncate">{bot.name}</h3>
            {bot.fileName && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <FileText size={10} /> {bot.fileName} {bot.fileSize ? `(${formatFileSize(bot.fileSize)})` : ''}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase border-2 ${
          isFree
            ? 'text-emerald-400 border-emerald-400/60 bg-emerald-500/10'
            : 'text-amber-400 border-amber-400/40 bg-amber-500/10'
        }`}>
          {isFree ? 'مجاني' : formatPrice(bot.price)}
        </span>
      </div>

      {bot.description && (
        <p className="text-sm text-slate-300 leading-relaxed">{bot.description}</p>
      )}

      {isFree ? (
        <button
          onClick={() => handleFreeDownload(bot)}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-emerald-500 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 active:scale-95 transition-all"
        >
          <Download size={18} />
          {isAr ? 'تحميل مجاني' : 'Free Download'}
        </button>
      ) : (
        <button
          onClick={() => onBuyBot(bot)}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#F59E0B] text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-[#F59E0B]/30 hover:bg-[#d97706] active:scale-95 transition-all"
        >
          <ShoppingCart size={18} />
          {isAr ? 'شراء الآن' : 'Buy Now'}
        </button>
      )}
    </motion.div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-black text-white">
          {isAr ? 'متجر بوتات التداول' : 'Trading Bots Store'}
        </h2>
        <p className="text-sm text-slate-400 mt-3">{isAr ? 'بوتات ومؤشرات ذكية لتحليل التداول — انتبه للقسم المجاني' : 'Smart bots & indicators for trading analysis — check the FREE section'}</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          <p className="text-sm text-slate-400 mt-4">{isAr ? 'جاري تحميل المتجر...' : 'Loading store...'}</p>
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-lg font-bold text-slate-300">{isAr ? 'لا توجد بوتات في المتجر بعد' : 'No bots in the store yet'}</p>
          <p className="text-sm text-slate-500 mt-2">{isAr ? 'ترقبوا الإضافات الجديدة قريباً' : 'New additions coming soon'}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {freeBots.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-xl text-xs font-black uppercase text-emerald-400 border-2 border-emerald-400 bg-emerald-500/10">
                  {isAr ? 'بوتات مجانية' : 'Free Bots'}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {freeBots.map((bot) => renderCard(bot, true))}
              </div>
            </section>
          )}

          {paidBots.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 rounded-xl text-xs font-black uppercase text-amber-400 border-2 border-amber-400/50 bg-amber-500/10">
                  {isAr ? 'بوتات مدفوعة' : 'Paid Bots'}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paidBots.map((bot) => renderCard(bot, false))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Free download overlay (acts as the direct download page) */}
      {downloading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-md w-full bg-brand-alt border border-emerald-500/40 rounded-[32px] p-8 text-center shadow-[0_32px_128px_-12px_rgba(16,185,129,0.4)]"
          >
            <div className="text-5xl mb-4 animate-bounce">📥</div>
            <h3 className="text-xl font-black text-white">{isAr ? 'جاري تحميل البوت...' : 'Downloading bot...'}</h3>
            <p className="text-sm text-slate-300 mt-2 font-bold">{downloading.name}</p>
            <p className="text-xs text-slate-500 mt-1">{downloading.fileName}</p>
            <div className="w-full h-2 bg-white/10 rounded-full mt-6 overflow-hidden">
              <div className="h-full w-full bg-emerald-500 animate-pulse rounded-full" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}