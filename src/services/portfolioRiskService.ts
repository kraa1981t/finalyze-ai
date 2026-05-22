import { AnalysisResult, SignalType, MarketType } from "../types";

export interface ClusterWarning {
  type: 'cluster_overlap' | 'inverse_conflict' | 'cluster_hedge' | 'same_symbol';
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

function getClustersForSymbol(symbol: string): string[] {
  const keys: string[] = [];
  for (const c of CLUSTERS) {
    if (c.symbols.includes(symbol)) keys.push(c.key);
  }
  return keys;
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

  return { warnings, exposures, totalLong, totalShort, netExposure: totalLong - totalShort };
}
