import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, RefreshCw, Loader2, Globe2, AlertTriangle, CalendarDays } from 'lucide-react';
import { Language } from '../lib/i18n';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

interface BriefPayload {
  date: string;
  prices: Record<string, number>;
  news: string[];
  brief: {
    summaryAr?: string;
    summaryEn?: string;
    goldAr?: string;
    goldEn?: string;
    btcAr?: string;
    btcEn?: string;
    dzdAr?: string;
    dzdEn?: string;
  } | null;
  hasSystemKey?: boolean;
  generatedAt?: number;
}

const CACHE_KEY = 'market_brief_cache';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function Pressable({ label, onClick, busy, disabled }: { label: string; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-black px-3.5 py-2 rounded-full hover:bg-[#d97706] transition-all disabled:opacity-50"
    >
      <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
      {label}
    </button>
  );
}

function Cell({ title, body, accent = false }: { title: string; body: string | undefined; accent?: boolean }) {
  if (!body || !body.trim()) return null;
  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-black ${accent ? 'text-[#F59E0B]' : 'text-emerald-400'}`}>{title}</h4>
      <p className="text-[15px] text-white/75 leading-relaxed">{body}</p>
    </div>
  );
}

export default function MarketBriefing({ lang }: { lang: Language }) {
  const isAr = lang === 'ar';
  const [data, setData] = useState<BriefPayload | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d && d.date === todayStr()) return d as BriefPayload;
      return null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 30000);
      const r = await fetch(`/api/briefing${force ? '?force=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: BriefPayload = await r.json();
      if (d.date === todayStr()) {
        setData(d);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch {}
      }
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing(false);
  }, [fetchBriefing]);

  const forceRegen = async () => {
    setGenerating(true);
    await fetchBriefing(true);
    setGenerating(false);
  };

  const brief = data?.brief;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="bg-brand-alt rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4"
      style={{ direction: isAr ? 'rtl' : 'ltr' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-xl flex items-center justify-center border border-white/10 text-white shadow-md">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {lt(lang, 192)}
            </h2>
            <p className="text-xs font-bold text-white/40 flex items-center gap-1">
              <CalendarDays size={11} className="text-[#F59E0B]" />
              {data?.generatedAt
                ? new Date(data.generatedAt).toLocaleDateString(loc(lang), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : new Date().toLocaleDateString(loc(lang), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.brief ? (
            <Pressable label={lt(lang, 456)} onClick={forceRegen} busy={generating} disabled={loading} />
          ) : null}
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-sm font-black text-white/50">
              <Loader2 size={14} className="animate-spin text-[#F59E0B]" />
              {lt(lang, 82)}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {lt(lang, 250)}
          </span>
        </div>
      )}

      {!loading && !error && !data?.brief && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-4 py-4 text-base text-white/70 leading-relaxed">
          <p className="font-black text-[#F59E0B] mb-1">{lt(lang, 112)}</p>
          <p>
            {lt(lang, 551)}
          </p>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-white/5 animate-pulse" />
        </div>
      )}

      {brief && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4 border-l-0 lg:border-l-2 border-[#8B5CF6]/40 lg:pl-4" style={{ direction: 'rtl', textAlign: 'right' }}>
            <div className="flex items-center gap-2">
              <Globe2 size={16} className="text-[#8B5CF6]" />
              <h3 className="text-base font-black text-white">{lt(lang, 87)}</h3>
            </div>
            <Cell title={lt(lang, 319)} body={brief.summaryAr} accent />
            <Cell title="الذهب اليوم" body={brief.goldAr} />
            <Cell title="البيتكوين والعملات الرقمية" body={brief.btcAr} />
            <Cell title="الدينار الجزائري والصرف" body={brief.dzdAr} />
          </div>
          <div className="space-y-4 border-l-0 lg:border-l-2 border-emerald-400/40 lg:pl-4" style={{ direction: 'ltr', textAlign: 'left' }}>
            <div className="flex items-center gap-2">
              <Globe2 size={16} className="text-emerald-400" />
              <h3 className="text-base font-black text-white">{lt(lang, 232)}</h3>
            </div>
            <Cell title="Market Overview" body={brief.summaryEn} accent />
            <Cell title="Gold Today" body={brief.goldEn} />
            <Cell title="Bitcoin & Crypto" body={brief.btcEn} />
            <Cell title="Algerian Dinar & FX" body={brief.dzdEn} />
          </div>
        </div>
      )}

      {data?.news && data.news.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-2">
            {lt(lang, 289)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.news.slice(0, 5).map((n, i) => (
              <span key={i} className="text-xs font-bold text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1 min-w-0">
                {n.length > 70 ? n.slice(0, 70) + '…' : n}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}