import React, { useState, useMemo } from 'react';
import { Minus, Plus, TrendingUp, TrendingDown, Shield, Zap } from 'lucide-react';

interface LotSizeCalculatorProps {
  symbol: string;
  stopLoss: number;
  takeProfit: number;
  entryPrice?: number;
  signal: 'strong_buy' | 'buy' | 'sell' | 'strong_sell' | 'neutral' | 'no_entry';
  lang: 'ar' | 'en';
}

function detectInstrumentType(symbol: string): 'forex_jpy' | 'forex' | 'crypto' | 'stock' {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Crypto names (BTC, ETH, SOL, etc.) - NOT forex pairs like BTCUSD
  const cryptoNames = ['BTC', 'ETH', 'DOGE', 'SOL', 'XRP', 'ADA', 'DOT', 'SHIB', 'AVAX', 'MATIC', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'FIL', 'APT', 'ARB', 'OP', 'SUI', 'SEI', 'PEPE', 'WIF', 'BONK', 'TON', 'TRX', 'RENDER', 'FET', 'INJ'];
  // Pure crypto if symbol contains a crypto name (not as part of a forex pair)
  for (const c of cryptoNames) {
    if (s.startsWith(c) && s.endsWith('USD')) return 'crypto';
  }
  // If it's just a crypto ticker with no forex context
  if (cryptoNames.some(c => s === c || s === c + 'USD' || s === c + 'USDT')) return 'crypto';

  // All forex currency codes
  const currencies = ['EUR', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF', 'USD', 'JPY', 'TRY', 'ZAR', 'MXN', 'SEK', 'NOK', 'DKK', 'SGD', 'HKD', 'CNY', 'INR', 'THB', 'PLN', 'HUF', 'CZK', 'ILS', 'PHP', 'IDR', 'MYR', 'KRW', 'TWD'];

  // Count how many currency codes appear in the symbol
  const found = currencies.filter(c => s.includes(c));
  // If 2+ currency codes -> it's forex
  if (found.length >= 2) {
    if (s.includes('JPY')) return 'forex_jpy';
    return 'forex';
  }

  // Default to stock (AAPL, TSLA, MSFT, etc.)
  return 'stock';
}

function getInstrumentConfig(type: ReturnType<typeof detectInstrumentType>) {
  switch (type) {
    case 'forex': return { decimals: 5, pipSize: 0.0001, pipLabel: 'pip', contractSize: 100000 };
    case 'forex_jpy': return { decimals: 3, pipSize: 0.01, pipLabel: 'pip', contractSize: 100000 };
    case 'crypto': return { decimals: 2, pipSize: 0.01, pipLabel: 'point', contractSize: 100 };
    case 'stock': return { decimals: 2, pipSize: 0.01, pipLabel: 'point', contractSize: 100 };
  }
}

export default function LotSizeCalculator({ symbol, stopLoss, takeProfit, entryPrice, signal, lang }: LotSizeCalculatorProps) {
  const isAr = lang === 'ar';
  const isBuy = signal === 'strong_buy' || signal === 'buy';
  const isStrongSignal = signal === 'strong_buy' || signal === 'strong_sell';

  // Signal type display with colors
  const signalDisplay = useMemo(() => {
    switch (signal) {
      case 'strong_buy': return { text: isAr ? 'شراء قوي' : 'Strong Buy', color: 'text-emerald-400' };
      case 'buy': return { text: isAr ? 'شراء' : 'Buy', color: 'text-emerald-400' };
      case 'strong_sell': return { text: isAr ? 'بيع قوي' : 'Strong Sell', color: 'text-red-400' };
      case 'sell': return { text: isAr ? 'بيع' : 'Sell', color: 'text-red-400' };
      case 'neutral': return { text: isAr ? 'محايد' : 'Neutral', color: 'text-slate-300' };
      default: return { text: '', color: 'text-white/60' };
    }
  }, [signal, isAr]);

  const instType = detectInstrumentType(symbol);
  const instConfig = getInstrumentConfig(instType);
  const { decimals, pipSize, contractSize } = instConfig;

  const entry = entryPrice || (stopLoss + takeProfit) / 2;

  const [lotSize, setLotSize] = useState(0.01);
  const [accountBalance, setAccountBalance] = useState(1000);
  const [balanceInput, setBalanceInput] = useState('1000');
  const [rrRatio, setRrRatio] = useState(2);

  const formatNum = (n: number, dec: number = 2): string => n.toFixed(dec);

  const handleBalanceChange = (val: string) => {
    setBalanceInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) setAccountBalance(num);
  };

  const handleBalanceBlur = () => {
    const num = parseFloat(balanceInput);
    if (isNaN(num) || num <= 0) {
      setAccountBalance(1000);
      setBalanceInput('1000');
    }
  };

  const adjustLot = (dir: number) => {
    const step = lotSize >= 1 ? 0.1 : lotSize >= 0.1 ? 0.05 : 0.01;
    setLotSize(prev => Math.max(0.01, Math.min(100, +(prev + dir * step).toFixed(2))));
  };

  const adjustBalance = (dir: number) => {
    const steps = [100, 500, 1000, 5000, 10000];
    const currentStep = steps.find(s => s > accountBalance / 2) || 1000;
    const next = Math.max(100, accountBalance + dir * currentStep);
    setAccountBalance(next);
    setBalanceInput(String(next));
  };

  const calculations = useMemo(() => {
    const slDistance = Math.abs(entry - stopLoss);

    // Adjust TP based on R:R ratio
    const adjustedTpDistance = slDistance * rrRatio;
    const adjustedTpPrice = isBuy ? entry + adjustedTpDistance : entry - adjustedTpDistance;

    const slPips = Math.round(slDistance / pipSize);
    const tpPips = Math.round(adjustedTpDistance / pipSize);

    // Percentage distances
    const slPercent = entry > 0 ? (slDistance / entry * 100) : 0;
    const tpPercent = entry > 0 ? (adjustedTpDistance / entry * 100) : 0;

    const pipValuePerLot = (pipSize * contractSize);
    const pipValue = lotSize * pipValuePerLot;

    const riskDollars = slDistance * lotSize * contractSize;
    const rewardDollars = adjustedTpDistance * lotSize * contractSize;
    const riskOfBalance = accountBalance > 0 ? (riskDollars / accountBalance * 100) : 0;

    const riskLevel = riskOfBalance <= 1 ? 'safe' : riskOfBalance <= 3 ? 'ok' : riskOfBalance <= 5 ? 'warn' : 'danger';

    return {
      slPips,
      tpPips,
      slDistance,
      adjustedTpDistance,
      adjustedTpPrice,
      slPercent,
      tpPercent,
      pipValue,
      riskDollars,
      rewardDollars,
      riskOfBalance,
      riskLevel,
    };
  }, [entry, stopLoss, rrRatio, lotSize, accountBalance, pipSize, contractSize, isBuy]);

  const lotPresets = [0.01, 0.05, 0.1, 0.5, 1.0];
  const balancePresets = [500, 1000, 5000, 10000];
  const rrPresets = [1, 2, 3];

  const riskColors: Record<string, string> = {
    safe: 'text-emerald-400',
    ok: 'text-emerald-300',
    warn: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      {/* Signal type with color */}
      <div className="flex items-center justify-center">
        <span className={`text-xs font-bold ${signalDisplay.color}`}>
          {signalDisplay.text}
        </span>
      </div>

      {/* SL - Symbol - TP */}
      <div className="flex items-center gap-1">
        <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingDown size={12} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-bold uppercase">{isAr ? 'وقف الخسارة' : 'SL'}</span>
          </div>
          <span className="text-lg font-extrabold text-red-500 font-mono block">
            {formatNum(stopLoss, decimals)}
          </span>
          <div className="text-xs font-black text-red-400 font-mono mt-0.5">
            {calculations.slPips} {instConfig.pipLabel} ({calculations.slPercent.toFixed(1)}%)
          </div>
          <div className="text-[10px] text-red-400/70 font-mono">
            -{formatNum(calculations.riskDollars)}$
          </div>
        </div>

        {/* Symbol name between SL and TP */}
        <div className="flex flex-col items-center justify-center px-1">
          <TrendingDown size={12} className="text-red-400 mb-0.5" />
          <span className="text-xs font-extrabold text-white font-mono leading-none">{symbol}</span>
          <TrendingUp size={12} className="text-emerald-400 mt-0.5" />
        </div>

        <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-bold uppercase">{isAr ? 'جني الأرباح' : 'TP'}</span>
          </div>
          <span className="text-lg font-extrabold text-emerald-500 font-mono block">
            {formatNum(calculations.adjustedTpPrice, decimals)}
          </span>
          <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
            {calculations.tpPips} {instConfig.pipLabel} ({calculations.tpPercent.toFixed(1)}%)
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            +{formatNum(calculations.rewardDollars)}$
          </div>
        </div>
      </div>

      {/* R:R Ratio Selector */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-white/60 font-bold uppercase">{isAr ? 'العائد' : 'R:R'}</span>
        <div className="flex gap-1">
          {rrPresets.map(r => (
            <button
              key={r}
              onClick={() => setRrRatio(r)}
              className={`text-xs font-black px-3 py-1 rounded-lg transition-all ${
                rrRatio === r
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              1:{r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 py-0.5">
        <Zap size={12} className={isStrongSignal ? 'text-amber-400' : 'text-blue-400'} />
        <span className={`text-xs font-bold ${isStrongSignal ? 'text-amber-400' : 'text-blue-400'}`}>
          {isStrongSignal ? (isAr ? 'إشارة قوية' : 'Strong Signal') : (isAr ? 'إشارة عادية' : 'Normal Signal')}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-white/60 font-bold uppercase">{isAr ? 'الرصيد' : 'Balance'}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => adjustBalance(-1)} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 active:scale-95">
            <Minus size={12} />
          </button>
          <div className="flex items-center gap-0.5 bg-white/5 rounded px-2 py-1 border border-white/10">
            <span className="text-white/60 text-xs">$</span>
            <input
              type="text"
              value={balanceInput}
              onChange={(e) => handleBalanceChange(e.target.value)}
              onBlur={handleBalanceBlur}
              className="w-16 bg-transparent text-sm font-black text-white font-mono text-center outline-none"
            />
          </div>
          <button onClick={() => adjustBalance(1)} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 active:scale-95">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className="flex justify-center gap-1">
        {balancePresets.map(p => (
          <button
            key={p}
            onClick={() => { setAccountBalance(p); setBalanceInput(String(p)); }}
            className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
              accountBalance === p
                ? 'bg-white/20 text-white border border-white/20'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            ${p >= 1000 ? `${p/1000}K` : p}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-white/60 font-bold uppercase">{isAr ? 'اللوت' : 'Lot'}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustLot(-1)}
            className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all active:scale-90"
          >
            <Minus size={16} />
          </button>
          <span className="text-2xl font-black text-white font-mono min-w-[70px] text-center">
            {formatNum(lotSize, 2)}
          </span>
          <button
            onClick={() => adjustLot(1)}
            className="w-9 h-9 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-90"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="text-[10px] text-primary font-mono">
          ${formatNum(calculations.pipValue)}/{instConfig.pipLabel}
        </div>
      </div>

      <div className="flex justify-center gap-1">
        {lotPresets.map(p => (
          <button
            key={p}
            onClick={() => setLotSize(p)}
            className={`text-xs font-bold px-2.5 py-0.5 rounded transition-all ${
              lotSize === p
                ? 'bg-primary text-black'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Shield size={12} className={riskColors[calculations.riskLevel]} />
          <span className={`font-bold ${riskColors[calculations.riskLevel]}`}>
            {formatNum(calculations.riskOfBalance)}% {isAr ? 'مخاطرة' : 'risk'}
          </span>
        </div>
        <span className="text-white/30">|</span>
        <span className="text-white/60">
          1:{rrRatio} {isAr ? 'عائد' : 'R:R'}
        </span>
      </div>
    </div>
  );
}
