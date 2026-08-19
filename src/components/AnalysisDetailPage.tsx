import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ShieldCheck, ShieldAlert, ShieldX, CheckCircle, XCircle, AlertTriangle, BarChart3, Target, Zap, CandlestickChart } from 'lucide-react';
import { AnalysisResult, SignalType } from '../types';
import { Language } from '../lib/i18n';
import LotSizeCalculator from './LotSizeCalculator';

interface AnalysisDetailPageProps {
  result: AnalysisResult;
  onBack: () => void;
  lang: Language;
}

const PRIMARY_CHECKS = ['BB Pullback', 'Micro BB', 'Supply/Demand', 'Trend Age', 'Pre-Pullback Age', 'News', 'Economic Events'];
const BLOCK_CHECKS = ['Candle Match', 'Sideways Filter', 'Confidence Penalty', 'Trend Penalty', 'Penalty'];

function getSignalColor(signal: SignalType) {
  switch (signal) {
    case SignalType.STRONG_BUY: return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500', glow: 'shadow-emerald-500/30' };
    case SignalType.BUY: return { bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-600', glow: 'shadow-emerald-500/20' };
    case SignalType.STRONG_SELL: return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500', glow: 'shadow-red-500/30' };
    case SignalType.SELL: return { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-600', glow: 'shadow-red-500/20' };
    default: return { bg: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500', glow: 'shadow-gray-500/20' };
  }
}

function getSignalLabel(signal: SignalType, lang: Language) {
  const isAr = lang === 'ar';
  switch (signal) {
    case SignalType.STRONG_BUY: return isAr ? 'شراء قوي' : 'STRONG BUY';
    case SignalType.BUY: return isAr ? 'شراء' : 'BUY';
    case SignalType.STRONG_SELL: return isAr ? 'بيع قوي' : 'STRONG SELL';
    case SignalType.SELL: return isAr ? 'بيع' : 'SELL';
    case SignalType.NEUTRAL: return isAr ? 'محايد' : 'NEUTRAL';
    default: return isAr ? 'لا إشارة' : 'NO ENTRY';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'positive': return <CheckCircle size={18} className="text-emerald-400" />;
    case 'negative': return <XCircle size={18} className="text-red-400" />;
    default: return <AlertTriangle size={18} className="text-yellow-400" />;
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'positive': return 'border-emerald-500/30 bg-emerald-500/5';
    case 'negative': return 'border-red-500/30 bg-red-500/5';
    default: return 'border-yellow-500/30 bg-yellow-500/5';
  }
}

export default function AnalysisDetailPage({ result, onBack, lang }: AnalysisDetailPageProps) {
  const isAr = lang === 'ar';
  const chartRef = useRef<HTMLDivElement>(null);
  const colors = getSignalColor(result.signal);
  const allReasons = result.detailedReasons || [];

  const primaryReasons = allReasons.filter(r => PRIMARY_CHECKS.some(p => r.check?.includes(p)));
  const blockReasons = allReasons.filter(r => BLOCK_CHECKS.some(p => r.check?.includes(p)));
  const supportingReasons = allReasons.filter(r =>
    !PRIMARY_CHECKS.some(p => r.check?.includes(p)) &&
    !BLOCK_CHECKS.some(p => r.check?.includes(p))
  );

  const candleMatchReason = allReasons.find(r => r.check?.includes('Candle Match'));
  const isJPY = result.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;

  useEffect(() => {
    if (chartRef.current && result.symbol) {
      chartRef.current.innerHTML = '';
      const widget = document.createElement('div');
      widget.className = 'tradingview-widget-container';
      widget.style.height = '350px';
      widget.style.borderRadius = '16px';
      widget.style.overflow = 'hidden';
      widget.innerHTML = `
        <div class="tradingview-widget-container__widget" style="height:100%;width:100%;"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/external-embed/embed-widget-advanced-chart.js" async>
        {
          "autosize": true,
          "symbol": "${result.symbol}",
          "interval": "D",
          "timezone": "Etc/UTC",
          "theme": "dark",
          "style": "1",
          "locale": "en",
          "backgroundColor": "rgba(10, 15, 26, 1)",
          "gridColor": "rgba(255, 255, 255, 0.03)",
          "allow_symbol_change": true,
          "hide_volume": false,
          "studies": ["STD;EMA", "STD;RSI"],
          "show_popup_button": true,
          "popup_width": "1200",
          "popup_height": "700"
        }
        </script>`;
      chartRef.current.appendChild(widget);
    }
  }, [result.symbol]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0a0f1a]"
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0f1a]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] transition-all">
            <ArrowLeft size={20} className="text-black" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white">{result.symbol}</span>
              <span className={`px-3 py-1 rounded-lg text-xs font-black text-white ${colors.bg} shadow-lg ${colors.glow}`}>
                {getSignalLabel(result.signal, lang)}
              </span>
              <span className={`text-2xl font-black ${colors.text}`}>{result.confidence}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-5 mt-4 pb-20">

        {/* 1. Chart */}
        <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#111827]">
          <div ref={chartRef} className="w-full" style={{ height: '350px' }} />
        </div>

        {/* 2. Signal Scores */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
            <BarChart3 size={20} className="text-blue-400 mx-auto mb-1" />
            <div className="text-[10px] text-white/40 uppercase tracking-wider">{isAr ? 'تقني' : 'Technical'}</div>
            <div className="text-xl font-black text-blue-400">{result.technicalScore}%</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
            <Zap size={20} className="text-purple-400 mx-auto mb-1" />
            <div className="text-[10px] text-white/40 uppercase tracking-wider">{isAr ? 'مشاعر' : 'Sentiment'}</div>
            <div className="text-xl font-black text-purple-400">{result.sentimentScore}%</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 text-center">
            <Target size={20} className="text-emerald-400 mx-auto mb-1" />
            <div className="text-[10px] text-white/40 uppercase tracking-wider">{isAr ? 'ثقة' : 'Confidence'}</div>
            <div className={`text-xl font-black ${colors.text}`}>{result.confidence}%</div>
          </div>
        </div>

        {/* 3. Lot Size Calculator */}
        {result.signal !== 'neutral' && result.signal !== 'no_entry' && (
          <div className="rounded-2xl border border-white/5 bg-[#111827] overflow-hidden">
            <LotSizeCalculator
              symbol={result.symbol}
              stopLoss={result.stopLoss || 0}
              takeProfit={result.takeProfit || 0}
              entryPrice={result.entryPrice}
              signal={result.signal as any}
              lang={lang}
            />
          </div>
        )}

        {/* 4. Trend Info - Age + Direction */}
        <div className="grid grid-cols-2 gap-3">
          {result.trendMaturity && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{isAr ? 'عمر الاتجاه' : 'Trend Age'}</div>
              <div className="text-sm font-black text-white capitalize">{result.trendMaturity} {result.trendAge ? `(${result.trendAge}c)` : ''}</div>
            </div>
          )}
          {result.microSignal && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{isAr ? 'عمر ما بعد السحب' : 'Pre-Pullback Age'}</div>
              <div className="text-sm font-black text-white capitalize">{result.microSignal} {result.microTF ? `(${result.microTF})` : ''}</div>
            </div>
          )}
          {result.adx !== undefined && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">ADX</div>
              <div className="text-sm font-black text-white">{result.adx?.toFixed(1)} {result.adxDirection || ''}</div>
            </div>
          )}
          {result.direction && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{isAr ? 'الاتجاه' : 'Direction'}</div>
              <div className="flex items-center gap-2">
                {result.direction === 'buy' ? <TrendingUp size={16} className="text-emerald-400" /> :
                 result.direction === 'sell' ? <TrendingDown size={16} className="text-red-400" /> :
                 <Minus size={16} className="text-gray-400" />}
                <span className="text-sm font-black text-white uppercase">{result.direction}</span>
              </div>
            </div>
          )}
        </div>

        {/* 5. Candle Match Results */}
        {candleMatchReason && (
          <div className={`rounded-2xl p-4 border ${candleMatchReason.status === 'positive' ? 'border-emerald-500/30 bg-emerald-500/5' : candleMatchReason.status === 'negative' ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
            <div className="flex items-center gap-2 mb-3">
              <CandlestickChart size={18} className={candleMatchReason.status === 'positive' ? 'text-emerald-400' : candleMatchReason.status === 'negative' ? 'text-red-400' : 'text-yellow-400'} />
              <span className="text-sm font-black text-white uppercase tracking-wider">{isAr ? 'تطابق الشموع' : 'Candle Match'}</span>
              {candleMatchReason.status === 'positive' ? (
                <span className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-400">{isAr ? 'متطابقة' : 'MATCHED'}</span>
              ) : (
                <span className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-black bg-red-500/10 text-red-400">{isAr ? 'غير متطابقة' : 'NOT MATCHED'}</span>
              )}
            </div>
            {/* Parse candle info */}
            {(() => {
              const parts = candleMatchReason.value.split(',').map((p: string) => p.trim());
              return (
                <div className="space-y-2">
                  {parts.map((part: string, i: number) => {
                    const match = part.match(/^(\S+):\s*([\d.]+)\s*\((.)\s*(.)?\)/);
                    if (!match) return <div key={i} className="text-xs text-white/60 font-mono">{part}</div>;
                    const [, tf, body, dirChar, checkChar] = match;
                    const isBullish = dirChar === '↑';
                    const isMatch = checkChar === '✓';
                    return (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white/60 uppercase">{tf}</span>
                          <span className={`text-sm font-black ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isBullish ? '▲' : '▼'} {isBullish ? (isAr ? 'صاعد' : 'Bullish') : (isAr ? 'هابط' : 'Bearish')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black font-mono text-white">{body}</span>
                          <span className="text-[10px] text-white/30">{isAr ? 'نقطة' : 'pts'}</span>
                          {checkChar && (
                            <span className={`text-xs font-black ${isMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isMatch ? '✓' : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <p className="text-xs text-white/40 mt-2 leading-relaxed">{candleMatchReason.impact}</p>
          </div>
        )}

        {/* 6. Block Filters */}
        {blockReasons.length > 0 && (
          <Section
            title={isAr ? 'فلاتر المنع' : 'BLOCK FILTERS'}
            icon={<ShieldX size={18} className="text-red-400" />}
            color="red"
            reasons={blockReasons}
            lang={lang}
          />
        )}

        {/* 7. Primary Conditions */}
        {primaryReasons.length > 0 && (
          <Section
            title={isAr ? 'الشروط الأساسية' : 'PRIMARY CONDITIONS'}
            icon={<ShieldCheck size={18} className="text-[#F59E0B]" />}
            color="amber"
            reasons={primaryReasons}
            lang={lang}
          />
        )}

        {/* 8. Supporting Conditions */}
        {supportingReasons.length > 0 && (
          <Section
            title={isAr ? 'الشروط الداعمة' : 'SUPPORTING CONDITIONS'}
            icon={<ShieldAlert size={18} className="text-blue-400" />}
            color="blue"
            reasons={supportingReasons}
            lang={lang}
          />
        )}

        {/* Summary */}
        {result.summary && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">{isAr ? 'ملخص' : 'Summary'}</div>
            <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Section({ title, icon, color, reasons, lang }: {
  title: string;
  icon: React.ReactNode;
  color: 'amber' | 'blue' | 'red';
  reasons: { check: string; value: string; status: string; impact: string }[];
  lang: Language;
}) {
  const colorMap = {
    amber: { header: 'border-[#F59E0B]/30', badge: 'bg-[#F59E0B]/10 text-[#F59E0B]' },
    blue: { header: 'border-blue-500/30', badge: 'bg-blue-500/10 text-blue-400' },
    red: { header: 'border-red-500/30', badge: 'bg-red-500/10 text-red-400' },
  };
  const c = colorMap[color];

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 pb-2 border-b ${c.header}`}>
        {icon}
        <span className="text-sm font-black text-white uppercase tracking-wider">{title}</span>
        <span className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-black ${c.badge}`}>
          {reasons.length}
        </span>
      </div>
      <div className="space-y-2">
        {reasons.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-xl p-4 border ${getStatusStyle(r.status)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getStatusIcon(r.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-black text-white">{r.check}</span>
                  <span className="text-xs text-white/30 font-mono">|</span>
                  <span className="text-xs text-white/50 font-mono">{r.value}</span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">{r.impact}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
