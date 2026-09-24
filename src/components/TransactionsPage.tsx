import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, XCircle, Receipt, CheckCircle2, Clock, Store } from 'lucide-react';
import { Language } from '../lib/i18n';
import { loadAllSessions, cancelSession, PaymentSession } from '../services/paymentSession';
import { fetchPaymentRequests, fetchUserGrants, PaymentRequest, PaymentGrant } from '../services/paymentRequests';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';
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

  const load = useCallback(async () => {
    if (!autoEmail) return;
    setLoading(true);
    const [sessions, requests, grants] = await Promise.all([
      loadAllSessions(autoEmail),
      fetchPaymentRequests(),
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

    const list = [...merged.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setRows(list);
    setLoaded(true);
    setLoading(false);
  }, [autoEmail]);

  useEffect(() => {
    if (autoEmail) load();
  }, [autoEmail, load]);

  const handleCancel = async (id: string) => {
    await cancelSession(id);
    load();
  };

  const isAr = lang === 'ar';
  const pendingCount = rows.filter((r) => r.status === 'active' || r.status === 'pending').length;
  const stLabel = (st: RowStatus): string => {
    switch (st) {
      case 'active': return lt(lang, 52);
      case 'pending': return lt(lang, 416);
      case 'confirmed': return lt(lang, 167);
      case 'cancelled': return lt(lang, 124);
      case 'completed': return lt(lang, 155);
    }
  };
  const stClass = (st: RowStatus): string => {
    switch (st) {
      case 'active': return 'bg-blue-500/20 text-blue-400';
      case 'pending': return 'bg-amber-500/20 text-amber-400';
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      case 'completed': return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="w-full px-2 pb-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 rounded-xl border border-white/10 text-slate-400 hover:text-white bg-white/5 transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Receipt size={20} className="text-[#F59E0B]" />
              {isDeveloper ? (lt(lang, 191)) : (lt(lang, 342))}
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-0.5">
              {isDeveloper
                ? (lt(lang, 477))
                : (lt(lang, 635))}
            </p>
          </div>
        </div>

        {isDeveloper && (
          <div className="mb-6">
            <PaymentRequestsSection lang={lang} developerEmail={autoEmail} />
            <SiteRequestsSection lang={lang} />
          </div>
        )}

        {!isDeveloper && pendingCount > 0 && (
          <div className="mb-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 p-3.5 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <p className="text-sm text-amber-300 font-bold">
              {ltp(lang, 792, String(pendingCount), pendingCount > 1 ? 's' : '')}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-black uppercase tracking-wider text-slate-400">
            {lt(lang, 578)}
          </label>
          <button
            onClick={load}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lt(lang, 453)}
          </button>
        </div>

        {!loaded ? (
          <button
            onClick={load}
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white text-sm font-black uppercase tracking-wider transition-all"
          >
            {lt(lang, 600)}
          </button>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
            <Receipt size={28} className="mx-auto mb-2 text-slate-500" />
            <p className="text-sm text-slate-400 font-bold">{lt(lang, 373)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((t) => (
              <div key={t.key} className="rounded-2xl bg-white/5 border border-white/10 p-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-white truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 font-bold truncate mt-0.5">
                      {autoEmail} · ${t.amountUsd.toFixed(2)} USDT
                      {t.requestNo ? ` · #${t.requestNo}` : ''}
                      {t.method ? ` · ${t.method}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                      <Clock size={12} />
                      {lt(lang, 183)} {fmtGmt(t.createdAt)}
                      {t.decidedAt ? ` · ${lt(lang, 195)} ${fmtGmt(t.decidedAt)}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${stClass(t.status)}`}>
                    {stLabel(t.status)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {(t.status === 'active' || t.status === 'pending') && t.session && (
                    <button
                      onClick={() => onResumeSession?.(t.session!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B] text-black font-black text-xs uppercase tracking-wider hover:bg-[#d97706] transition-all"
                    >
                      <RefreshCw size={12} />
                      {lt(lang, 474)}
                    </button>
                  )}
                  {t.status === 'active' && t.session && (
                    <button
                      onClick={() => handleCancel(t.session!.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 text-xs font-black uppercase tracking-wider transition-all"
                    >
                      <XCircle size={12} />
                      {lt(lang, 120)}
                    </button>
                  )}
                  {t.status === 'confirmed' && t.grant && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
                      <CheckCircle2 size={12} />
                      {lt(lang, 213)}
                    </span>
                  )}
                  {t.status === 'confirmed' && (
                    <button
                      onClick={() => onGoToStore?.()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all"
                    >
                      <Store size={12} />
                      {lt(lang, 273)}
                    </button>
                  )}
                  {(t.status === 'cancelled') && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wider">
                      <XCircle size={12} />
                      {lt(lang, 460)}
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