import React, { useState, useEffect } from 'react';
import { ArrowLeft, History, RefreshCw, XCircle, Receipt } from 'lucide-react';
import { Language } from '../lib/i18n';
import { loadAllSessions, cancelSession, PaymentSession } from '../services/paymentSession';

interface TransactionsPageProps {
  lang: Language;
  onBack: () => void;
  onResumeSession?: (session: PaymentSession) => void;
  autoEmail?: string;
}

export default function TransactionsPage({ lang, onBack, onResumeSession, autoEmail }: TransactionsPageProps) {
  const [txs, setTxs] = useState<PaymentSession[]>([]);
  const [txsLoaded, setTxsLoaded] = useState(false);

  const loadHistory = () => {
    loadAllSessions(autoEmail).then((list) => { setTxs(list); setTxsLoaded(true); });
  };

  useEffect(() => {
    if (autoEmail) loadHistory();
  }, [autoEmail]);

  const handleCancelHistory = async (id: string) => {
    await cancelSession(id);
    loadHistory();
  };

  const liveCount = txs.filter((t) => t.status === 'active' || t.status === 'pending').length;

  return (
    <div className="bg-brand-alt border border-white/10 rounded-[32px] p-6 md:p-8 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Receipt size={20} className="text-[#F59E0B]" />
          {lang === 'ar' ? 'معاملاتي' : 'My Transactions'}
        </h2>
      </div>

      {liveCount > 0 && (
        <div className="mb-4 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <p className="text-[11px] text-amber-300 font-bold">
            {lang === 'ar'
              ? `لديك ${liveCount} معاملة معلقة — استأنفها للتحميل`
              : `You have ${liveCount} pending transaction${liveCount > 1 ? 's' : ''} — resume to download`}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-black uppercase tracking-wider text-white/50">
          {lang === 'ar' ? 'قائمة المعاملات' : 'Transaction list'}
        </label>
        <button
          onClick={loadHistory}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-all"
        >
          <RefreshCw size={11} />
          {lang === 'ar' ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {!txsLoaded ? (
        <button
          onClick={loadHistory}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <History size={14} />
          {lang === 'ar' ? 'عرض المعاملات' : 'View transactions'}
        </button>
      ) : txs.length === 0 ? (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <p className="text-[11px] text-white/40 font-bold text-center">
            {lang === 'ar' ? 'لا توجد معاملات بعد' : 'No transactions yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => {
            const isLive = t.status === 'active' || t.status === 'pending';
            return (
              <div key={t.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white truncate">
                      {t.kind === 'bot' ? t.botName || 'Bot' : t.planLabel || 'Plan'}
                    </p>
                    <p className="text-[10px] text-white/40 font-bold truncate mt-0.5">
                      {t.buyerEmail || (lang === 'ar' ? 'بدون بريد' : 'no email')} · ${t.amountUsd.toFixed?.(2) ?? t.amountUsd} USDT
                      {t.requestNo ? ` · #${t.requestNo}` : ''}
                      {t.method ? ` · ${t.method}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      t.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400'
                      : t.status === 'cancelled' ? 'bg-red-500/20 text-red-400'
                      : t.status === 'pending' ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {t.status === 'completed' ? (lang === 'ar' ? 'مكتملة' : 'Completed')
                        : t.status === 'cancelled' ? (lang === 'ar' ? 'ملغاة' : 'Cancelled')
                        : t.status === 'pending' ? (lang === 'ar' ? 'قيد التأكيد' : 'Pending')
                        : (lang === 'ar' ? 'قيد الانتظار' : 'Active')}
                    </span>
                  </div>
                </div>
                {isLive && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onResumeSession?.(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B] text-black font-black text-[10px] uppercase tracking-wider hover:bg-[#d97706] transition-all"
                    >
                      <RefreshCw size={11} />
                      {lang === 'ar' ? 'استئناف' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleCancelHistory(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/40 text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      <XCircle size={11} />
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}