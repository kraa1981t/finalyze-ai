import React, { useState } from 'react';
import { Users, ShieldOff, Trash2, RefreshCw, RotateCcw, X, CheckCircle, AlertTriangle, Clock, Ban } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/i18n';

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
  onBan: (clientId: string) => void;
  onDelete: (clientId: string) => void;
  onRenew: (clientId: string, days: number) => void;
}

export default function ClientMonitor({ clients, lang, onRefresh, onBan, onDelete, onRenew }: ClientMonitorProps) {
  const isAr = lang === 'ar';
  const [renewing, setRenewing] = useState<string | null>(null);
  const [renewDays, setRenewDays] = useState(30);

  const daysLeft = (expiry: string | null): number => {
    if (!expiry) return 0;
    return Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-black uppercase tracking-widest transition-all"
        >
          <RefreshCw size={14} />
          {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: isAr ? 'إجمالي' : 'Total', value: clients.length, color: 'text-blue-400' },
          { label: isAr ? 'مفعل' : 'Verified', value: clients.filter(c => c.status === 'verified').length, color: 'text-emerald-400' },
          { label: isAr ? 'قيد الانتظار' : 'Pending', value: clients.filter(c => c.status === 'pending').length, color: 'text-amber-400' },
          { label: isAr ? 'محظور' : 'Banned', value: clients.filter(c => c.status === 'banned').length, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-brand-alt rounded-2xl p-4 border border-white/5 text-center">
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Client Table */}
      {clients.length === 0 ? (
        <div className="bg-brand-alt rounded-2xl p-8 border border-white/5 text-center">
          <Users size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-bold">
            {isAr ? 'لا يوجد عملاء مسجلين بعد' : 'No clients registered yet'}
          </p>
        </div>
      ) : (
        <div className="bg-brand-alt rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'الرتبة' : 'Rank'}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'الخطة' : 'Plan'}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'المتبقي' : 'Left'}</th>
                  <th className="text-left px-4 py-3 text-[10px] text-slate-500 font-black uppercase tracking-widest">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-black text-brand-text">#{client.rank}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-brand-text">{client.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {client.status === 'verified' ? (
                          <CheckCircle size={12} className="text-emerald-400" />
                        ) : client.status === 'banned' ? (
                          <Ban size={12} className="text-red-400" />
                        ) : (
                          <Clock size={12} className="text-amber-400" />
                        )}
                        <span className={`text-[11px] font-bold ${
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
                      <span className={`text-[11px] font-black px-2 py-1 rounded-full ${
                        client.plan === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}>
                        {client.plan === 'paid' ? (isAr ? 'مدفوعة' : 'Paid') : (isAr ? 'مجانية' : 'Free')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {client.planExpiry ? (
                        <span className={`text-xs font-bold ${daysLeft(client.planExpiry) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {daysLeft(client.planExpiry)} {isAr ? 'يوم' : 'days'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {renewing === client.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={renewDays}
                              onChange={(e) => setRenewDays(Number(e.target.value))}
                              className="w-16 bg-brand-bg border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center"
                            />
                            <button
                              onClick={() => { onRenew(client.id, renewDays); setRenewing(null); }}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => setRenewing(null)}
                              className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            {client.plan === 'free' && (
                              <button
                                onClick={() => setRenewing(client.id)}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                title={isAr ? 'تفعيل الخطة' : 'Activate plan'}
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm(isAr ? 'حظر هذا العميل؟' : 'Ban this client?')) onBan(client.id); }}
                              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                              title={isAr ? 'حظر' : 'Ban'}
                            >
                              <ShieldOff size={14} />
                            </button>
                            <button
                              onClick={() => { if (confirm(isAr ? 'حذف هذا العميل؟' : 'Delete this client?')) onDelete(client.id); }}
                              className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                              title={isAr ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
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