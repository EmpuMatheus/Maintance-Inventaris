# ANALYTICS — Algorithms

This document describes the deterministic algorithms behind the Advanced
Analytics module (health score, repeated-failure detection and replacement
recommendations). All weights and thresholds are configurable via environment
variables (see docs/ENVIRONMENT.md).

## Asset Health Score (0-100)

The health score is a weighted average of seven factor scores, each bounded to
0-100. The same asset facts always produce the same score (deterministic).

### Factors

| Factor | Score formula | Weight env |
|--------|---------------|------------|
| Age | `100 × (1 − ageYears / expectedLifespanYears)`, clamped 0-100; ageYears from `purchase_date` (falls back to `created_at`) | `ANALYTICS_WEIGHT_AGE` (20) |
| Maintenance frequency | `100 − max(0, completedMaintenance − expected) × 8`, where `expected = round(ageYears × 2)` | `ANALYTICS_WEIGHT_MAINTENANCE` (20) |
| Failure ratio | `100 × (1 − correctiveMaintenance / max(completedMaintenance,1))` | `ANALYTICS_WEIGHT_FAILURE_RATIO` (15) |
| Condition | `GOOD=100, FAIR=80, NEED_ATTENTION=55, BROKEN=25, CRITICAL=5, RETIRED=0` | `ANALYTICS_WEIGHT_CONDITION` (20) |
| Downtime | `100 − downtimeHours × 1.5`, clamped 0-100; downtime from completed maintenance `downtime_minutes` (or `finish_date − start_date`) | `ANALYTICS_WEIGHT_DOWNTIME` (10) |
| Tickets | `100 − ticketCount × 6`, clamped 0-100 | `ANALYTICS_WEIGHT_TICKETS` (10) |
| Critical events | `100 − criticalEventCount × 12`, clamped 0-100; critical events = condition history transitions to `BROKEN`/`CRITICAL` | `ANALYTICS_WEIGHT_CRITICAL_EVENTS` (5) |

### Combination

```
score = round( Σ(weightᵢ × scoreᵢ) / Σ(weightᵢ) ),  clamped to [0, 100]
```

### Category

| Score | Category |
|-------|----------|
| ≥ 85  | Excellent |
| 70-84 | Good |
| 55-69 | Fair |
| 40-54 | Poor |
| < 40  | Critical |

The latest score and `health_score_updated_at` are persisted on the asset and
recalculated automatically by the background scheduler
(`ANALYTICS_RECALC_INTERVAL_MINUTES`, default 1440).

## Repeated Failure Detection

An asset is flagged `repeated_failure = true` when **any** of the following is
true (thresholds configurable):

- Corrective (failure) repairs ≥ `ANALYTICS_FAILURE_THRESHOLD` (default 3)
- Tickets ≥ `ANALYTICS_TICKET_THRESHOLD` (default 3)
- Abnormal maintenance frequency: `completedMaintenance / ageYears ≥ 6` per year

A `REPEATED_FAILURE` timeline event is recorded only when the flag changes from
false to true (deduplicated within `ANALYTICS_FAILURE_WINDOW_DAYS`, default 90).

## Replacement Recommendation

Each asset receives one recommendation and a risk level.

| Recommendation | Conditions (first match wins) | Risk |
|----------------|-------------------------------|------|
| **Replace Immediately** | `healthScore < ANALYTICS_REPLACE_IMMEDIATE_HEALTH` (35) OR condition is `BROKEN`/`CRITICAL` | Critical/High |
| **Replace Soon** | `healthScore < ANALYTICS_REPLACE_SOON_HEALTH` (50) OR age ≥ 85% of lifespan OR maintenance cost ≥ `ANALYTICS_REPLACE_COST_RATIO` (0.5) of purchase price OR failures ≥ threshold+2 | High |
| **Repair** | `healthScore < ANALYTICS_REPAIR_HEALTH` (65) OR failures ≥ threshold OR downtime ≥ 1 day | Medium |
| **Monitor** | `healthScore < 80` OR age ≥ 60% of lifespan | Low |
| **Keep** | otherwise | Low |

The `reason` is a human-readable list of the driving factors. A
`REPLACEMENT_RECOMMENDED` event is recorded when the recommendation crosses a
threshold for an asset (deduplicated within the failure window).

## Fleet metrics (dashboard)

- **MTBF (days)** = total asset age (days) ÷ total corrective repairs
- **MTTR (minutes)** = average `finish_date − start_date` across completed maintenance
- **Repeated failures** = assets with `repeated_failure = true`
- **Replacement candidates** = assets recommended *Replace Soon* or *Replace Immediately*
