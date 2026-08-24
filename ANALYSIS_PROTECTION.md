# ═══════════════════════════════════════════════════════════════════
# ANALYSIS SYSTEM — PROTECTION RULES
# ═══════════════════════════════════════════════════════════════════
# 
# This document defines the CRITICAL INVARIANTS of the analysis system.
# These rules MUST be maintained at all times.
# 
# Last updated: 2026-08-24
# ═══════════════════════════════════════════════════════════════════

## 1. CANDLE MATCH FILTER — CRITICAL INVARIANTS

### Rule 1: Direction Consistency
All active candles (daily, weekly, monthly) MUST have the same direction.
- If candles conflict → BLOCK → force NEUTRAL

### Rule 2: Threshold Compliance
Each active candle body MUST meet its configured threshold.
- Daily threshold: 10 pips (default)
- Weekly threshold: 20 pips (default)
- Monthly threshold: 30 pips (default)
- If any candle below threshold → BLOCK → force NEUTRAL

### Rule 3: Direction-Signal Alignment (CRITICAL SAFETY)
Candle direction MUST match signal direction:
- BUY signal → candles MUST be BULLISH
- SELL signal → candles MUST be BEARISH
- If bearish candles + BUY signal → BLOCK → force NEUTRAL
- If bullish candles + SELL signal → BLOCK → force NEUTRAL

### Rule 4: Confidence Cap
When candle match is blocked:
- finalSignal MUST be forced to NEUTRAL
- finalConfidence MUST be capped at 30

## 2. SIGNAL INTEGRITY

### Valid Signal Types
- STRONG_BUY
- BUY
- NEUTRAL
- SELL
- STRONG_SELL
- NO_ENTRY

### Direction Rules
- BUY/STRONG_BUY → direction must be "buy"
- SELL/STRONG_SELL → direction must be "sell"
- NEUTRAL/NO_ENTRY → direction can be null

## 3. CONFIDENCE RANGES

- Minimum: 0
- Maximum: 100
- When candle match blocked: maximum 30

## 4. TEST SUITE LOCATION

```
src/services/__tests__/candleMatchFilter.test.ts
```

Run tests before any deployment:
```bash
npx ts-node src/services/__tests__/candleMatchFilter.test.ts
```

## 5. VALIDATION MODULE

```
src/services/analysisGuard.ts
```

Use before analysis:
```typescript
import { validateCandleMatchInput, validateAnalysisResult } from './analysisGuard';

// Before analysis
const validation = validateCandleMatchInput({
  dailyBody: 15,
  dailyDirection: 'bullish',
  weeklyBody: 25,
  weeklyDirection: 'bullish',
  monthlyBody: 35,
  monthlyDirection: 'bullish',
  signal: SignalType.BUY,
  settings: settings,
  isCrypto: false,
  marketType: 'stocks'
});

if (!validation.valid) {
  console.error('Candle match validation failed:', validation.errors);
}
```

## 6. DEVELOPMENT RULES

1. **NEVER** modify candle match logic without updating test suite
2. **NEVER** remove direction-signal alignment check
3. **ALWAYS** run test suite before deployment
4. **ALWAYS** validate analysis results with analysisGuard
5. **LOG** all analysis errors for monitoring

## 7. DEBUGGING

If a signal shows BUY/SELL but candle match shows bearish/bullish:
1. Check `candleMatchBlocked` variable in geminiService.ts
2. Check final safety block at line ~1798
3. Run test suite: `npx ts-node src/services/__tests__/candleMatchFilter.test.ts`
4. Check analysisGuard logs: `getRecentEvents()`

## 8. MONITORING

Use `analysisGuard.ts` to monitor analysis health:
```typescript
import { getErrorRate, getRecentEvents } from './analysisGuard';

// Check error rate
const errorRate = getErrorRate();
if (errorRate > 0.1) {
  console.warn('Analysis error rate is high:', errorRate);
}

// Get recent events
const events = getRecentEvents();
console.log('Recent analysis events:', events);
```
