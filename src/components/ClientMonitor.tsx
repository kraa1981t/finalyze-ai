import React, { useState, useEffect } from 'react';
import { Users, ShieldOff, Trash2, RefreshCw, RotateCcw, X, CheckCircle, Clock, Ban, Shield, Crown, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/i18n';
import { fetchAllPlanGrants, PaymentGrant } from '../services/paymentRequests';

interface ClientRecord {
  id: string;
  email: string;
  uid: string;
  status: 'verified' | 'pending' | 'banned';
  plan: 'free' | 'paid';
  planExpiry: string | null;
  registeredAt: any;
  rank: number;
}

interface ClientMonitorProps {
  clients: ClientRecord[];
  lang: Language;
  onRefresh: () => void;
  onMergeDuplicates?: () => Promise<{ merged: number; removed: number }>;
  onBan: (clientId: string) => void;
  onDelete: (clientId: string) => void;
  onDeleteByEmail?: (email: string) => void;
  freemiumDisabled?: boolean;
  onFreemiumToggle?: (v: boolean) => void;
  clientLoginRequired?: boolean;
  onClientLoginToggle?: (v: boolean) => void;
}

export default function ClientMonitor({ clients, lang, onRefresh, onMergeDuplicates, onBan, onDelete, onDeleteByEmail, freemiumDisabled: externalFreemium, onFreemiumToggle, clientLoginRequired: externalClientLogin, onClientLoginToggle }: ClientMonitorProps) {
  const isAr = lang === 'ar';
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);
  const [freemiumDisabled, setFreemiumDisabled] = useState(externalFreemium ?? localStorage.getItem('finalyze_freemium_disabled') === 'true');
  const [clientLoginRequired, setClientLoginRequired] = useState(externalClientLogin ?? localStorage.getItem('finalyze_client_login_required') === 'true');
  const [grants, setGrants] = useState<PaymentGrant[]>([]);

  useEffect(() => {
    let alive = true;
    fetchAllPlanGrants().then((g) => { if (alive) setGrants(g); }).catch(() => {});
    return () => { alive = false; };
  }, [clients]);

  const daysLeft = (expiry: string | null): number => {
    if (!expiry) return 0;
    return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  // Every plan date is stored in UTC and shown in GMT, so the developer and the
  // client always read the same instant regardless of their machine's timezone.
  const gmt = (iso: string | null) =>
    iso && isFinite(new Date(iso).getTime())
      ? new Date(iso).toLocaleString('en-GB', { timeZone: 'GMT', hour12: false })
      : '';

  // Re-render once a minute so every countdown in the table stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // The crown comes from payment_grants — only the developer can create one,
  // and the plan end is derived from the start instant + duration, so it cannot
  // be faked. Every approved period is kept, so the visible end is the LATEST
  // one (renewals stack) while the first release is the EARLIEST start, which is
  // the date the client first paid for. `clients.planExpiry` stays as a fallback
  // purely for rows written before grants existed; the rules stop a client from
  // raising their own row, so that fallback can no longer be inflated either.
  const planState = (client: ClientRecord): { paid: boolean; expiry: string | null; firstRelease: string | null } => {
    const email = (client.email || '').toLowerCase();
    let expiry: string | null = client.planExpiry || null;
    let firstRelease: string | null = null;
    let hasGrant = false;
    for (const g of grants) {
      if ((g.email || '').toLowerCase() !== email) continue;
      // The release instant the developer stamped on approval: for a renewal it
      // is the moment the previous period ended, so the earliest one is the
      // client's true first release.
      const start = g.activatedAt || null;
      if (start && (!firstRelease || new Date(start).getTime() < new Date(firstRelease).getTime())) firstRelease = start;
      if (!g.expiryDate) continue;
      hasGrant = true;
      if (!expiry || new Date(g.expiryDate).getTime() > new Date(expiry).getTime()) expiry = g.expiryDate;
    }
    const running = (!!expiry && daysLeft(expiry) > 0) && (hasGrant || client.plan === 'paid');
    return { paid: running, expiry, firstRelease };
  };

  // A client counts as "running a paid plan" only when a real, unexpired
  // entitlement exists. An expired plan, or an email that registered manually
  // without buying anything, never gets the crown.
  const hasRunningPlan = (client: ClientRecord): boolean => planState(client).paid;

  // Repairs rows written with a random id before the email-keyed ids: the same
  // customer used to appear twice in this table. Confirmation first — it deletes
  // the redundant copies after their data has been copied onto the real one.
  const runMerge = async () => {
    if (!onMergeDuplicates || merging) return;
    const ok = window.confirm(
      isAr
        ? 'سيتم دمج السجلات المكررة لنفس الإيميل ثم حذف النسخ الزائدة. متابعة؟'
        : 'Duplicate rows for the same email will be merged into one, then the extras deleted. Continue?'
    );
    if (!ok) return;
    setMerging(true);
    setMergeMsg(null);
    try {
      const r = await onMergeDuplicates();
      setMergeMsg(
        isAr
          ? `تم الدمج: ${r.merged} إيميل — وحُذف ${r.removed} سجل مكرر`
          : `Merged ${r.merged} email(s), removed ${r.removed} duplicate row(s)`
      );
    } catch {
      setMergeMsg(isAr ? 'تعذّر الدمج' : 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-primary" />
          <h2 className="text-xl font-black text-brand-text">
            {isAr ? 'مراقبة العملاء' : 'Client Monitor'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {onMergeDuplicates && (
            <button
              onClick={runMerge}
              disabled={merging}
              title={isAr ? 'دمج السجلات المكررة لنفس الإيميل' : 'Merge duplicate rows for the same email'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <Layers size={14} className={merging ? 'animate-spin' : ''} />
              {merging ? (isAr ? 'جارٍ الدمج…' : 'Merging…') : (isAr ? 'دمج التكرار' : 'Merge')}
            </button>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-black uppercase tracking-widest transition-all"
          >
            <RefreshCw size={14} />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {mergeMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-bold">
          <CheckCircle size={15} />
          {mergeMsg}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: isAr ? 'إجمالي' : 'Total', value: clients.length, color: 'text-white' },
          { label: isAr ? 'مفعل' : 'Verified', value: clients.filter(c => c.status === 'verified').length, color: 'text-emerald-400' },
          { label: isAr ? 'قيد الانتظار' : 'Pending', value: clients.filter(c => c.status === 'pending').length, color: 'text-amber-400' },
          { label: isAr ? 'محظور' : 'Banned', value: clients.filter(c => c.status === 'banned').length, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-brand-alt rounded-2xl p-4 border border-white/10 text-center">
            <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-white/80 font-bold tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Freemium System Toggle */}
      <div className="bg-brand-alt rounded-2xl p-4 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {freemiumDisabled ? <Shield size={20} className="text-emerald-400" /> : <ShieldOff size={20} className="text-amber-400" />}
          <div>
            <span className="text-sm font-bold text-white">
              {isAr ? 'نظام الخطط المجانية' : 'Freemium System'}
            </span>
            <p className="text-xs text-white/60 mt-0.5">
              {freemiumDisabled
                ? (isAr ? 'الكل وصول كامل - الخطط مخفية عن العملاء' : 'All full access - plans hidden from clients')
                : (isAr ? 'القيود مفعلة - الخطط مرئية للعملاء' : 'Restrictions active - plans visible to clients')}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const newVal = !freemiumDisabled;
            setFreemiumDisabled(newVal);
            localStorage.setItem('finalyze_freemium_disabled', newVal ? 'true' : 'false');
            localStorage.setItem('finalyze_hide_plans', newVal ? 'true' : 'false');
            onFreemiumToggle?.(newVal);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            freemiumDisabled
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          }`}
        >
          {freemiumDisabled ? (isAr ? 'ON: وصول كامل' : 'ON: Full Access') : (isAr ? 'OFF: مقفلة' : 'OFF: Locked')}
        </button>
      </div>

      {/* Client Login Required Toggle */}
      <div className="bg-brand-alt rounded-2xl p-4 border border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {clientLoginRequired ? <Users size={20} className="text-amber-400" /> : <Users size={20} className="text-emerald-400" />}
          <div>
            <span className="text-sm font-bold text-white">
              {isAr ? 'تسجيل دخول العملاء' : 'Client Login Required'}
            </span>
            <p className="text-xs text-white/60 mt-0.5">
              {clientLoginRequired
                ? (isAr ? 'العملاء يجب عليهم تسجيل الدخول عبر Google' : 'Clients must sign in with Google')
                : (isAr ? 'العملاء يدخلون مباشرة بدون تسجيل دخول' : 'Clients enter directly without login')}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            const newVal = !clientLoginRequired;
            setClientLoginRequired(newVal);
            localStorage.setItem('finalyze_client_login_required', newVal ? 'true' : 'false');
            onClientLoginToggle?.(newVal);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            clientLoginRequired
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          }`}
        >
          {clientLoginRequired ? (isAr ? 'ON: مطلوب تسجيل' : 'ON: Login Required') : (isAr ? 'OFF: بدون تسجيل' : 'OFF: No Login')}
        </button>
      </div>

      {/* Client Table */}
      {clients.length === 0 ? (
        <div className="bg-brand-alt rounded-2xl p-10 border border-white/10 text-center">
          <Users size={48} className="text-white/20 mx-auto mb-4" />
          <p className="text-base text-white/60 font-bold">
            {isAr ? 'لا يوجد عملاء مسجلين بعد' : 'No clients registered yet'}
          </p>
        </div>
      ) : (
        <div className="bg-brand-alt rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'الرتبة' : 'Rank'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'تاريخ التسجيل' : 'Registered'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'الخطة' : 'Plan'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'المتبقي' : 'Left'}</th>
                  <th className="text-left px-4 py-3 text-xs text-white/60 font-bold uppercase tracking-wider">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">#{client.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-300 font-bold text-shadow-glow">{client.email}</span>
                        {/* Crown: ONLY for a client whose paid plan is running right
                            now (paid + a future expiry). Disappears when the plan
                            expires or is deleted, and never shows for an email that
                            only signed up manually without buying a plan. */}
                        {hasRunningPlan(client) && (
                          <span
                            title={isAr ? 'خطة مدفوعة سارية الآن' : 'Paid plan currently active'}
                            className="inline-flex items-center justify-center shrink-0"
                          >
                            <Crown size={15} className="text-amber-400" fill="currentColor" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white/60 font-bold">
                        {client.registeredAt
                          ? (typeof client.registeredAt === 'object' && client.registeredAt?.toDate
                            ? client.registeredAt.toDate().toLocaleDateString()
                            : new Date(client.registeredAt).toLocaleDateString())
                          : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {client.status === 'verified' ? (
                          <CheckCircle size={14} className="text-emerald-400" />
                        ) : client.status === 'banned' ? (
                          <Ban size={14} className="text-red-400" />
                        ) : (
                          <Clock size={14} className="text-amber-400" />
                        )}
                        <span className={`text-xs font-bold ${
                          client.status === 'verified' ? 'text-emerald-400' :
                          client.status === 'banned' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {client.status === 'verified' ? (isAr ? 'مفعل' : 'Verified') :
                           client.status === 'banned' ? (isAr ? 'محظور' : 'Banned') :
                           (isAr ? 'قيد الانتظار' : 'Pending')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit ${
                        planState(client).paid
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-white/70'
                      }`}>
                        {planState(client).paid && <Crown size={12} />}
                        {planState(client).paid ? (isAr ? 'مدفوعة' : 'Paid') : (isAr ? 'مجانية' : 'Free')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const st = planState(client);
                        if (!st.expiry) return <span className="text-sm text-white/50">--</span>;
                        const end = new Date(st.expiry).getTime();
                        const left = end - now;
                        const past = left <= 0;
                        const abs = Math.abs(left);
                        const d = Math.floor(abs / 86400000);
                        const h = Math.floor((abs % 86400000) / 3600000);
                        const m = Math.floor((abs % 3600000) / 60000);
                        return (
                          <div className="space-y-1">
                            <div className={`text-xs font-black ${past ? 'text-red-400' : 'text-emerald-400'}`} dir="ltr">
                              {past
                                ? (isAr ? 'انتهت' : 'Ended')
                                : `${d}${isAr ? 'ي' : 'd'} ${String(h).padStart(2, '0')}${isAr ? 'س' : 'h'} ${String(m).padStart(2, '0')}${isAr ? 'د' : 'm'}`}
                            </div>
                            <div className="text-[10px] text-white/45 leading-tight" dir="ltr">
                              {gmt(st.expiry)}
                            </div>
                            {st.firstRelease && (
                              <div className="text-[10px] text-sky-300/70 leading-tight" dir="ltr">
                                {isAr ? 'أول إفراج: ' : 'First: '}{gmt(st.firstRelease)}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { if (confirm(isAr ? 'حظر هذا العميل؟' : 'Ban this client?')) onBan(client.id); }}
                          className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                          title={isAr ? 'حظر' : 'Ban'}
                        >
                          <ShieldOff size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm(isAr ? 'حذف هذا العميل؟' : 'Delete this client?')) { if (onDeleteByEmail) onDeleteByEmail(client.email); else onDelete(client.id); } }}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          title={isAr ? 'حذف' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
