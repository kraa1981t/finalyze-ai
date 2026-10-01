import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, XCircle, Receipt, CheckCircle2, Clock, Store, Trash2 } from 'lucide-react';
import { Language } from '../lib/i18n';
import { loadAllSessions, cancelSession, PaymentSession } from '../services/paymentSession';
import { fetchPaymentRequests, fetchUserPaymentRequests, fetchUserGrants, fetchDevHistory, fetchDevHiddenTransactionIds, hideTransactionFromDev, PaymentRequest, PaymentGrant } from '../services/paymentRequests';
import PaymentRequestsSection from './PaymentRequestsSection';
import SiteRequestsSection from './SiteRequestsSection';

interface TransactionsPageProps {
  lang: Language;
  onBack: () => void;
  onResumeSession?: (session: PaymentSession) => void;
  onGoToStore?: () => void;
  autoEmail?: string;
  isDeveloper?: boolean;
}

type RowStatus = 'active' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface TxRow {
  key: string;
  title: string;
  amountUsd: number;
  requestNo?: number;
  method?: string;
  createdAt: number;
  decidedAt?: number;
  status: RowStatus;
  session?: PaymentSession;
  request?: PaymentRequest;
  grant?: PaymentGrant;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtGmt = (ts?: number): string => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
};

export default function TransactionsPage({ lang, onBack, onResumeSession, onGoToStore, autoEmail, isDeveloper }: TransactionsPageProps) {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devHistory, setDevHistory] = useState<PaymentRequest[]>([]);
  const [devHidden, setDevHidden] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!autoEmail) return;
    setLoading(true);
    const [sessions, requests, grants] = await Promise.all([
      loadAllSessions(autoEmail),
      isDeveloper ? fetchPaymentRequests() : fetchUserPaymentRequests(autoEmail),
      fetchUserGrants(autoEmail),
    ]);
    const email = autoEmail.toLowerCase();
    const myRequests = (requests || []).filter((r) => String(r.buyerEmail || '').toLowerCase() === email);
    const myGrants = (grants || []).filter((g) => String(g.email || '').toLowerCase() === email);

    const byReqNo = new Map<number, TxRow>();
    myRequests.forEach((r) => {
      const grant = myGrants.find((g) => g.kind === r.kind && (r.kind !== 'bot' || g.botId === r.botId));
      const status: RowStatus = r.status === 'approved' ? 'confirmed' : r.status === 'rejected' ? 'cancelled' : 'pending';
      byReqNo.set(Number(r.requestNo) || 0, {
        key: r.id || `r_${r.requestNo}`,
        title: r.kind === 'bot' ? (r.botName || 'Bot') : (r.planLabel || 'Plan'),
        amountUsd: r.amountUsd,
        requestNo: r.requestNo,
        method: r.method,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        status,
        request: r,
        grant: grant || undefined,
      });
    });

    const merged = new Map<string, TxRow>();
    byReqNo.forEach((v, k) => { if (k > 0) merged.set(`req_${k}`, v); });

    // Also include any grants that don't have a matching request
    myGrants.forEach((g) => {
      const hasMatch = [...byReqNo.values()].some(r => (g.requestNo && r.requestNo === g.requestNo) || (r.grant?.id === g.id));
      if (!hasMatch) {
        const key = g.id || `grant_${g.requestNo || Date.now()}`;
        merged.set(key, {
          key,
          title: g.kind === 'bot' ? (g.botName || 'Bot') : (g.planLabel || 'Plan'),
          amountUsd: g.amountUsd || 0,
          requestNo: g.requestNo,
          createdAt: g.grantedAt || Date.now(),
          status: 'confirmed',
          grant: g,
        });
      }
    });

    (sessions || []).forEach((s) => {
      const existing = s.requestNo && byReqNo.get(Number(s.requestNo));
      if (existing) {
        existing.session = s;
        return;
      }
      const status: RowStatus = s.status === 'cancelled' ? 'cancelled' : s.status === 'completed' ? 'completed' : 'active';
      merged.set(`s_${s.id}`, {
        key: s.id,
        title: s.kind === 'bot' ? (s.botName || 'Bot') : (s.planLabel || 'Plan'),
        amountUsd: s.amountUsd,
        requestNo: s.requestNo,
        method: s.method,
        createdAt: s.createdAt,
        status,
        session: s,
      });
    });

    // Also include active_subscription from localStorage if present and not already displayed
    try {
      const activeSubRaw = localStorage.getItem('active_subscription');
      if (activeSubRaw) {
        const activeSub = JSON.parse(activeSubRaw);
        if (activeSub && activeSub.label) {
          const hasMatchingRow = [...merged.values()].some(r =>
            (activeSub.requestNo && r.requestNo === activeSub.requestNo) ||
            (r.title === activeSub.label && r.status === 'confirmed')
          );
          if (!hasMatchingRow) {
            const key = `active_sub_${activeSub.requestNo || 'current'}`;
            merged.set(key, {
              key,
              title: activeSub.label || 'Plan',
              amountUsd: activeSub.amount || 0,
              requestNo: activeSub.requestNo,
              createdAt: activeSub.startedAt || (activeSub.expiryDate ? new Date(activeSub.expiryDate).getTime() - (activeSub.durationDays || 30) * 86400000 : Date.now()),
              status: 'confirmed',
            });
          }
        }
      }
    } catch {}

    const list = [...merged.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setRows(list);

    if (isDeveloper) {
      const [history, hidden] = await Promise.all([fetchDevHistory(), fetchDevHiddenTransactionIds()]);
      if (history) setDevHistory(history || []);
      setDevHidden(hidden || []);
    }

    setLoaded(true);
    setLoading(false);
  }, [autoEmail, isDeveloper]);

  useEffect(() => {
    if (autoEmail) load();
  }, [autoEmail, load]);

  const handleCancel = async (id: string) => {
    await cancelSession(id);
    load();
  };

  const handleDevDelete = async (id: string) => {
    await hideTransactionFromDev(id);
    load();
  };

  const isAr = lang === 'ar';
  const pendingCount = rows.filter((r) => r.status === 'active' || r.status === 'pending').length;
  const stLabel = (st: RowStatus): string => {
    switch (st) {
      case 'active': return isAr ? 'قيد الانتظار' : 'Active';
      case 'pending': return isAr ? 'قيد التأكيد' : 'Pending';
      case 'confirmed': return isAr ? 'تم التأكيد — الخطة مفعلة' : 'Confirmed — Active Plan';
      case 'cancelled': return isAr ? 'ملغاة' : 'Cancelled';
      case 'completed': return isAr ? 'مكتملة' : 'Completed';
    }
  };
  const stClass = (st: RowStatus): string => {
    switch (st) {
      case 'active': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'pending': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'completed': return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
    }
  };

  return (
    <div className="w-full px-2 pb-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={onBack} className="p-3 rounded-2xl border border-white/10 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all shadow-md">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
              <Receipt size={26} className="text-[#F59E0B]" />
              {isDeveloper ? (isAr ? 'تأكيد معاملات العملاء' : 'Customer Payment Confirmations') : (isAr ? 'معاملاتي' : 'My Transactions')}
            </h2>
            <p className="text-base font-bold text-slate-300 mt-1">
              {isDeveloper
                ? (isAr ? 'افحص الطلبات، قارن توقيت غرينتش، ثم أكّد أو ارفض لتحرير وتفعيل الخطة أو البوت.' : 'Review requests, compare GMT time, then approve or reject to activate plans or bots.')
                : (isAr ? 'سجل معاملاتك: الخطط المفعلة، المكتملة، الملغاة، والقيد التأكيد/الانتظار.' : 'Your transactions: active plans, confirmed, cancelled, and pending.')}
            </p>
          </div>
        </div>

        {isDeveloper && (
          <div className="space-y-6">
            <PaymentRequestsSection lang={lang === 'ar' ? 'ar' : 'en'} developerEmail={autoEmail} />
            <SiteRequestsSection lang={lang === 'ar' ? 'ar' : 'en'} />
          </div>
        )}

        {isDeveloper && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <label className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-200">
                {isAr ? 'سجل المشتريات (تاريخ)' : 'Purchase History (dates)'}
              </label>
              <button
                onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-sm font-black uppercase tracking-wider transition-all"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {isAr ? 'تحديث' : 'Refresh'}
              </button>
            </div>
            {devHistory.length === 0 ? (
              <p className="text-sm text-slate-400 font-bold text-center py-4">
                {isAr ? 'لا توجد مشتريات بعد' : 'No purchases yet'}
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {devHistory
                  .filter((r) => !devHidden.includes(r.id || ''))
                  .map((r) => (
                    <div key={r.id || `r_${r.requestNo}`} className="flex items-center gap-3 flex-wrap rounded-2xl bg-black/30 border border-white/10 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base sm:text-lg font-black text-white truncate">
                          {r.kind === 'bot' ? (r.botName || 'Bot') : (r.planLabel || 'Plan')}
                          <span className="text-slate-300 font-bold"> · {r.buyerName || r.buyerEmail}</span>
                        </p>
                        <p className="text-sm sm:text-base text-slate-300 font-bold truncate mt-1">
                          ${Number(r.amountUsd || 0).toFixed(2)} USDT
                          {r.requestNo ? ` · #${r.requestNo}` : ''}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                          <Clock size={14} />
                          {fmtGmt(r.createdAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider ${stClass(r.status === 'approved' ? 'confirmed' : r.status === 'rejected' ? 'cancelled' : 'pending')}`}>
                        {stLabel(r.status === 'approved' ? 'confirmed' : r.status === 'rejected' ? 'cancelled' : 'pending')}
                      </span>
                      <button
                        onClick={() => handleDevDelete(r.id || '')}
                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-sm font-black uppercase tracking-wider transition-all"
                      >
                        <Trash2 size={14} />
                        {isAr ? 'مسح' : 'Clear'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {!isDeveloper && pendingCount > 0 && (
          <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-4 flex items-center gap-3 shadow-lg">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
            <p className="text-base text-amber-300 font-black">
              {isAr
                ? `لديك ${pendingCount} معاملة معلقة — استأنفها أو انتظر التأكيد من المطور`
                : `You have ${pendingCount} pending transaction${pendingCount > 1 ? 's' : ''} — resume or wait for confirmation`}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <label className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-200">
            {isAr ? 'قائمة المعاملات' : 'Transaction list'}
          </label>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-sm font-black uppercase tracking-wider transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>

        {!loaded ? (
          <button
            onClick={load}
            className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-base font-black uppercase tracking-wider transition-all shadow-md"
          >
            {isAr ? 'عرض المعاملات' : 'View transactions'}
          </button>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center shadow-lg">
            <Receipt size={36} className="mx-auto mb-3 text-slate-400" />
            <p className="text-base sm:text-lg text-slate-300 font-bold">{isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((t) => (
              <div key={t.key} className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl hover:border-white/20 transition-all">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg sm:text-xl font-black text-white truncate">{t.title}</p>
                    <p className="text-sm sm:text-base text-slate-300 font-bold truncate mt-1">
                      {autoEmail} · ${t.amountUsd.toFixed(2)} USDT
                      {t.requestNo ? ` · #${t.requestNo}` : ''}
                      {t.method ? ` · ${t.method}` : ''}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                      <Clock size={14} />
                      {isAr ? 'بتوقيت غرينتش:' : 'Created (GMT):'} {fmtGmt(t.createdAt)}
                      {t.decidedAt ? ` · ${isAr ? 'الحسم:' : 'decided:'} ${fmtGmt(t.decidedAt)}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider ${stClass(t.status)}`}>
                    {stLabel(t.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                  {(t.status === 'active' || t.status === 'pending') && t.session && (
                    <button
                      onClick={() => onResumeSession?.(t.session!)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-black font-black text-sm uppercase tracking-wider hover:bg-[#d97706] transition-all shadow-md active:scale-95"
                    >
                      <RefreshCw size={14} />
                      {isAr ? 'متابعة المعاملة' : 'Resume'}
                    </button>
                  )}
                  {t.status === 'active' && t.session && (
                    <button
                      onClick={() => handleCancel(t.session!.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 text-sm font-black uppercase tracking-wider transition-all"
                    >
                      <XCircle size={14} />
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  )}
                  {t.status === 'confirmed' && (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-black uppercase tracking-wider">
                      <CheckCircle2 size={14} />
                      {isAr ? 'الخطة مفعلة ومتاحة' : 'Plan is active'}
                    </span>
                  )}
                  {t.status === 'confirmed' && (
                    <button
                      onClick={() => onGoToStore?.()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-black font-black text-sm uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-md active:scale-95"
                    >
                      <Store size={14} />
                      {isAr ? 'الذهاب إلى المتجر' : 'Go to Store'}
                    </button>
                  )}
                  {(t.status === 'cancelled') && (
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-black uppercase tracking-wider">
                      <XCircle size={14} />
                      {isAr ? 'تم الرفض / الإلغاء' : 'Rejected / cancelled'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}