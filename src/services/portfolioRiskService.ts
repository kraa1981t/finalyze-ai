import { AnalysisResult, SignalType, MarketType } from "../types";

export interface ClusterWarning {
  type: 'cluster_overlap' | 'inverse_conflict' | 'cluster_hedge' | 'same_symbol' | 'correlation_conflict';
  severity: 'low' | 'medium' | 'high';
  message: string;
  messageAr: string;
  symbols: string[];
}

export interface ClusterExposure {
  cluster: string;
  long: { symbol: string; confidence: number }[];
  short: { symbol: string; confidence: number }[];
  net: number;
}

export interface PortfolioAnalysis {
  warnings: ClusterWarning[];
  exposures: ClusterExposure[];
  totalLong: number;
  totalShort: number;
  netExposure: number;
}

const CLUSTERS: { key: string; symbols: string[] }[] = [
  { key: 'crypto_top', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD'] },
  { key: 'crypto_meme', symbols: ['DOGEUSD', 'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD'] },
  { key: 'crypto_alt', symbols: ['DOTUSD', 'LINKUSD', 'MATICUSD', 'UNIUSD', 'LTCUSD', 'BCHUSD'] },
  { key: 'forex_eur', symbols: ['EURUSD', 'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF'] },
  { key: 'forex_gbp', symbols: ['GBPUSD', 'GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF'] },
  { key: 'forex_aud_nzd', symbols: ['AUDUSD', 'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF', 'NZDUSD', 'NZDJPY', 'NZDCAD', 'NZDCHF'] },
  { key: 'forex_cad_chf', symbols: ['USDCAD', 'USDCHF', 'CADJPY', 'CADCHF', 'CHFJPY'] },
  { key: 'stocks_tech', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'INTC', 'QCOM'] },
  { key: 'stocks_finance', symbols: ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW', 'AXP', 'V', 'MA', 'PYPL'] },
  { key: 'stocks_energy', symbols: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'DVN', 'SHEL', 'TTE', 'BP'] },
  { key: 'metals', symbols: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XCUUSD'] },
];

const INVERSE_PAIRS: [string, string][] = [
  ['EURUSD', 'USDCHF'],
  ['GBPUSD', 'USDCHF'],
  ['AUDUSD', 'USDCAD'],
  ['NZDUSD', 'USDCAD'],
  ['USDJPY', 'EURJPY'],
];

// Cross-Asset Correlation Map (correlation > 0.75 = highly correlated)
// Each group contains symbols that move together — keep only the strongest
const CORRELATION_GROUPS: { key: string; label: string; labelAr: string; symbols: string[]; correlation: number }[] = [
  // Forex — Major USD pairs with same quote currency
  { key: 'eur_usd_cluster', label: 'EUR/USD Cluster', labelAr: 'مجموعة يورو/دولار', symbols: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'], correlation: 0.85 },
  { key: 'usd_jpy_cluster', label: 'USD/JPY Cluster', labelAr: 'مجموعة دولار/ين', symbols: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY', 'CADJPY', 'CHFJPY'], correlation: 0.80 },
  { key: 'eur_gbp_cross', label: 'EUR/GBP Cross', labelAr: 'زوج يورو/جنيه', symbols: ['EURGBP', 'EURUSD', 'GBPUSD'], correlation: 0.78 },
  { key: 'aud_nzd_cluster', label: 'AUD/NZD Cluster', labelAr: 'مجموعة أسترالي/نيوزيلندي', symbols: ['AUDUSD', 'NZDUSD', 'AUDNZD', 'AUDCAD', 'NZDCAD'], correlation: 0.82 },
  { key: 'usd_chf_cluster', label: 'USD/CHF Cluster', labelAr: 'مجموعة دولار/فرنك', symbols: ['USDCHF', 'USDJPY'], correlation: 0.76 },
  { key: 'eur_aud_cross', label: 'EUR/AUD Cross', labelAr: 'زوج يورو/أسترالي', symbols: ['EURAUD', 'EURUSD', 'AUDUSD'], correlation: 0.77 },
  // Crypto — Highly correlated
  { key: 'btc_eth_cluster', label: 'BTC/ETH Cluster', labelAr: 'مجموعة بيتكوين/إيثريوم', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD'], correlation: 0.90 },
  { key: 'alt_meme_cluster', label: 'Alt/Meme Cluster', labelAr: 'مجموعة العملات البديلة', symbols: ['DOGEUSD', 'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD', 'XRPUSD', 'ADAUSD'], correlation: 0.85 },
  // Stocks — Sector correlation
  { key: 'tech_giants', label: 'Tech Giants', labelAr: 'عمالقة التكنولوجيا', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'], correlation: 0.80 },
  { key: 'energy_sector', label: 'Energy Sector', labelAr: 'قطاع الطاقة', symbols: ['XOM', 'CVX', 'SHEL', 'TTE', 'BP', 'COP', 'SLB'], correlation: 0.85 },
  { key: 'finance_sector', label: 'Finance Sector', labelAr: 'قطاع المالية', symbols: ['JPM', 'BAC', 'WFC', 'C', 'GS'], correlation: 0.78 },
  // Metals
  { key: 'precious_metals', label: 'Precious Metals', labelAr: 'المعادن الثمينة', symbols: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'], correlation: 0.75 },
  // Forex — CAD/CHF correlated
  { key: 'cad_chf_cluster', label: 'CAD/CHF Cluster', labelAr: 'مجموعة كاد/فرنك', symbols: ['USDCAD', 'USDCHF', 'CADCHF'], correlation: 0.77 },
];

function getClustersForSymbol(symbol: string): string[] {
  const keys: string[] = [];
  for (const c of CLUSTERS) {
    if (c.symbols.includes(symbol)) keys.push(c.key);
  }
  return keys;
}

export function getCorrelationGroup(symbol: string): { key: string; label: string; labelAr: string; symbols: string[]; correlation: number } | null {
  for (const group of CORRELATION_GROUPS) {
    if (group.symbols.includes(symbol)) return group;
  }
  return null;
}

function isBuyLike(signal: SignalType): boolean {
  return signal === SignalType.STRONG_BUY || signal === SignalType.BUY;
}

function isSellLike(signal: SignalType): boolean {
  return signal === SignalType.STRONG_SELL || signal === SignalType.SELL;
}

export function analyzePortfolio(signals: AnalysisResult[]): PortfolioAnalysis {
  const warnings: ClusterWarning[] = [];
  const totalLong = signals.filter(s => isBuyLike(s.signal)).length;
  const totalShort = signals.filter(s => isSellLike(s.signal)).length;

  // 1. Cluster analysis
  const clusterMap = new Map<string, AnalysisResult[]>();
  for (const s of signals) {
    const clusters = getClustersForSymbol(s.symbol);
    for (const c of clusters) {
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push(s);
    }
  }

  const exposures: ClusterExposure[] = [];

  for (const [key, syms] of clusterMap) {
    const longs = syms.filter(s => isBuyLike(s.signal)).map(s => ({ symbol: s.symbol, confidence: s.confidence }));
    const shorts = syms.filter(s => isSellLike(s.signal)).map(s => ({ symbol: s.symbol, confidence: s.confidence }));
    const net = longs.length - shorts.length;
    const clusterName = CLUSTERS.find(c => c.key === key)?.key || key;

    exposures.push({ cluster: clusterName, long: longs, short: shorts, net });

    // Cluster concentration: 3+ signals all same direction
    if (longs.length >= 3 && shorts.length === 0) {
      warnings.push({
        type: 'cluster_overlap',
        severity: longs.length >= 5 ? 'high' : 'medium',
        message: `High concentration in ${clusterName}: ${longs.length} long positions. A cluster-wide downturn would affect all. Consider reducing exposure.`,
        messageAr: `تركيز عالي في مجموعة ${clusterName}: ${longs.length} صفقات شراء. أي هبوط في المجموعة سيؤثر على الكل. خفف التعرض.`,
        symbols: longs.map(s => s.symbol),
      });
    }
    if (shorts.length >= 3 && longs.length === 0) {
      warnings.push({
        type: 'cluster_overlap',
        severity: shorts.length >= 5 ? 'high' : 'medium',
        message: `High concentration in ${clusterName}: ${shorts.length} short positions. A cluster-wide rally would affect all. Consider reducing exposure.`,
        messageAr: `تركيز عالي في مجموعة ${clusterName}: ${shorts.length} صفقات بيع. أي ارتفاع في المجموعة سيؤثر على الكل. خفف التعرض.`,
        symbols: shorts.map(s => s.symbol),
      });
    }

    // Cluster hedging conflict (long and short in same cluster)
    if (longs.length > 0 && shorts.length > 0) {
      warnings.push({
        type: 'cluster_hedge',
        severity: 'high',
        message: `Conflicting signals in ${clusterName}: ${longs.length} buy and ${shorts.length} sell. These may cancel each other out, wasting spreads and fees.`,
        messageAr: `تعارض إشارات في مجموعة ${clusterName}: ${longs.length} شراء و ${shorts.length} بيع. الصفقات تلغي بعضها وقد تهدر الفروقات والرسوم.`,
        symbols: [...longs.map(s => s.symbol), ...shorts.map(s => s.symbol)],
      });
    }
  }

  // 2. Inverse pair conflicts: long on A AND long on B where A and B are inverse
  for (const [a, b] of INVERSE_PAIRS) {
    const sigA = signals.find(s => s.symbol === a);
    const sigB = signals.find(s => s.symbol === b);
    if (!sigA || !sigB) continue;

    // Both long on inverse pairs means they'll move opposite → one loses
    if (isBuyLike(sigA.signal) && isBuyLike(sigB.signal)) {
      warnings.push({
        type: 'inverse_conflict',
        severity: 'medium',
        message: `Both ${a} (buy) and ${b} (buy) are inverse pairs. When ${a} rises, ${b} tends to fall. One position will lose.`,
        messageAr: `كلا من ${a} (شراء) و ${b} (شراء) أزواج معكوسة. عندما يرتفع ${a}، ينخفض ${b}. أحد الصفقتين ستخسر.`,
        symbols: [a, b],
      });
    }
    if (isSellLike(sigA.signal) && isSellLike(sigB.signal)) {
      warnings.push({
        type: 'inverse_conflict',
        severity: 'medium',
        message: `Both ${a} (sell) and ${b} (sell) are inverse pairs. When ${a} falls, ${b} tends to rise. One position will lose.`,
        messageAr: `كلا من ${a} (بيع) و ${b} (بيع) أزواج معكوسة. عندما ينخفض ${a}، يرتفع ${b}. أحد الصفقتين ستخسر.`,
        symbols: [a, b],
      });
    }
  }

  // 3. Cross-Asset Correlation conflicts: correlated pairs in same direction
  for (const group of CORRELATION_GROUPS) {
    const groupSignals = signals.filter(s => group.symbols.includes(s.symbol));
    const longs = groupSignals.filter(s => isBuyLike(s.signal));
    const shorts = groupSignals.filter(s => isSellLike(s.signal));

    if (longs.length >= 2) {
      warnings.push({
        type: 'correlation_conflict',
        severity: 'medium',
        message: `${group.label}: ${longs.map(s => s.symbol).join(', ')} are highly correlated (${Math.round(group.correlation * 100)}%). Opening multiple long positions is like doubling down on the same trade.`,
        messageAr: `${group.labelAr}: ${longs.map(s => s.symbol).join(', ')} متصاحبة بقوة (${Math.round(group.correlation * 100)}%). فتح عدة صفقات شراء هو مثل مضاعفة المخاطرة على صفقة واحدة.`,
        symbols: longs.map(s => s.symbol),
      });
    }
    if (shorts.length >= 2) {
      warnings.push({
        type: 'correlation_conflict',
        severity: 'medium',
        message: `${group.label}: ${shorts.map(s => s.symbol).join(', ')} are highly correlated (${Math.round(group.correlation * 100)}%). Opening multiple short positions is like doubling down on the same trade.`,
        messageAr: `${group.labelAr}: ${shorts.map(s => s.symbol).join(', ')} متصاحبة بقوة (${Math.round(group.correlation * 100)}%). فتح عدة صفقات بيع هو مثل مضاعفة المخاطرة على صفقة واحدة.`,
        symbols: shorts.map(s => s.symbol),
      });
    }
  }

  return { warnings, exposures, totalLong, totalShort, netExposure: totalLong - totalShort };
}

function signalScore(s: AnalysisResult): number {
  const direction = isBuyLike(s.signal) ? 1 : isSellLike(s.signal) ? -1 : 0;
  const strength = s.signal === SignalType.STRONG_BUY || s.signal === SignalType.STRONG_SELL ? 1.2 : 1;
  return direction * s.confidence * strength;
}

export function resolveConflicts(signals: AnalysisResult[]): AnalysisResult[] {
  if (signals.length < 2) return signals;

  const kept = new Set<string>();
  const result: AnalysisResult[] = [];

  // 0. Resolve correlation conflicts (keep strongest per correlation group)
  const correlationFiltered = resolveCorrelationConflicts(signals);

  // 1. Resolve cluster conflicts (buy vs sell in same cluster)
  const clusterMap = new Map<string, AnalysisResult[]>();
  for (const s of correlationFiltered) {
    const clusters = getClustersForSymbol(s.symbol);
    // If symbol is not in any cluster, add it with empty cluster key
    if (clusters.length === 0) {
      if (!clusterMap.has('__ungrouped__')) clusterMap.set('__ungrouped__', []);
      clusterMap.get('__ungrouped__')!.push(s);
    }
    for (const c of clusters) {
      if (!clusterMap.has(c)) clusterMap.set(c, []);
      clusterMap.get(c)!.push(s);
    }
  }

  for (const [, syms] of clusterMap) {
    const buySignals = syms.filter(s => isBuyLike(s.signal));
    const sellSignals = syms.filter(s => isSellLike(s.signal));
    const neutralSignals = syms.filter(s => !isBuyLike(s.signal) && !isSellLike(s.signal));

    // Keep all neutrals
    for (const s of neutralSignals) {
      if (!kept.has(s.symbol)) {
        kept.add(s.symbol);
        result.push(s);
      }
    }

    if (buySignals.length > 0 && sellSignals.length > 0) {
      // Conflict: keep only the single highest-scoring signal
      const best = [...buySignals, ...sellSignals].sort((a, b) => Math.abs(signalScore(b)) - Math.abs(signalScore(a)))[0];
      if (!kept.has(best.symbol)) {
        kept.add(best.symbol);
        result.push(best);
      }
    } else {
      // No conflict: keep all signals
      for (const s of syms) {
        if (!kept.has(s.symbol)) {
          kept.add(s.symbol);
          result.push(s);
        }
      }
    }
  }

  // 2. Resolve inverse pair conflicts
  for (const [a, b] of INVERSE_PAIRS) {
    const sigA = result.find(s => s.symbol === a);
    const sigB = result.find(s => s.symbol === b);
    if (!sigA || !sigB) continue;

    const dirA = isBuyLike(sigA.signal) ? 1 : isSellLike(sigA.signal) ? -1 : 0;
    const dirB = isBuyLike(sigB.signal) ? 1 : isSellLike(sigB.signal) ? -1 : 0;

    // Only conflict if both have direction and same direction (both buy or both sell)
    if (dirA !== 0 && dirB !== 0 && dirA === dirB) {
      const scoreA = Math.abs(signalScore(sigA));
      const scoreB = Math.abs(signalScore(sigB));
      if (scoreA >= scoreB) {
        result.splice(result.indexOf(sigB), 1);
      } else {
        result.splice(result.indexOf(sigA), 1);
      }
    }
  }

  return result;
}

// Cross-Asset Correlation & Cointelligence — filter highly correlated pairs
export function resolveCorrelationConflicts(signals: AnalysisResult[]): AnalysisResult[] {
  if (signals.length < 2) return signals;

  const result = [...signals];
  const removed = new Set<string>();

  for (const group of CORRELATION_GROUPS) {
    const groupSignals = result.filter(s => 
      group.symbols.includes(s.symbol) && 
      !removed.has(s.symbol) &&
      (isBuyLike(s.signal) || isSellLike(s.signal))
    );

    if (groupSignals.length <= 1) continue;

    // Sort by signal strength (strong signals first, then by confidence)
    const sorted = groupSignals.sort((a, b) => {
      const aStrong = a.signal === SignalType.STRONG_BUY || a.signal === SignalType.STRONG_SELL ? 1 : 0;
      const bStrong = b.signal === SignalType.STRONG_BUY || b.signal === SignalType.STRONG_SELL ? 1 : 0;
      if (aStrong !== bStrong) return bStrong - aStrong;
      return b.confidence - a.confidence;
    });

    // Keep only the strongest, remove the rest
    const winner = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      removed.add(sorted[i].symbol);
    }
  }

  return result.filter(s => !removed.has(s.symbol));
}
