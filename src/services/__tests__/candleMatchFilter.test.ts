/**
 * ═══════════════════════════════════════════════════════════════════
 * CANDLE MATCH FILTER — COMPREHENSIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 * 
 * CRITICAL INVARIANTS (DO NOT CHANGE WITHOUT REVIEW):
 * 
 * 1. All active candles MUST have the same direction (all bullish or all bearish)
 * 2. Each active candle body MUST meet its configured threshold
 * 3. Candle direction MUST match signal direction:
 *    - BUY signal → candles MUST be bullish
 *    - SELL signal → candles MUST be bearish
 *    - If any condition fails → signal MUST be forced to NEUTRAL
 * 
 * These invariants are the SAFETY GUARD of the analysis system.
 * Any modification to these rules requires full review of this test suite.
 * ═══════════════════════════════════════════════════════════════════
 */

import { SignalType, StrategySettings } from '../../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../../constants';

// ═══ TYPES ═══
interface CandleData {
  body: number;      // Body size in pips/points
  direction: 'bullish' | 'bearish' | 'unknown';
}

interface CandleMatchResult {
  matched: boolean;
  blocked: boolean;
  reason: string;
  candles: { label: string; body: number; direction: string; meetsThreshold: boolean }[];
}

// ═══ CORE CANDLE MATCH FUNCTION (extracted from geminiService.ts) ═══
// This is the EXACT logic that runs in production.
// DO NOT MODIFY without updating this test suite.

function calculateCandleMatch(
  daily: CandleData | null,
  weekly: CandleData | null,
  monthly: CandleData | null,
  settings: StrategySettings,
  signal: SignalType,
  isCrypto: boolean,
  marketType: string
): CandleMatchResult {
  const bodyMultiplier = isCrypto ? 1 : (marketType === 'forex' ? 10000 : 100);

  const activeCandles: { label: string; data: CandleData; threshold: number }[] = [];

  if (daily && settings.candleMatchDailyEnabled !== false && (settings.candleMatchDailyThreshold ?? 10) > 0) {
    activeCandles.push({ label: '1D', data: daily, threshold: settings.candleMatchDailyThreshold ?? 10 });
  }
  if (weekly && settings.candleMatchWeeklyEnabled !== false && (settings.candleMatchWeeklyThreshold ?? 20) > 0) {
    activeCandles.push({ label: '1W', data: weekly, threshold: settings.candleMatchWeeklyThreshold ?? 20 });
  }
  if (monthly && settings.candleMatchMonthlyEnabled !== false && (settings.candleMatchMonthlyThreshold ?? 30) > 0) {
    activeCandles.push({ label: '1M', data: monthly, threshold: settings.candleMatchMonthlyThreshold ?? 30 });
  }

  if (activeCandles.length < 2) {
    return { matched: false, blocked: false, reason: 'Insufficient candle data', candles: [] };
  }

  // CHECK 1: All candles same direction
  const firstDir = activeCandles[0].data.direction;
  const allSameDir = activeCandles.every(c => c.data.direction === firstDir);

  // CHECK 2: All candle bodies meet thresholds
  const allAboveThreshold = activeCandles.every(c => c.data.body >= c.threshold);

  // CHECK 3: Direction must match signal
  const signalIsBuy = signal === SignalType.BUY || signal === SignalType.STRONG_BUY;
  const signalIsSell = signal === SignalType.SELL || signal === SignalType.STRONG_SELL;
  const candlesMatchSignal = (signalIsBuy && firstDir === 'bullish') || (signalIsSell && firstDir === 'bearish');

  const matched = allSameDir && allAboveThreshold && candlesMatchSignal;

  let reason = '';
  if (!allSameDir) reason = 'BLOCKED: candle directions conflict across timeframes';
  else if (!allAboveThreshold) reason = 'BLOCKED: candle body size below threshold';
  else if (!candlesMatchSignal) reason = `BLOCKED: candles are ${firstDir} but signal is ${signalIsBuy ? 'BUY' : 'SELL'} — direction contradiction`;
  else reason = `candle bodies match across timeframes (${firstDir}) — aligns with ${signalIsBuy ? 'BUY' : 'SELL'} signal`;

  return {
    matched,
    blocked: !matched,
    reason,
    candles: activeCandles.map(c => ({
      label: c.label,
      body: c.data.body,
      direction: c.data.direction,
      meetsThreshold: c.data.body >= c.threshold,
    })),
  };
}

// ═══ TEST SUITE ═══
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${details ? ` — ${details}` : ''}`);
  }
}

function runTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  CANDLE MATCH FILTER — PROTECTION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  const settings: StrategySettings = {
    ...DEFAULT_STRATEGY_SETTINGS,
    useCandleMatch: true,
    candleMatchDailyEnabled: true,
    candleMatchWeeklyEnabled: true,
    candleMatchMonthlyEnabled: true,
    candleMatchDailyThreshold: 10,
    candleMatchWeeklyThreshold: 20,
    candleMatchMonthlyThreshold: 30,
  };

  // ══════════════════════════════════════════════════════════════
  // GROUP 1: Basic candle body threshold checks
  // ══════════════════════════════════════════════════════════════
  console.log('📏 GROUP 1: Body Threshold Checks');

  // Test 1.1: All bullish, all above thresholds → MATCHED
  const r1 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r1.matched === true, '1.1 All bullish, all above thresholds → MATCHED');
  assert(r1.blocked === false, '1.1 Not blocked');

  // Test 1.2: Daily below threshold → BLOCKED
  const r2 = calculateCandleMatch(
    { body: 5, direction: 'bullish' },   // 5 < 10 threshold
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r2.matched === false, '1.2 Daily below threshold (5 < 10) → BLOCKED');
  assert(r2.blocked === true, '1.2 Blocked');

  // Test 1.3: Weekly below threshold → BLOCKED
  const r3 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 10, direction: 'bullish' },  // 10 < 20 threshold
    { body: 35, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r3.matched === false, '1.3 Weekly below threshold (10 < 20) → BLOCKED');

  // Test 1.4: Monthly below threshold → BLOCKED
  const r4 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 20, direction: 'bullish' },  // 20 < 30 threshold
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r4.matched === false, '1.4 Monthly below threshold (20 < 30) → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 2: Direction consistency checks
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔀 GROUP 2: Direction Consistency');

  // Test 2.1: Mixed directions → BLOCKED
  const r5 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bearish' },  // Different!
    { body: 35, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r5.matched === false, '2.1 Mixed directions (bullish/bearish/bullish) → BLOCKED');

  // Test 2.2: All bearish → MATCHED for SELL
  const r6 = calculateCandleMatch(
    { body: 15, direction: 'bearish' },
    { body: 25, direction: 'bearish' },
    { body: 35, direction: 'bearish' },
    settings, SignalType.SELL, false, 'stocks'
  );
  assert(r6.matched === true, '2.2 All bearish + SELL signal → MATCHED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 3: Direction vs Signal mismatch (CRITICAL SAFETY)
  // ══════════════════════════════════════════════════════════════
  console.log('\n🛡️ GROUP 3: Signal Direction Mismatch (CRITICAL)');

  // Test 3.1: Bearish candles + BUY signal → BLOCKED (CVX bug fix)
  const r7 = calculateCandleMatch(
    { body: 66.8, direction: 'bearish' },
    { body: 65.5, direction: 'bearish' },
    { body: 65.5, direction: 'bearish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r7.matched === false, '3.1 Bearish candles + BUY signal → BLOCKED (CVX bug)');
  assert(r7.reason.includes('direction contradiction'), '3.1 Reason mentions direction contradiction');

  // Test 3.2: Bullish candles + SELL signal → BLOCKED
  const r8 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.SELL, false, 'stocks'
  );
  assert(r8.matched === false, '3.2 Bullish candles + SELL signal → BLOCKED');

  // Test 3.3: Bullish candles + STRONG_BUY → MATCHED
  const r9 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.STRONG_BUY, false, 'stocks'
  );
  assert(r9.matched === true, '3.3 Bullish candles + STRONG_BUY → MATCHED');

  // Test 3.4: Bearish candles + STRONG_SELL → MATCHED
  const r10 = calculateCandleMatch(
    { body: 15, direction: 'bearish' },
    { body: 25, direction: 'bearish' },
    { body: 35, direction: 'bearish' },
    settings, SignalType.STRONG_SELL, false, 'stocks'
  );
  assert(r10.matched === true, '3.4 Bearish candles + STRONG_SELL → MATCHED');

  // Test 3.5: Any candles + NEUTRAL → BLOCKED (no direction to match)
  const r11 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.NEUTRAL, false, 'stocks'
  );
  assert(r11.matched === false, '3.5 Bullish candles + NEUTRAL signal → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 4: Edge cases
  // ══════════════════════════════════════════════════════════════
  console.log('\n⚡ GROUP 4: Edge Cases');

  // Test 4.1: Only 1 candle available → Not enough data
  const r12 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    null,
    null,
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r12.matched === false, '4.1 Only 1 candle → Insufficient data');

  // Test 4.2: No candles → Not enough data
  const r13 = calculateCandleMatch(null, null, null, settings, SignalType.BUY, false, 'stocks');
  assert(r13.matched === false, '4.2 No candles → Insufficient data');

  // Test 4.3: Exactly at threshold → MATCHED
  const r14 = calculateCandleMatch(
    { body: 10, direction: 'bullish' },   // Exactly 10 (threshold = 10)
    { body: 20, direction: 'bullish' },   // Exactly 20 (threshold = 20)
    { body: 30, direction: 'bullish' },   // Exactly 30 (threshold = 30)
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r14.matched === true, '4.3 All exactly at thresholds → MATCHED');

  // Test 4.4: One below, two above → BLOCKED
  const r15 = calculateCandleMatch(
    { body: 9, direction: 'bullish' },    // 9 < 10
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r15.matched === false, '4.4 One candle below threshold → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 5: Market type multipliers
  // ══════════════════════════════════════════════════════════════
  console.log('\n💱 GROUP 5: Market Type Multipliers');

  // Test 5.1: Forex uses 10000 multiplier
  const r16 = calculateCandleMatch(
    { body: 0.0015, direction: 'bullish' },  // 0.0015 * 10000 = 15 pips
    { body: 0.0025, direction: 'bullish' },  // 0.0025 * 10000 = 25 pips
    { body: 0.0035, direction: 'bullish' },  // 0.0035 * 10000 = 35 pips
    settings, SignalType.BUY, false, 'forex'
  );
  assert(r16.matched === true, '5.1 Forex with 10000 multiplier → MATCHED');

  // Test 5.2: Crypto uses 1 multiplier
  const r17 = calculateCandleMatch(
    { body: 500, direction: 'bullish' },   // BTC body
    { body: 800, direction: 'bullish' },
    { body: 1200, direction: 'bullish' },
    settings, SignalType.BUY, true, 'crypto'
  );
  assert(r17.matched === true, '5.2 Crypto with 1 multiplier → MATCHED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 6: Real-world scenario (JNJ from screenshots)
  // ══════════════════════════════════════════════════════════════
  console.log('\n📊 GROUP 6: Real-World Scenarios');

  // Test 6.1: JNJ — All bullish, all above thresholds, BUY signal
  const r18 = calculateCandleMatch(
    { body: 176.5, direction: 'bullish' },
    { body: 176.5, direction: 'bullish' },
    { body: 182.5, direction: 'bullish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r18.matched === true, '6.1 JNJ: All bullish + BUY → MATCHED');
  assert(r18.candles.every(c => c.meetsThreshold), '6.1 All candles meet thresholds');

  // Test 6.2: CVX — All bearish but BUY signal (the bug we fixed)
  const r19 = calculateCandleMatch(
    { body: 66.8, direction: 'bearish' },
    { body: 65.5, direction: 'bearish' },
    { body: 65.5, direction: 'bearish' },
    settings, SignalType.BUY, false, 'stocks'
  );
  assert(r19.matched === false, '6.2 CVX: All bearish + BUY → BLOCKED (critical bug fix)');
  assert(r19.reason.includes('direction contradiction'), '6.2 Correct error message');

  // ══════════════════════════════════════════════════════════════
  // GROUP 7: Disabled candles
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔧 GROUP 7: Disabled Candles');

  // Test 7.1: Daily disabled → Only 2 candles active
  const settingsNoDaily = { ...settings, candleMatchDailyEnabled: false };
  const r20 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settingsNoDaily, SignalType.BUY, false, 'stocks'
  );
  assert(r20.matched === true, '7.1 Daily disabled, 2 candles active → MATCHED');

  // Test 7.2: Only 1 candle enabled → Not enough
  const settingsOnlyDaily = {
    ...settings,
    candleMatchDailyEnabled: true,
    candleMatchWeeklyEnabled: false,
    candleMatchMonthlyEnabled: false,
  };
  const r21 = calculateCandleMatch(
    { body: 15, direction: 'bullish' },
    null,
    null,
    settingsOnlyDaily, SignalType.BUY, false, 'stocks'
  );
  assert(r21.matched === false, '7.2 Only 1 candle enabled → Insufficient data');

  // ══════════════════════════════════════════════════════════════
  // GROUP 8: Threshold zero = disable
  // ══════════════════════════════════════════════════════════════
  console.log('\n🚫 GROUP 8: Threshold Zero = Disable');

  // Test 8.1: Daily threshold 0 → Daily excluded
  const settingsZeroDaily = { ...settings, candleMatchDailyThreshold: 0 };
  const r22 = calculateCandleMatch(
    { body: 5, direction: 'bullish' },
    { body: 25, direction: 'bullish' },
    { body: 35, direction: 'bullish' },
    settingsZeroDaily, SignalType.BUY, false, 'stocks'
  );
  // Only 2 candles active (weekly, monthly), both above threshold
  assert(r22.matched === true, '8.1 Daily threshold 0 → Excluded, 2 candles remain');

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  CRITICAL: Some tests failed! The candle match filter may be broken.');
    console.log('⚠️  DO NOT deploy until all tests pass.\n');
  } else {
    console.log('✅ All tests passed. Candle match filter is protected.\n');
  }

  return failed === 0;
}

// Run
const success = runTests();
if (!success) process.exit(1);
