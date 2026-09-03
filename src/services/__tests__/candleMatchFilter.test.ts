/**
 * ═══════════════════════════════════════════════════════════════════
 * CANDLE MATCH FILTER — COMPREHENSIVE TEST SUITE
 * ═══════════════════════════════════════════════════════════════════
 *
 * CRITICAL INVARIANTS (DO NOT CHANGE WITHOUT REVIEW):
 *
 * 1. REVERSAL PREVENTION — the signal is BLOCKED ONLY when BOTH the
 *    weekly (1W) AND monthly (1M) candles oppose the signal direction.
 *    e.g. BUY is blocked only if 1W AND 1M are both bearish.
 *    If only ONE of them opposes (or the daily aligns), the signal stays.
 * 2. Candle direction MUST match signal direction when reversing:
 *    BUY → blocked if 1W+1M both bearish. SELL → blocked if 1W+1M both bullish.
 * 3. The greedy Candle Size (ATR) filter has been REMOVED entirely.
 * 4. If the reversal filter fails → the signal MUST NOT be shown.
 * ═══════════════════════════════════════════════════════════════════
 */

import { SignalType, StrategySettings } from '../../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../../constants';

// ═══ TYPES ═══
interface CandleData {
  direction: 'bullish' | 'bearish' | 'unknown';
}

interface CandleMatchResult {
  matched: boolean;
  blocked: boolean;
  reason: string;
  candles: { label: string; direction: string }[];
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
    { label: '1D', data: daily, enabled: settings.candleMatchDailyEnabled !== false },
    { label: '1W', data: weekly, enabled: settings.candleMatchWeeklyEnabled !== false },
    { label: '1M', data: monthly, enabled: settings.candleMatchMonthlyEnabled !== false },
  ];

  const signalIsBuy = signal === SignalType.BUY || signal === SignalType.STRONG_BUY;
  const signalIsSell = signal === SignalType.SELL || signal === SignalType.STRONG_SELL;

  // ── FILTER A: Reversal prevention — block ONLY when 1W AND 1M both oppose ──
  const directionFilterOn = settings.candleDirectionFilter !== false;
  let directionOk = true;
  let directionReason = '';
  if (directionFilterOn) {
    const dirFrames = frames.filter(f => f.enabled && f.data && f.data!.direction !== 'unknown');
    const weekly = dirFrames.find(f => f.label === '1W');
    const monthly = dirFrames.find(f => f.label === '1M');
    if (weekly && monthly) {
      const weeklyBearish = weekly.data!.direction === 'bearish';
      const weeklyBullish = weekly.data!.direction === 'bullish';
      const monthlyBearish = monthly.data!.direction === 'bearish';
      const monthlyBullish = monthly.data!.direction === 'bullish';
      if (signalIsBuy && weeklyBearish && monthlyBearish) {
        directionOk = false;
        directionReason = '1W & 1M both bearish oppose BUY — reversal risk';
      } else if (signalIsSell && weeklyBullish && monthlyBullish) {
        directionOk = false;
        directionReason = '1W & 1M both bullish oppose SELL — reversal risk';
      }
    } else {
      directionReason = '1W and 1M candle data required';
    }
  }

  const matched = !directionFilterOn || directionOk;
  const blocked = !matched;

  let reason = '';
  if (blocked) {
    reason = `BLOCKED: ${directionReason}`;
  } else {
    reason = '1W & 1M do not both oppose the signal — allowed';
  }

  return {
    matched,
    blocked,
    reason,
    candles: frames.filter(f => f.data).map(f => ({
      label: f.label,
      direction: f.data!.direction,
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
  console.log('  CANDLE MATCH FILTER — REVERSAL PREVENTION TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  const settings: StrategySettings = {
    ...DEFAULT_STRATEGY_SETTINGS,
    useCandleMatch: true,
    candleDirectionFilter: true,
    candleMatchDailyEnabled: true,
    candleMatchWeeklyEnabled: true,
    candleMatchMonthlyEnabled: true,
  };

  // ══════════════════════════════════════════════════════════════
  // GROUP 1: BUY signal — blocked only when 1W AND 1M both bearish
  // ══════════════════════════════════════════════════════════════
  console.log('🛑 GROUP 1: BUY — reversal prevention');

  // Test 1.1: 1W bearish + 1M bearish + daily bullish → BLOCKED
  const r1 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },  // 1W opposes
    { direction: 'bearish' },  // 1M opposes
    settings, SignalType.BUY
  );
  assert(r1.matched === false, '1.1 1W+1M both bearish, daily bullish → BLOCKED');
  assert(r1.reason.includes('both bearish'), '1.1 Reason: both bearish');

  // Test 1.2: 1W bearish + 1M bullish → NOT blocked (only one opposes)
  const r2 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },  // 1W opposes
    { direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r2.matched === true, '1.2 Only 1W bearish, 1M bullish → ALLOWED');

  // Test 1.3: 1W bullish + 1M bearish → NOT blocked (only one opposes)
  const r3 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bullish' },
    { direction: 'bearish' },  // 1M opposes
    settings, SignalType.BUY
  );
  assert(r3.matched === true, '1.3 Only 1M bearish, 1W bullish → ALLOWED');

  // Test 1.4: All bullish → NOT blocked
  const r4 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bullish' },
    { direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r4.matched === true, '1.4 All bullish → ALLOWED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 2: SELL signal — blocked only when 1W AND 1M both bullish
  // ══════════════════════════════════════════════════════════════
  console.log('\n🛑 GROUP 2: SELL — reversal prevention');

  // Test 2.1: 1W bullish + 1M bullish → BLOCKED
  const r5 = calculateCandleMatch(
    { direction: 'bearish' },
    { direction: 'bullish' },  // 1W opposes
    { direction: 'bullish' },  // 1M opposes
    settings, SignalType.SELL
  );
  assert(r5.matched === false, '2.1 1W+1M both bullish, daily bearish → BLOCKED');

  // Test 2.2: 1W bullish + 1M bearish → ALLOWED (only one opposes)
  const r6 = calculateCandleMatch(
    { direction: 'bearish' },
    { direction: 'bullish' },  // 1W opposes
    { direction: 'bearish' },
    settings, SignalType.SELL
  );
  assert(r6.matched === true, '2.2 Only 1W bullish, 1M bearish → ALLOWED');

  // Test 2.3: All bearish → ALLOWED
  const r7 = calculateCandleMatch(
    { direction: 'bearish' },
    { direction: 'bearish' },
    { direction: 'bearish' },
    settings, SignalType.SELL
  );
  assert(r7.matched === true, '2.3 All bearish → ALLOWED');

  // ══════════════════════════════════════════════════════════════
  // GROUP 3: Direction vs Signal mismatch (CRITICAL SAFETY)
  // ══════════════════════════════════════════════════════════════
  console.log('\n🛡️ GROUP 3: Critical Reversal Scenarios');

  // Test 3.1: BUY signal but 1W+1M both bearish → BLOCKED (CVX-style bug)
  const r8 = calculateCandleMatch(
    { direction: 'bearish' },
    { direction: 'bearish' },
    { direction: 'bearish' },
    settings, SignalType.BUY
  );
  assert(r8.matched === false, '3.1 BUY + 1W&1M both bearish → BLOCKED (reversal)');

  // Test 3.2: BUY signal, only daily bearish, 1W+1M bullish → ALLOWED
  const r9 = calculateCandleMatch(
    { direction: 'bearish' },  // daily opposes but doesn't matter
    { direction: 'bullish' },
    { direction: 'bullish' },
    settings, SignalType.BUY
  );
  assert(r9.matched === true, '3.2 BUY + only daily bearish → ALLOWED (daily no longer blocks)');

  // Test 3.3: NEUTRAL signal → never reversed/blocked by candles
  const r10 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },
    { direction: 'bearish' },
    settings, SignalType.NEUTRAL
  );
  assert(r10.matched === true, '3.3 NEUTRAL signal → not blocked by candles');

  // ══════════════════════════════════════════════════════════════
  // GROUP 4: Missing / insufficient data
  // ══════════════════════════════════════════════════════════════
  console.log('\n⚡ GROUP 4: Missing / Insufficient Data');

  // Test 4.1: Missing monthly → cannot evaluate both, default ALLOWED (lenient)
  const r11 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },
    null,
    settings, SignalType.BUY
  );
  assert(r11.matched === true, '4.1 Missing 1M → ALLOWED (lenient, keeps signal)');

  // Test 4.2: No candles at all → ALLOWED (cannot prove reversal)
  const r12 = calculateCandleMatch(null, null, null, settings, SignalType.BUY);
  assert(r12.matched === true, '4.2 No candles → ALLOWED (no reversal detected)');

  // ══════════════════════════════════════════════════════════════
  // GROUP 5: Filter disabled
  // ══════════════════════════════════════════════════════════════
  console.log('\n🔓 GROUP 5: Filter Disabled');

  // Test 5.1: Direction filter OFF → nothing blocked
  const settingsNoDir = { ...settings, candleDirectionFilter: false };
  const r13 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },
    { direction: 'bearish' },
    settingsNoDir, SignalType.BUY
  );
  assert(r13.matched === true && r13.blocked === false, '5.1 Direction filter OFF → no block');

  // Test 5.2: STRONG_BUY with both 1W+1M bearish → BLOCKED
  const r14 = calculateCandleMatch(
    { direction: 'bullish' },
    { direction: 'bearish' },
    { direction: 'bearish' },
    settings, SignalType.STRONG_BUY
  );
  assert(r14.matched === false, '5.2 STRONG_BUY + 1W&1M both bearish → BLOCKED');

  // ══════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (failed > 0) {
    console.log('⚠️  CRITICAL: Some tests failed! The reversal prevention filter may be broken.');
    console.log('⚠️  DO NOT deploy until all tests pass.\n');
  } else {
    console.log('✅ All tests passed. Reversal prevention filter is protected.\n');
  }

  return failed === 0;
}

// Run
const success = runTests();
if (!success) process.exit(1);
