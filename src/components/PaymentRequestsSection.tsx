import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Check, X, Clock, Mail, Wallet, User, ShoppingCart, Crown, Hash, Globe, ShieldCheck } from 'lucide-react';
import {
  PaymentRequest,
  fetchPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
} from '../services/paymentRequests';

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

// Exact GMT timestamp of when the customer clicked "I have paid".
// This is the reference used to confirm the transaction is real: compare it
// with the time the deposit arrived in the developer wallet.
function fmtGmt(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} — ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
}

export default function PaymentRequestsSection({ lang, developerEmail }: PaymentRequestsSectionProps) {
  const isAr = lang === 'ar';
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchPaymentRequests();
    setRequests(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
      {/* Manual workflow — the only confirmation method */}
      <div className="bg-white/5 border border-emerald-500/25 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-emerald-400" />
          <h5 className="text-xs font-black uppercase text-emerald-400 tracking-widest">
            {isAr ? 'تأكيد يدوي — الإفراج من طرفك فقط' : 'Manual Confirmation — Release is yours only'}
          </h5>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
          {isAr
            ? 'عندما يضغط العميل على «أرسلت الدفع»، يصل طلب مرقّم هنا يعرض بريد العميل وصنف المنتج وقيمته والتوقيت الدقيق بتوقيت غرينتش. قارن هذا التوقيت مع تاريخ وصول التحويل إلى محفظتك، ثم قرّر: أكّد الطلب وأفرج التحميل، أو ارفضه إن كان مزوّراً ولم يصل شيء لمحفظتك.'
            : 'When a customer presses "I have paid", a numbered request arrives here showing the customer email, product type, price and the exact GMT time. Compare that timestamp with when the deposit reached your wallet, then decide: confirm the request and release the download, or reject it if it is fake and nothing arrived.'}
        </p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-bold">
          <Globe size={12} />
          {isAr
            ? 'توقيت غرينتش المذكور هو المرجع الوحيد لتأكيد أن المعاملة حقيقية — قارنه دائماً بتوقيت وصول الدفعة لمحفظتك.'
            : 'The GMT time shown is the single reference to confirm a transaction is real — always compare it with the deposit arrival time in your wallet.'}
        </div>
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1" title={new Date(req.createdAt).toLocaleString()}>
                      <Clock size={11} /> {new Date(req.createdAt).toLocaleString(isAr ? 'ar-DZ' : 'en-GB')}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-black font-mono ${
                      req.status === 'pending'
                        ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                        : 'text-slate-500 border-white/10 bg-white/5'
                    }`}>
                      <Globe size={11} />
                      {fmtGmt(req.createdAt)}
                    </span>
                  </div>
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
