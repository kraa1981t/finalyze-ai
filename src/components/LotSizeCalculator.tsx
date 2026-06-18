import React, { useState, useMemo } from 'react';
import { Minus, Plus, TrendingUp, TrendingDown, Shield, Zap } from 'lucide-react';

interface LotSizeCalculatorProps {
  symbol: string;
  stopLoss: number;
  takeProfit: number;
  entryPrice?: number;
  signal: 'strong_buy' | 'buy' | 'sell' | 'strong_sell';
  lang: 'ar' | 'en';
}

export default function LotSizeCalculator({ symbol, stopLoss, takeProfit, entryPrice, signal, lang }: LotSizeCalculatorProps) {
  const isAr = lang === 'ar';
  const isJPY = symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const pipSize = isJPY ? 0.01 : 0.0001;
  const isBuy = signal === 'strong_buy' || signal === 'buy';
  const pipValuePerStandardLot = 10;

  const entry = entryPrice || (stopLoss + takeProfit) / 2;

  const isStrongSignal = signal === 'strong_buy' || signal === 'strong_sell';

  // Inputs
  const [lotSize, setLotSize] = useState(0.01);
  const [accountBalance, setAccountBalance] = useState(1000);
  const [balanceInput, setBalanceInput] = useState('1000');
  const [tpMultiplier, setTpMultiplier] = useState(2);

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
    const pipValue = lotSize * pipValuePerStandardLot;

    // Use actual SL/TP from analysis for pip calculation
    const actualSlPips = Math.abs(entry - stopLoss) / pipSize;
    const actualTpPips = Math.abs(takeProfit - entry) / pipSize;
    
    // Scale SL pips with lot size (bigger lot = wider SL for same risk %)
    const basePips = isStrongSignal ? 40 : 25;
    const slPips = Math.round(basePips * Math.sqrt(lotSize / 0.01));
    const tpPips = slPips * tpMultiplier;

    const actualRisk = slPips * pipValue;
    const actualReward = tpPips * pipValue;
    const riskOfBalance = accountBalance > 0 ? (actualRisk / accountBalance * 100) : 0;

    const slPrice = isBuy ? entry - slPips * pipSize : entry + slPips * pipSize;
    const tpPrice = isBuy ? entry + tpPips * pipSize : entry - tpPips * pipSize;

    const riskLevel = riskOfBalance <= 1 ? 'safe' : riskOfBalance <= 3 ? 'ok' : riskOfBalance <= 5 ? 'warn' : 'danger';

    return {
      pipValue,
      slPips,
      tpPips,
      actualSlPips,
      actualTpPips,
      actualRisk,
      actualReward,
      riskOfBalance,
      slPrice,
      tpPrice,
      riskLevel,
    };
  }, [accountBalance, lotSize, tpMultiplier, entry, pipSize, isBuy, isStrongSignal, stopLoss, takeProfit]);

  const lotPresets = [0.01, 0.05, 0.1, 0.5, 1.0];
  const balancePresets = [500, 1000, 5000, 10000];
  const multiplierPresets = [2, 3, 4, 5];

  const riskColors: Record<string, string> = {
    safe: 'text-emerald-400',
    ok: 'text-emerald-300',
    warn: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      {/* Dynamic SL/TP Display - Top */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Stop Loss */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingDown size={12} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-bold uppercase">{isAr ? 'وقف الخسارة' : 'SL'}</span>
          </div>
          <span className="text-lg font-extrabold text-red-500 font-mono block">
            {formatNum(calculations.slPrice, decimals)}
          </span>
          <div className="text-xs font-black text-red-400 font-mono mt-0.5">
            {calculations.slPips} {isAr ? 'نقطة' : 'pips'}
          </div>
          <div className="text-[10px] text-red-400/70 font-mono">
            -{formatNum(calculations.actualRisk)}$
          </div>
        </div>

        {/* Take Profit */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-1.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp size={12} className="text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-bold uppercase">{isAr ? 'جني الأرباح' : 'TP'}</span>
          </div>
          <span className="text-lg font-extrabold text-emerald-500 font-mono block">
            {formatNum(calculations.tpPrice, decimals)}
          </span>
          <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
            {calculations.tpPips} {isAr ? 'نقطة' : 'pips'}
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono">
            +{formatNum(calculations.actualReward)}$
          </div>
        </div>
      </div>

      {/* Signal Strength Badge */}
      <div className="flex items-center justify-center gap-1.5 py-0.5">
        <Zap size={12} className={isStrongSignal ? 'text-amber-400' : 'text-blue-400'} />
        <span className={`text-xs font-bold ${isStrongSignal ? 'text-amber-400' : 'text-blue-400'}`}>
          {isStrongSignal ? (isAr ? 'إشارة قوية' : 'Strong Signal') : (isAr ? 'إشارة عادية' : 'Normal Signal')}
        </span>
        <span className="text-white/30 text-[10px]">|</span>
        <span className="text-white/50 text-xs">
          {isStrongSignal ? (isAr ? 'ستوب أوسع' : 'Wider SL') : (isAr ? 'ستوب أضيق' : 'Tighter SL')}
        </span>
      </div>

      {/* Account Balance */}
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

      {/* Balance Presets */}
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

      {/* TP Multiplier */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-white/60 font-bold uppercase">{isAr ? 'العائد' : 'R:R'}</span>
        <div className="flex gap-1">
          {multiplierPresets.map(m => (
            <button
              key={m}
              onClick={() => setTpMultiplier(m)}
              className={`text-xs font-black px-2.5 py-0.5 rounded transition-all ${
                tpMultiplier === m
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              {m}:1
            </button>
          ))}
        </div>
      </div>

      {/* Lot Size Control */}
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
          {formatNum(calculations.pipValue)}$/{isAr ? 'نقطة' : 'pip'}
        </div>
      </div>

      {/* Lot Presets */}
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

      {/* Risk Summary */}
      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Shield size={12} className={riskColors[calculations.riskLevel]} />
          <span className={`font-bold ${riskColors[calculations.riskLevel]}`}>
            {formatNum(calculations.riskOfBalance)}% {isAr ? 'مخاطرة' : 'risk'}
          </span>
        </div>
        <span className="text-white/30">|</span>
        <span className="text-white/60">
          {tpMultiplier}:1 {isAr ? 'عائد' : 'return'}
        </span>
      </div>
    </div>
  );
}
