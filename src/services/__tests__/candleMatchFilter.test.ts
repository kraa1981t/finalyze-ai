/**
 * ═══════════════════════════════════════════════════════════════════
 * CANDLE MATCH FILTER — COMPREHENSIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * CRITICAL INVARIANTS (DO NOT CHANGE WITHOUT REVIEW):
 *
 * 1. DIRECTION UNIFICATION — the THREE timeframes (1D/1W/1M) MUST all be
 *    aligned in ONE direction (all bullish or all bearish). Two is NOT
 *    enough — all three are required.
 * 2. Candle direction MUST match signal direction:
 *    BUY → candles MUST be bullish, SELL → candles MUST be bearish.
 * 3. SIZE FILTER — the CURRENT (in-progress) candle body of each timeframe,
 *    measured as % of its own ATR(14), MUST meet its configured threshold
 *    (defaults: daily 15%, weekly 20%, monthly 30%).
 * 4. The two filters are INDEPENDENT — each can be enabled/disabled alone.
 * 5. If either active filter fails → the signal MUST NOT be shown.
 * ═══════════════════════════════════════════════════════════════════
 */

import { SignalType, StrategySettings } from '../../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../../constants';

// ═══ TYPES ═══
interface CandleData {
  pct: number;      // Current candle body size as % of its own ATR(14)
  direction: 'bullish' | 'bearish' | 'unknown';
}

interface CandleMatchResult {
  matched: boolean;
  blocked: boolean;
  reason: string;
  candles: { label: string; pct: number; direction: string; meetsThreshold: boolean }[];
}

// ═══ CORE CANDLE MATCH FUNCTION (mirrors geminiService.ts STEP 5e) ═══
// DO NOT MODIFY without updating this test suite.
function calculateCandleMatch(
  daily: CandleData | null,
  weekly: CandleData | null,
  monthly: CandleData | null,
  settings: StrategySettings,
  signal: SignalType,
): CandleMatchResult {
  const frames = [
    { label: '1D', data: daily, enabled: settings.candleMatchDailyEnabled !== false, threshold: settings.candleMatchDailyThreshold ?? 15 },
    { label: '1W', data: weekly, enabled: settings.candleMatchWeeklyEnabled !== false, threshold: settings.candleMatchWeeklyThreshold ?? 20 },
    { label: '1M', data: monthly, enabled: settings.candleMatchMonthlyEnabled !== false, threshold: settings.candleMatchMonthlyThreshold ?? 30 },
  ];

  const signalIsBuy = signal === SignalType.BUY || signal === SignalType.STRONG_BUY;
  const signalIsSell = signal === SignalType.SELL || signal === SignalType.STRONG_SELL;

  // ── FILTER A: Direction unification across the THREE timeframes ──
  const directionFilterOn = settings.candleDirectionFilter !== false;
  let directionOk = true;
  let directionReason = '';
  const dirFrames = frames.filter(f => f.enabled && f.data);
  if (directionFilterOn) {
    const enough = dirFrames.length === 3;
    const firstDir = dirFrames[0]?.data?.direction || null;
    const allSame = enough && dirFrames.every(f => f.data!.direction === firstDir);
    const dirMatch = firstDir === 'bullish' ? signalIsBuy : firstDir === 'bearish' ? signalIsSell : false;
    directionOk = enough && allSame && dirMatch;
    if (!enough) directionReason = 'needs all 3 timeframes (1D/1W/1M) with data';
    else if (!allSame) directionReason = 'candle directions conflict across the 3 timeframes';
    else if (!dirMatch) directionReason = `candles are ${firstDir}, signal is ${signalIsBuy ? 'BUY' : 'SELL'} — direction contradiction`;
  }

  // ── FILTER B: Size — current candle body vs its own ATR(14), as % ──
  const sizeFilterOn = settings.candleSizeFilter !== false;
  let sizeOk = true;
  const sizeFrames = frames.filter(f => f.enabled && f.threshold > 0 && f.data);
  if (sizeFilterOn) {
    sizeOk = sizeFrames.length > 0 && sizeFrames.every(f => f.data!.pct >= f.threshold);
  }

  const matched = (!directionFilterOn || directionOk) && (!sizeFilterOn || sizeOk);
  const blocked = !matched;

  let reason = '';
  if (blocked) {
    if (directionFilterOn && !directionOk) reason = `BLOCKED: ${directionReason}`;
    else if (sizeFilterOn && !sizeOk) reason = 'BLOCKED: candle size below threshold (% of ATR)';
    else reason = 'BLOCKED (no active filter)';
  } else {
    reason = 'all three candle directions aligned + sizes meet thresholds';
  }

  return {
    matched,
    blocked,
    reason,
    candles: dirFrames.filter(f => f.data).map(f => ({
      label: f.label,
      pct: f.data!.pct,
      direction: f.data!.direction,
      meetsThreshold: f.data!.pct >= f.threshold,
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
    candleDirectionFilter: true,
    candleSizeFilter: true,
    candleMatchDailyEnabled: true,
    candleMatchWeeklyEnabled: true,
    candleMatchMonthlyEnabled: true,
    candleMatchDailyThreshold: 15,
    candleMatchWeeklyThreshold: 20,
    candleMatchMonthlyThreshold: 30,
  };

  // ══════════════════════════════════════════════════════════════
  // GROUP 1: Size thresholds (% of ATR) — current candles
  // ══════════════════════════════════════════════════════════════
  console.log('📏 GROUP 1: Size Thresholds (% of ATR)');

  // Test 1.1: All bullish, all above thresholds → MATCHED
  const r1 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r1.matched === true, '1.1 All bullish, all above thresholds → MATCHED');
  assert(r1.blocked === false, '1.1 Not blocked');

  // Test 1.2: Daily below threshold → BLOCKED
  const r2 = calculateCandleMatch(
    { pct: 5, direction: 'bullish' },   // 5 < 15 threshold
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r2.matched === false, '1.2 Daily below threshold (5 < 15) → BLOCKED');
  assert(r2.blocked === true, '1.2 Blocked');

  // Test 1.3: Weekly below threshold → BLOCKED
  const r3 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 10, direction: 'bullish' },  // 10 < 20 threshold
    { pct: 35, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r3.matched === false, '1.3 Weekly below threshold (10 < 20) → BLOCKED');

  // Test 1.4: Monthly below threshold → BLOCKED
  const r4 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 20, direction: 'bullish' },  // 20 < 30 threshold
    settings, SignalType.BUY
  );
  assert(r4.matched === false, '1.4 Monthly below threshold (20 < 30) → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 2: Direction consistency — all THREE required
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔀 GROUP 2: Direction Consistency (3 timeframes)');

  // Test 2.1: Mixed directions → BLOCKED
  const r5 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bearish' },  // Different!
    { pct: 35, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r5.matched === false, '2.1 Mixed directions (bullish/bearish/bullish) → BLOCKED');

  // Test 2.2: All bearish → MATCHED for SELL
  const r6 = calculateCandleMatch(
    { pct: 15, direction: 'bearish' },
    { pct: 25, direction: 'bearish' },
    { pct: 35, direction: 'bearish' },
    settings, SignalType.SELL
  );
  assert(r6.matched === true, '2.2 All bearish + SELL signal → MATCHED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 3: Direction vs Signal mismatch (CRITICAL SAFETY)
  // ══════════════════════════════════════════════════════════════
  console.log('\n🛡️ GROUP 3: Signal Direction Mismatch (CRITICAL)');

  // Test 3.1: Bearish candles + BUY signal → BLOCKED (CVX bug fix)
  const r7 = calculateCandleMatch(
    { pct: 66.8, direction: 'bearish' },
    { pct: 65.5, direction: 'bearish' },
    { pct: 65.5, direction: 'bearish' },
    settings, SignalType.BUY
  );
  assert(r7.matched === false, '3.1 Bearish candles + BUY signal → BLOCKED (CVX bug)');
  assert(r7.reason.includes('direction contradiction'), '3.1 Reason mentions direction contradiction');

  // Test 3.2: Bullish candles + SELL signal → BLOCKED
  const r8 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.SELL
  );
  assert(r8.matched === false, '3.2 Bullish candles + SELL signal → BLOCKED');

  // Test 3.3: Bullish candles + STRONG_BUY → MATCHED
  const r9 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.STRONG_BUY
  );
  assert(r9.matched === true, '3.3 Bullish candles + STRONG_BUY → MATCHED');

  // Test 3.4: Bearish candles + STRONG_SELL → MATCHED
  const r10 = calculateCandleMatch(
    { pct: 15, direction: 'bearish' },
    { pct: 25, direction: 'bearish' },
    { pct: 35, direction: 'bearish' },
    settings, SignalType.STRONG_SELL
  );
  assert(r10.matched === true, '3.4 Bearish candles + STRONG_SELL → MATCHED');

  // Test 3.5: Any candles + NEUTRAL → BLOCKED (no direction to match)
  const r11 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.NEUTRAL
  );
  assert(r11.matched === false, '3.5 Bullish candles + NEUTRAL signal → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 4: Edge cases
  // ══════════════════════════════════════════════════════════════
  console.log('\n⚡ GROUP 4: Edge Cases');

  // Test 4.1: Only 1 candle available → Needs all three → BLOCKED
  const r12 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    null,
    null,
    settings, SignalType.BUY
  );
  assert(r12.matched === false, '4.1 Only 1 candle → BLOCKED (needs all 3)');

  // Test 4.2: Only 2 candles available → Not enough (must be 3)
  const r12b = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    null,
    settings, SignalType.BUY
  );
  assert(r12b.matched === false, '4.2 Only 2 candles → BLOCKED (all 3 required)');

  // Test 4.3: No candles → BLOCKED
  const r13 = calculateCandleMatch(null, null, null, settings, SignalType.BUY);
  assert(r13.matched === false, '4.3 No candles → BLOCKED');

  // Test 4.4: Exactly at threshold → MATCHED
  const r14 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },   // Exactly 15 (threshold = 15)
    { pct: 20, direction: 'bullish' },   // Exactly 20 (threshold = 20)
    { pct: 30, direction: 'bullish' },   // Exactly 30 (threshold = 30)
    settings, SignalType.BUY
  );
  assert(r14.matched === true, '4.4 All exactly at thresholds → MATCHED');

  // Test 4.5: One below, two above → BLOCKED
  const r15 = calculateCandleMatch(
    { pct: 14, direction: 'bullish' },    // 14 < 15
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r15.matched === false, '4.5 One candle below threshold → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 5: Normalized size — same thresholds across all markets
  // ══════════════════════════════════════════════════════════════
  console.log('\n💱 GROUP 5: Normalized (market-agnostic) sizes');
  // ATR-normalization means the same % threshold applies identically to
  // stocks, forex and crypto — no per-market multipliers needed anymore.
  const r16 = calculateCandleMatch(
    { pct: 25, direction: 'bullish' },
    { pct: 30, direction: 'bullish' },
    { pct: 40, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r16.matched === true, '5.1 Normalized pct passes for stocks/forex/crypto alike → MATCHED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 6: Real-world scenario (JNJ from screenshots)
  // ══════════════════════════════════════════════════════════════
  console.log('\n📊 GROUP 6: Real-World Scenarios');

  // Test 6.1: JNJ — All bullish, all above thresholds, BUY signal
  const r18 = calculateCandleMatch(
    { pct: 66.8, direction: 'bullish' },
    { pct: 66.8, direction: 'bullish' },
    { pct: 72.5, direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r18.matched === true, '6.1 JNJ: All bullish + BUY → MATCHED');
  assert(r18.candles.every(c => c.meetsThreshold), '6.1 All candles meet thresholds');

  // Test 6.2: CVX — All bearish but BUY signal (the bug we fixed)
  const r19 = calculateCandleMatch(
    { pct: 66.8, direction: 'bearish' },
    { pct: 65.5, direction: 'bearish' },
    { pct: 65.5, direction: 'bearish' },
    settings, SignalType.BUY
  );
  assert(r19.matched === false, '6.2 CVX: All bearish + BUY → BLOCKED (critical bug fix)');
  assert(r19.reason.includes('direction contradiction'), '6.2 Correct error message');

  // ══════════════════════════════════════════════════════════════
  // GROUP 7: Disabled candles — direction still needs all THREE
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔧 GROUP 7: Disabled Candles');

  // Test 7.1: Daily disabled → Only 2 candles → direction BLOCKED (needs 3)
  const settingsNoDaily = { ...settings, candleMatchDailyEnabled: false };
  const r20 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settingsNoDaily, SignalType.BUY
  );
  assert(r20.matched === false, '7.1 Daily disabled, 2 candles → BLOCKED (all 3 required)');
  assert(r20.reason.includes('needs all 3'), '7.1 Reason mentions needing all 3 timeframes');

  // Test 7.2: Only 1 candle enabled → Not enough
  const settingsOnlyDaily = {
    ...settings,
    candleMatchDailyEnabled: true,
    candleMatchWeeklyEnabled: false,
    candleMatchMonthlyEnabled: false,
  };
  const r21 = calculateCandleMatch(
    { pct: 15, direction: 'bullish' },
    null,
    null,
    settingsOnlyDaily, SignalType.BUY
  );
  assert(r21.matched === false, '7.2 Only 1 candle enabled → Insufficient data');

  // ══════════════════════════════════════════════════════════════
  // GROUP 8: Threshold zero = disable size only (direction still needs 3)
  // ══════════════════════════════════════════════════════════════
  console.log('\n🚫 GROUP 8: Threshold Zero = Disable Sizing');

  // Test 8.1: Daily threshold 0 → Daily excluded from size check only
  const settingsZeroDaily = { ...settings, candleMatchDailyThreshold: 0 };
  const r22 = calculateCandleMatch(
    { pct: 5, direction: 'bullish' },
    { pct: 25, direction: 'bullish' },
    { pct: 35, direction: 'bullish' },
    settingsZeroDaily, SignalType.BUY
  );
  assert(r22.matched === true, '8.1 Daily threshold 0 → Excluded from size, 3 directions OK → MATCHED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 9: Filters are INDEPENDENT
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔓 GROUP 9: Independent Filters');

  // Test 9.1: Direction OFF, size ON → mixed directions but sizes OK → MATCHED
  const settingsNoDir = { ...settings, candleDirectionFilter: false };
  const r23 = calculateCandleMatch(
    { pct: 25, direction: 'bullish' },
    { pct: 30, direction: 'bearish' },
    { pct: 40, direction: 'bullish' },
    settingsNoDir, SignalType.BUY
  );
  assert(r23.matched === true, '9.1 Direction OFF, size ON → MATCHED');

  // Test 9.2: Direction ON, size OFF → aligned directions but small bodies → MATCHED
  const settingsNoSize = { ...settings, candleSizeFilter: false };
  const r24 = calculateCandleMatch(
    { pct: 2, direction: 'bullish' },
    { pct: 3, direction: 'bullish' },
    { pct: 4, direction: 'bullish' },
    settingsNoSize, SignalType.BUY
  );
  assert(r24.matched === true, '9.2 Direction ON, size OFF → MATCHED');

  // Test 9.3: Both OFF → nothing blocks, neutral never forced by this step
  const settingsBothOff = { ...settings, candleDirectionFilter: false, candleSizeFilter: false };
  const r25 = calculateCandleMatch(
    { pct: 2, direction: 'bullish' },
    { pct: 3, direction: 'bearish' },
    { pct: 4, direction: 'bullish' },
    settingsBothOff, SignalType.BUY
  );
  assert(r25.matched === true && r25.blocked === false, '9.3 Both OFF → no block');

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