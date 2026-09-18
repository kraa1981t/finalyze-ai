import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Check, X, Clock, Mail, Wallet, User, ShoppingCart, Crown, Hash } from 'lucide-react';
import {
  PaymentRequest,
  fetchPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
} from '../services/paymentRequests';
import {
  loadPaymentSettings,
  savePaymentSettings,
  ConfirmMode,
  DEFAULT_CONFIRM_MODE,
  DEFAULT_BINANCE_EMAIL,
} from '../services/paymentSettings';

interface PaymentRequestsSectionProps {
  lang: 'ar' | 'en';
  developerEmail?: string;
}

function currentDevEmail(): string {
  try {
    const raw = localStorage.getItem('finalyze_auth_user');
    if (raw) return JSON.parse(raw).email || '';
  } catch {}
  return '';
}

export default function PaymentRequestsSection({ lang, developerEmail }: PaymentRequestsSectionProps) {
  const isAr = lang === 'ar';
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ConfirmMode>(DEFAULT_CONFIRM_MODE);
  const [binanceEmail, setBinanceEmail] = useState(DEFAULT_BINANCE_EMAIL);
  const [emailDraft, setEmailDraft] = useState(DEFAULT_BINANCE_EMAIL);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    const [list, settings] = await Promise.all([fetchPaymentRequests(), loadPaymentSettings()]);
    setRequests(list);
    if (settings?.confirmMode) setMode(settings.confirmMode);
    if (settings?.binanceNotifyEmail) {
      setBinanceEmail(settings.binanceNotifyEmail);
      setEmailDraft(settings.binanceNotifyEmail);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeMode = async (m: ConfirmMode) => {
    setMode(m);
    await savePaymentSettings({ confirmMode: m });
  };

  const saveEmail = async () => {
    const clean = emailDraft.trim() || DEFAULT_BINANCE_EMAIL;
    setBinanceEmail(clean);
    await savePaymentSettings({ binanceNotifyEmail: clean });
  };

  const approve = async (req: PaymentRequest) => {
    if (!req.id) return;
    setBusyId(req.id);
    await approvePaymentRequest(req, developerEmail || currentDevEmail());
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'approved', decidedAt: Date.now() } : r)));
    setBusyId(null);
  };

  const reject = async (req: PaymentRequest) => {
    if (!req.id) return;
    setBusyId(req.id);
    await rejectPaymentRequest(req, developerEmail || currentDevEmail());
    setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'rejected', decidedAt: Date.now() } : r)));
    setBusyId(null);
  };

  const shown = filter === 'pending' ? requests.filter((r) => r.status === 'pending') : requests;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const fmtDate = (ts?: number) => (ts ? new Date(ts).toLocaleString(isAr ? 'ar-DZ' : 'en-GB') : '—');

  const statusStyle = (s: PaymentRequest['status']) => {
    if (s === 'approved') return 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10';
    if (s === 'rejected') return 'text-red-400 border-red-400/40 bg-red-500/10';
    return 'text-amber-400 border-amber-400/40 bg-amber-500/10';
  };

  const statusLabel = (s: PaymentRequest['status']) =>
    s === 'approved' ? (isAr ? 'تم الإفراج' : 'Released')
      : s === 'rejected' ? (isAr ? 'مرفوض' : 'Rejected')
        : (isAr ? 'قيد المراجعة' : 'Pending');

  return (
    <div className="space-y-4">
      {/* Confirmation method switch — mutually exclusive */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-1">
          {isAr ? 'طريقة تأكيد الدفع' : 'Payment Confirmation Method'}
        </h5>
        <p className="text-[11px] text-slate-500 mb-3">
          {isAr
            ? 'مفتاح واحد فقط يعمل في نفس الوقت. عند تفعيل طريقة تُعطَّل الأخرى تلقائياً. التأكيد يتم يدوياً من طرفك.'
            : 'Only one method is active at a time. Enabling one disables the other automatically. Confirmation is done manually by you.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            onClick={() => changeMode('binance_email')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
              mode === 'binance_email'
                ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
            }`}
          >
            <Mail size={16} />
            {isAr ? 'التحقق عبر بريد Binance' : 'Binance Email Check'}
          </button>
          <button
            onClick={() => changeMode('manual')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
              mode === 'manual'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
            }`}
          >
            <Check size={16} />
            {isAr ? 'تأكيد يدوي' : 'Manual Confirmation'}
          </button>
        </div>

        {mode === 'binance_email' && (
          <div className="mt-3">
            <label className="text-[11px] text-slate-500 font-bold block mb-1">
              {isAr ? 'بريد تأكيدات Binance' : 'Binance confirmation email'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-[#F59E0B]"
              />
              <button
                onClick={saveEmail}
                className="px-4 py-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition-all text-xs font-black"
              >
                {isAr ? 'حفظ' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {isAr
                ? `تحقق دورياً من هذا البريد وطابق المبلغ والتاريخ مع رقم الطلب أدناه.`
                : `Periodically check this inbox and match amount + date with the request number below.`}
            </p>
          </div>
        )}
      </div>

      {/* Requests list */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
            <Hash size={14} className="text-[#F59E0B]" />
            {isAr ? 'طلبات تأكيد الدفع' : 'Payment Confirmation Requests'}
            {pendingCount > 0 && (
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                {pendingCount} {isAr ? 'جديد' : 'new'}
              </span>
            )}
          </h5>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all"
            >
              {filter === 'pending' ? (isAr ? 'عرض الكل' : 'Show all') : (isAr ? 'المعلّقة فقط' : 'Pending only')}
            </button>
            <button
              onClick={load}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-8">
            {isAr ? 'لا توجد طلبات حالياً' : 'No requests yet'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {shown.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 border border-white/10 rounded-xl p-3.5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#F59E0B] text-black text-xs font-black">
                      #{req.requestNo}
                    </span>
                    <span className={`shrink-0 px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${statusStyle(req.status)}`}>
                      {statusLabel(req.status)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock size={11} /> {fmtDate(req.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-200 font-bold min-w-0">
                    <User size={12} className="text-[#F59E0B] shrink-0" />
                    <span className="truncate">{req.buyerName || '—'}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] min-w-0">
                    <Mail size={12} className="text-[#F59E0B] shrink-0" />
                    <span className="truncate">{req.buyerEmail || '—'}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-300 font-bold min-w-0">
                    {req.kind === 'plan' ? <Crown size={12} className="text-emerald-400 shrink-0" /> : <ShoppingCart size={12} className="text-emerald-400 shrink-0" />}
                    <span className="truncate">{req.kind === 'plan' ? (req.planLabel || 'Plan') : (req.botName || 'Bot')}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-black">
                    <Wallet size={12} className="shrink-0" />
                    ${req.amountUsd}
                    {req.coinName ? <span className="text-slate-400 font-bold">· {req.coinName}</span> : null}
                  </span>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => approve(req)}
                      disabled={busyId === req.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                      <Check size={14} /> {isAr ? 'تأكيد وإفراج التحميل' : 'Confirm & Release'}
                    </button>
                    <button
                      onClick={() => reject(req)}
                      disabled={busyId === req.id}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-wider hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <X size={14} /> {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
