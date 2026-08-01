import { SignalType } from '../types';

// ═══════════════════════════════════════════════════
// المستويات النفسية / الأرقام الدائرية
// ═══════════════════════════════════════════════════

// المستويات لكل فئة
const FOREX_MAJOR = [0.9500, 1.0000, 1.0500, 1.1000, 1.1500, 1.2000, 1.2500, 1.3000, 1.3500, 1.4000, 1.4500, 1.5000];
const FOREX_MINOR = [0.9550, 0.9600, 0.9650, 0.9700, 0.9750, 0.9800, 0.9850, 0.9900, 0.9950, 1.0050, 1.0100, 1.0150, 1.0200, 1.0250, 1.0300, 1.0350, 1.0400, 1.0450, 1.0550, 1.0600, 1.0650, 1.0700, 1.0750, 1.0800, 1.0850, 1.0900, 1.0950, 1.1050, 1.1100, 1.1150, 1.1200, 1.1250, 1.1300, 1.1350, 1.1400, 1.1450, 1.1550, 1.1600, 1.1650, 1.1700, 1.1750, 1.1800, 1.1850, 1.1900, 1.1950, 1.2050, 1.2100, 1.2150, 1.2200, 1.2250, 1.2300, 1.2350, 1.2400, 1.2450, 1.2550, 1.2600, 1.2650, 1.2700, 1.2750, 1.2800, 1.2850, 1.2900, 1.2950, 1.3050, 1.3100, 1.3150, 1.3200, 1.3250, 1.3300, 1.3350, 1.3400, 1.3450, 1.3550, 1.3600, 1.3650, 1.3700, 1.3750, 1.3800, 1.3850, 1.3900, 1.3950, 1.4050, 1.4100, 1.4150, 1.4200, 1.4250, 1.4300, 1.4350, 1.4400, 1.4450, 1.4550, 1.4600, 1.4650, 1.4700, 1.4750, 1.4800, 1.4850, 1.4900, 1.4950];

const JPY_MAJOR = [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];
const JPY_MINOR = [101, 102, 103, 104, 106, 107, 108, 109, 111, 112, 113, 114, 116, 117, 118, 119, 121, 122, 123, 124, 126, 127, 128, 129, 131, 132, 133, 134, 136, 137, 138, 139, 141, 142, 143, 144, 146, 147, 148, 149];

const CRYPTO_MAJOR_BTC = [10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000, 90000, 95000, 100000];
const CRYPTO_MINOR_BTC = [12500, 17500, 22500, 27500, 32500, 37500, 42500, 47500, 52500, 57500, 62500, 67500, 72500, 77500, 82500, 87500, 92500, 97500];

const CRYPTO_MAJOR_ETH = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
const CRYPTO_MINOR_ETH = [1100, 1200, 1300, 1400, 1600, 1700, 1800, 1900, 2100, 2200, 2300, 2400, 2600, 2700, 2800, 2900, 3100, 3200, 3300, 3400, 3600, 3700, 3800, 3900, 4100, 4200, 4300, 4400, 4600, 4700, 4800, 4900];

const STOCKS_MAJOR = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const STOCKS_MINOR = [10, 20, 30, 40, 60, 70, 80, 90, 110, 120, 130, 140, 160, 170, 180, 190, 210, 220, 230, 240, 260, 270, 280, 290, 310, 320, 330, 340, 360, 370, 380, 390, 410, 420, 430, 440, 460, 470, 480, 490];

const GOLD_MAJOR = [1700, 1750, 1800, 1850, 1900, 1950, 2000, 2050, 2100, 2150, 2200, 2250, 2300, 2350, 2400, 2450, 2500];
const GOLD_MINOR = [1725, 1775, 1825, 1875, 1925, 1975, 2025, 2075, 2125, 2175, 2225, 2275, 2325, 2375, 2425, 2475];

const SILVER_MAJOR = [15, 20, 25, 30, 35, 40, 45, 50];
const SILVER_MINOR = [16, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34, 36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 49];

// ═══════════════════════════════════════════════════
// تحديد الفئة من الرمز
// ═══════════════════════════════════════════════════

function detectSymbolCategory(symbol: string): 'forex' | 'crypto' | 'stocks' | 'metals' {
  const s = symbol.toUpperCase();
  
  // Crypto
  if (s.includes('BTC') || s.includes('ETH') || s.includes('BNB') || s.includes('SOL') || 
      s.includes('XRP') || s.includes('DOGE') || s.includes('ADA') || s.includes('DOT') ||
      s.includes('AVAX') || s.includes('MATIC') || s.includes('LINK') || s.includes('UNI') ||
      s.includes('SHIB') || s.includes('LTC') || s.includes('BCH') || s.includes('ATOM') ||
      s.includes('FIL') || s.includes('APT') || s.includes('ARB') || s.includes('OP') ||
      s.includes('USDT') || s.includes('USDC') || s.includes('CRYPTO') || s.includes('BTCUSDT') || s.includes('ETHUSDT')) {
    return 'crypto';
  }
  
  // Metals
  if (s.includes('GOLD') || s.includes('XAU') || s.includes('XAG') || s.includes('SILVER') || 
      s.includes('PLATINUM') || s.includes('PALLADIUM') || s.includes('XPT') || s.includes('XPD')) {
    return 'metals';
  }
  
  // Forex - JPY pairs
  if (s.includes('JPY')) {
    return 'forex';
  }
  
  // Forex - major pairs
  if (s.includes('EUR') || s.includes('GBP') || s.includes('CHF') || s.includes('CAD') || 
      s.includes('AUD') || s.includes('NZD') || s.includes('USD')) {
    return 'forex';
  }
  
  // Stocks - common tickers (1-5 chars, all uppercase)
  if (/^[A-Z]{1,5}$/.test(s) && !s.includes('USD')) {
    return 'stocks';
  }
  
  return 'forex'; // default
}

// ═══════════════════════════════════════════════════
// الحصول على المستويات حسب الرمز
// ═══════════════════════════════════════════════════

function getLevelsForSymbol(symbol: string): { major: number[]; minor: number[] } {
  const s = symbol.toUpperCase();
  const category = detectSymbolCategory(symbol);
  
  if (category === 'crypto') {
    if (s.includes('BTC') || s.includes('BTCUSDT')) {
      return { major: CRYPTO_MAJOR_BTC, minor: CRYPTO_MINOR_BTC };
    }
    if (s.includes('ETH') || s.includes('ETHUSDT')) {
      return { major: CRYPTO_MAJOR_ETH, minor: CRYPTO_MINOR_ETH };
    }
    // Other cryptos - use generic levels
    return { major: [1, 5, 10, 50, 100, 500, 1000], minor: [2, 3, 4, 6, 7, 8, 9, 15, 25, 75, 150, 250, 750] };
  }
  
  if (category === 'metals') {
    if (s.includes('GOLD') || s.includes('XAU')) {
      return { major: GOLD_MAJOR, minor: GOLD_MINOR };
    }
    if (s.includes('SILVER') || s.includes('XAG')) {
      return { major: SILVER_MAJOR, minor: SILVER_MINOR };
    }
    return { major: GOLD_MAJOR, minor: GOLD_MINOR };
  }
  
  if (category === 'forex') {
    if (s.includes('JPY')) {
      return { major: JPY_MAJOR, minor: JPY_MINOR };
    }
    return { major: FOREX_MAJOR, minor: FOREX_MINOR };
  }
  
  // Stocks
  return { major: STOCKS_MAJOR, minor: STOCKS_MINOR };
}

// ═══════════════════════════════════════════════════
// حساب نطاق التأثير بناءً على السعر
// ═══════════════════════════════════════════════════

function getEffectRadius(currentPrice: number): number {
  // النطاق = 0.1% من السعر الحالي
  return currentPrice * 0.001;
}

// ═══════════════════════════════════════════════════
// الدالة الرئيسية: تحليل المستويات النفسية
// ═══════════════════════════════════════════════════

export interface PsychologicalAnalysis {
  nearestLevel: number;
  distance: number;           // النسبة المئوية من السعر للمستوى
  distanceAbs: number;        // المسافة المطلقة
  levelType: 'support' | 'resistance';
  levelStrength: 'major' | 'minor';
  effect: 'boost' | 'reduce' | 'neutral';
  effectAmount: number;       // التأثير على الثقة (±)
  signalAlignment: 'aligned' | 'conflicting' | 'neutral';
  reason: string;
  reasonAr: string;
}

export function analyzePsychologicalLevel(
  symbol: string,
  currentPrice: number,
  signal: SignalType
): PsychologicalAnalysis {
  const { major, minor } = getLevelsForSymbol(symbol);
  const radius = getEffectRadius(currentPrice);
  
  // العثور على أقرب مستوى رئيسي
  let nearestMajor = major[0];
  let minDistMajor = Math.abs(currentPrice - major[0]);
  for (const level of major) {
    const dist = Math.abs(currentPrice - level);
    if (dist < minDistMajor) {
      minDistMajor = dist;
      nearestMajor = level;
    }
  }
  
  // العثور على أقرب مستوى فرعي
  let nearestMinor = minor[0];
  let minDistMinor = Math.abs(currentPrice - minor[0]);
  for (const level of minor) {
    const dist = Math.abs(currentPrice - level);
    if (dist < minDistMinor) {
      minDistMinor = dist;
      nearestMinor = level;
    }
  }
  
  // تحديد أقرب مستوى (رئيسي أو فرعي)
  let nearestLevel: number;
  let levelStrength: 'major' | 'minor';
  let distanceAbs: number;
  
  if (minDistMajor <= minDistMinor) {
    nearestLevel = nearestMajor;
    levelStrength = 'major';
    distanceAbs = minDistMajor;
  } else {
    nearestLevel = nearestMinor;
    levelStrength = 'minor';
    distanceAbs = minDistMinor;
  }
  
  const distance = (distanceAbs / currentPrice) * 100;
  
  // تحديد نوع المستوى (دعم أو مقاومة)
  const levelType: 'support' | 'resistance' = currentPrice >= nearestLevel ? 'support' : 'resistance';
  
  // تحديد التوافق مع الإشارة
  let signalAlignment: 'aligned' | 'conflicting' | 'neutral' = 'neutral';
  const isBuy = signal === SignalType.BUY || signal === SignalType.STRONG_BUY;
  const isSell = signal === SignalType.SELL || signal === SignalType.STRONG_SELL;
  
  if (isBuy && levelType === 'support') {
    signalAlignment = 'aligned';
  } else if (isSell && levelType === 'resistance') {
    signalAlignment = 'aligned';
  } else if (isBuy && levelType === 'resistance') {
    signalAlignment = 'conflicting';
  } else if (isSell && levelType === 'support') {
    signalAlignment = 'conflicting';
  }
  
  // حساب التأثير على الثقة
  let effect: 'boost' | 'reduce' | 'neutral' = 'neutral';
  let effectAmount = 0;
  
  if (signalAlignment === 'aligned' && distanceAbs <= radius) {
    // السعر قريب من المستوى والإشارة متوافقة → تعزيز
    effect = 'boost';
    effectAmount = levelStrength === 'major' ? 5 : 3;
    // تعزيز إضافي إذا كان السعر جداً قريباً
    if (distanceAbs <= radius * 0.3) {
      effectAmount += 2;
    }
  } else if (signalAlignment === 'conflicting' && distanceAbs <= radius) {
    // السعر قريب من المستوى والإشارة متضاربة → خفض
    effect = 'reduce';
    effectAmount = levelStrength === 'major' ? -8 : -5;
    // خفض إضافي إذا كان السعر جداً قريباً
    if (distanceAbs <= radius * 0.3) {
      effectAmount -= 3;
    }
  }
  
  // إنشاء الرسالة
  const levelName = levelStrength === 'major' ? 'رئيسي' : 'فرعي';
  const alignmentText = signalAlignment === 'aligned' ? '✓ متوافق مع الإشارة' : 
                        signalAlignment === 'conflicting' ? '✗ يتعارض مع الإشارة' : '— حياد';
  
  const reasonAr = `المستوى النفسي ${levelName} ${nearestLevel} (${levelType === 'support' ? 'دعم' : 'مقاومة'}) — بعد: ${distance.toFixed(3)}% — ${alignmentText}`;
  const reason = `Psychological ${levelStrength} level ${nearestLevel} (${levelType}) — distance: ${distance.toFixed(3)}% — ${alignmentText}`;
  
  return {
    nearestLevel,
    distance,
    distanceAbs,
    levelType,
    levelStrength,
    effect,
    effectAmount,
    signalAlignment,
    reason,
    reasonAr,
  };
}

// ═══════════════════════════════════════════════════
// دالة مساعدة: الحصول على جميع المستويات القريبة
// ═══════════════════════════════════════════════════

export function getNearbyLevels(
  symbol: string,
  currentPrice: number,
  rangePercent: number = 0.5
): { level: number; type: 'support' | 'resistance'; strength: 'major' | 'minor'; distance: number }[] {
  const { major, minor } = getLevelsForSymbol(symbol);
  const range = currentPrice * (rangePercent / 100);
  const results: { level: number; type: 'support' | 'resistance'; strength: 'major' | 'minor'; distance: number }[] = [];
  
  // فحص المستويات الرئيسية
  for (const level of major) {
    const dist = Math.abs(currentPrice - level);
    if (dist <= range) {
      results.push({
        level,
        type: currentPrice >= level ? 'support' : 'resistance',
        strength: 'major',
        distance: (dist / currentPrice) * 100,
      });
    }
  }
  
  // فحص المستويات الفرعية
  for (const level of minor) {
    const dist = Math.abs(currentPrice - level);
    if (dist <= range) {
      results.push({
        level,
        type: currentPrice >= level ? 'support' : 'resistance',
        strength: 'minor',
        distance: (dist / currentPrice) * 100,
      });
    }
  }
  
  // ترتيب حسب المسافة
  results.sort((a, b) => a.distance - b.distance);
  
  return results;
}
