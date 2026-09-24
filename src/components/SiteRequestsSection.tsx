import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Code2, Trash2, RefreshCw, Phone, User, MessageSquare } from 'lucide-react';
import { SiteRequest, fetchSiteRequests, markAllSiteRequestsRead, deleteSiteRequest } from '../services/paymentRequests';
import { Language } from '../lib/i18n';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

interface SiteRequestsSectionProps {
  lang: Language;
}

export default function SiteRequestsSection({ lang }: SiteRequestsSectionProps) {
  const isAr = lang === 'ar';
  const [items, setItems] = useState<SiteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    const list = await fetchSiteRequests();
    setItems(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    markAllSiteRequestsRead();
  }, []);

  const remove = async (id: string) => {
    setDeleting(id);
    await deleteSiteRequest(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleting(null);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <Code2 size={18} className="text-[#F59E0B]" />
            {lt(lang, 617)}
          </h3>
          <p className="text-xs font-bold text-slate-400 mt-0.5">
            {lt(lang, 140)}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all"
        >
          <RefreshCw size={13} /> {lt(lang, 453)}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm font-bold text-center py-8 border border-dashed border-white/15 rounded-2xl text-slate-400">
          {lt(lang, 375)}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-black text-white">
                    <User size={14} className="text-[#F59E0B]" /> {r.name || '-'}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                    <Phone size={11} /> {r.contact || '-'}
                  </span>
                  {!r.read && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                      {lt(lang, 349)}
                    </span>
                  )}
                </div>
                <p className="flex items-start gap-1.5 text-sm font-medium text-slate-200 mt-2 break-words">
                  <MessageSquare size={13} className="text-slate-400 mt-0.5 shrink-0" /> {r.message}
                </p>
                <p className="text-[10px] font-bold text-slate-500 mt-1.5">
                  {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString(loc(lang)) : ''}
                </p>
              </div>
              <button
                onClick={() => r.id && remove(r.id)}
                disabled={deleting === r.id}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
              >
                <Trash2 size={13} /> {lt(lang, 196)}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}