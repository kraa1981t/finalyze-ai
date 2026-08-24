/**
 * ═══════════════════════════════════════════════════════════════════
 * ANALYSIS SYSTEM — PROTECTION GUARD
 * ═══════════════════════════════════════════════════════════════════
 * 
 * This module provides runtime validation for the analysis system.
 * It ensures critical invariants are maintained across all code paths.
 * 
 * USAGE:
 *   import { validateAnalysisResult, validateCandleMatch } from './analysisGuard';
 * 
 * INVARIANTS:
 *   1. Candle Match: bearish candles CANNOT confirm BUY, bullish CANNOT confirm SELL
 *   2. Signal integrity: finalSignal must be a valid SignalType
 *   3. Confidence: must be between 0 and 100
 *   4. Direction: must match signal direction when candle match is active
 * ═══════════════════════════════════════════════════════════════════
 */

import { SignalType, AnalysisResult, StrategySettings } from '../types';

// ═══ CANDLE MATCH VALIDATION ═══

export interface CandleMatchInput {
  dailyBody: number | null;
  dailyDirection: 'bullish' | 'bearish' | 'unknown' | null;
  weeklyBody: number | null;
  weeklyDirection: 'bullish' | 'bearish' | 'unknown' | null;
  monthlyBody: number | null;
  monthlyDirection: 'bullish' | 'bearish' | 'unknown' | null;
  signal: SignalType;
  settings: StrategySettings;
  isCrypto: boolean;
  marketType: string;
}

export interface CandleMatchValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates candle match data before analysis runs.
 * This is a PRE-CHECK — it catches issues before they affect the signal.
 */
export function validateCandleMatchInput(input: CandleMatchInput): CandleMatchValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check 1: Signal must be valid
  const validSignals = Object.values(SignalType);
  if (!validSignals.includes(input.signal)) {
    errors.push(`Invalid signal type: ${input.signal}`);
  }

  // Check 2: If candle match is enabled, check direction consistency
  if (input.settings.useCandleMatch) {
    const directions = [input.dailyDirection, input.weeklyDirection, input.monthlyDirection].filter(d => d !== null);
    
    if (directions.length >= 2) {
      const firstDir = directions[0];
      const allSame = directions.every(d => d === firstDir);
      
      if (!allSame) {
        warnings.push('Candle directions conflict across timeframes — signal will be blocked');
      }

      // Check direction vs signal
      const signalIsBuy = input.signal === SignalType.BUY || input.signal === SignalType.STRONG_BUY;
      const signalIsSell = input.signal === SignalType.SELL || input.signal === SignalType.STRONG_SELL;
      
      if (signalIsBuy && firstDir === 'bearish') {
        errors.push('CRITICAL: Bearish candles cannot confirm BUY signal');
      }
      if (signalIsSell && firstDir === 'bullish') {
        errors.push('CRITICAL: Bullish candles cannot confirm SELL signal');
      }
    }

    // Check thresholds
    const bodyMultiplier = input.isCrypto ? 1 : (input.marketType === 'forex' ? 10000 : 100);
    
    if (input.dailyBody !== null && input.settings.candleMatchDailyEnabled !== false) {
      const threshold = input.settings.candleMatchDailyThreshold ?? 10;
      const bodyPips = input.dailyBody * bodyMultiplier;
      if (bodyPips < threshold) {
        warnings.push(`Daily body (${bodyPips.toFixed(1)} pips) below threshold (${threshold} pips)`);
      }
    }
    
    if (input.weeklyBody !== null && input.settings.candleMatchWeeklyEnabled !== false) {
      const threshold = input.settings.candleMatchWeeklyThreshold ?? 20;
      const bodyPips = input.weeklyBody * bodyMultiplier;
      if (bodyPips < threshold) {
        warnings.push(`Weekly body (${bodyPips.toFixed(1)} pips) below threshold (${threshold} pips)`);
      }
    }
    
    if (input.monthlyBody !== null && input.settings.candleMatchMonthlyEnabled !== false) {
      const threshold = input.settings.candleMatchMonthlyThreshold ?? 30;
      const bodyPips = input.monthlyBody * bodyMultiplier;
      if (bodyPips < threshold) {
        warnings.push(`Monthly body (${bodyPips.toFixed(1)} pips) below threshold (${threshold} pips)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══ ANALYSIS RESULT VALIDATION ═══

export interface AnalysisResultValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates an analysis result before it's displayed to the user.
 * This is a POST-CHECK — it catches issues after the analysis runs.
 */
export function validateAnalysisResult(result: AnalysisResult): AnalysisResultValidation {
  const errors: string[] = [];

  // Check 1: Signal must be valid
  const validSignals = Object.values(SignalType);
  if (!validSignals.includes(result.signal)) {
    errors.push(`Invalid signal: ${result.signal}`);
  }

  // Check 2: Confidence must be 0-100
  if (result.confidence < 0 || result.confidence > 100) {
    errors.push(`Confidence out of range: ${result.confidence}`);
  }

  // Check 3: Technical and sentiment scores must be 0-100
  if (result.technicalScore < 0 || result.technicalScore > 100) {
    errors.push(`Technical score out of range: ${result.technicalScore}`);
  }
  if (result.sentimentScore < 0 || result.sentimentScore > 100) {
    errors.push(`Sentiment score out of range: ${result.sentimentScore}`);
  }

  // Check 4: Direction must match signal
  if (result.direction) {
    const isBuy = result.signal === SignalType.BUY || result.signal === SignalType.STRONG_BUY;
    const isSell = result.signal === SignalType.SELL || result.signal === SignalType.STRONG_SELL;
    
    if (isBuy && result.direction !== 'buy') {
      errors.push(`BUY signal but direction is "${result.direction}"`);
    }
    if (isSell && result.direction !== 'sell') {
      errors.push(`SELL signal but direction is "${result.direction}"`);
    }
  }

  // Check 5: Candle match consistency
  const candleMatchReason = result.detailedReasons?.find(r => r.check?.includes('Candle Match'));
  if (candleMatchReason) {
    const isMatched = candleMatchReason.status === 'positive';
    const isBuy = result.signal === SignalType.BUY || result.signal === SignalType.STRONG_BUY;
    const isSell = result.signal === SignalType.SELL || result.signal === SignalType.STRONG_SELL;
    
    if (isMatched && candleMatchReason.impact?.includes('bearish') && isBuy) {
      errors.push('CRITICAL: Candle match shows bearish but signal is BUY');
    }
    if (isMatched && candleMatchReason.impact?.includes('bullish') && isSell) {
      errors.push('CRITICAL: Candle match shows bullish but signal is SELL');
    }
  }

  // Check 6: If candle match blocked, confidence must be ≤ 30
  const candleMatchBlocked = result.detailedReasons?.some(
    r => r.check?.includes('Candle Match') && r.status === 'negative'
  );
  if (candleMatchBlocked && result.confidence > 30) {
    errors.push(`Candle match blocked but confidence is ${result.confidence} (should be ≤ 30)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ═══ SETTINGS VALIDATION ═══

export interface SettingsValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates strategy settings before analysis runs.
 */
export function validateSettings(settings: StrategySettings): SettingsValidation {
  const errors: string[] = [];

  // Check weight ranges
  const weights = [
    { name: 'primaryBBWeight', value: settings.primaryBBWeight },
    { name: 'primarySDWeight', value: settings.primarySDWeight },
    { name: 'primaryAgeWeight', value: settings.primaryAgeWeight },
    { name: 'primaryPrePullbackAgeWeight', value: settings.primaryPrePullbackAgeWeight },
    { name: 'primaryNewsWeight', value: settings.primaryNewsWeight },
  ];

  for (const w of weights) {
    if (w.value !== undefined && (w.value < 0 || w.value > 100)) {
      errors.push(`${w.name} out of range: ${w.value}`);
    }
  }

  // Check threshold ranges
  if (settings.minConfidence < 0 || settings.minConfidence > 100) {
    errors.push(`minConfidence out of range: ${settings.minConfidence}`);
  }
  if (settings.strongThreshold < 0 || settings.strongThreshold > 100) {
    errors.push(`strongThreshold out of range: ${settings.strongThreshold}`);
  }

  // Check candle match thresholds
  if (settings.candleMatchDailyThreshold !== undefined && settings.candleMatchDailyThreshold < 0) {
    errors.push(`candleMatchDailyThreshold cannot be negative: ${settings.candleMatchDailyThreshold}`);
  }
  if (settings.candleMatchWeeklyThreshold !== undefined && settings.candleMatchWeeklyThreshold < 0) {
    errors.push(`candleMatchWeeklyThreshold cannot be negative: ${settings.candleMatchWeeklyThreshold}`);
  }
  if (settings.candleMatchMonthlyThreshold !== undefined && settings.candleMatchMonthlyThreshold < 0) {
    errors.push(`candleMatchMonthlyThreshold cannot be negative: ${settings.candleMatchMonthlyThreshold}`);
  }

  // Check age zones
  if (settings.minInfantAge !== undefined && settings.minMatureAge !== undefined) {
    if (settings.minInfantAge >= settings.minMatureAge) {
      errors.push(`minInfantAge (${settings.minInfantAge}) must be < minMatureAge (${settings.minMatureAge})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ═══ RUNTIME MONITOR ═══

export interface AnalysisEvent {
  timestamp: number;
  symbol: string;
  signal: SignalType;
  confidence: number;
  candleMatchBlocked: boolean;
  duration: number;
  errors: string[];
}

const _events: AnalysisEvent[] = [];
const MAX_EVENTS = 100;

/**
 * Logs an analysis event for monitoring.
 */
export function logAnalysisEvent(event: AnalysisEvent): void {
  _events.push(event);
  if (_events.length > MAX_EVENTS) {
    _events.shift();
  }
  
  // Log errors to console
  if (event.errors.length > 0) {
    console.error(`[AnalysisGuard] ${event.symbol}: ${event.errors.join(', ')}`);
  }
}

/**
 * Gets recent analysis events for debugging.
 */
export function getRecentEvents(): AnalysisEvent[] {
  return [..._events];
}

/**
 * Gets analysis error rate.
 */
export function getErrorRate(): number {
  if (_events.length === 0) return 0;
  const errorCount = _events.filter(e => e.errors.length > 0).length;
  return errorCount / _events.length;
}
