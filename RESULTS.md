# Benchmark Results

Latest comprehensive performance comparison between ClickHouse (OLAP) and PostgreSQL (OLTP) using LLM query patterns.

## Test Environment

- **Machine**: Apple M3 Pro, 18GB RAM
- **Docker Containers**: 
  - ClickHouse server (port 8123)
  - PostgreSQL 15 without indexes (port 5432)
  - PostgreSQL 15 with indexes (port 5433)
- **Resource Allocation**: Each container limited to 4GB RAM and 2 CPUs for fair comparison
- **Dataset**: Aircraft tracking records (46 columns each) with realistic telemetry data

## Summary Results

| Dataset Size | Winner (Load Test) | Winner (Query Test) | ClickHouse Advantage |
|--------------|-------------------|-------------------|---------------------|
| 10K | PostgreSQL (no-idx) 9.3ms | PostgreSQL (idx) 5.5ms | 1.8x slower |
| 50K | ClickHouse 17.8ms | ClickHouse 9.8ms | 2.1x faster |
| 100K | ClickHouse 21.9ms | ClickHouse 13.1ms | 3.4x faster |
| 500K | ClickHouse 49.4ms | ClickHouse 15.9ms | 7.3x faster |
| 1M | ClickHouse 44.8ms | ClickHouse 20.7ms | 16.7x faster |
| 5M | ClickHouse 62.0ms | ClickHouse 31.1ms | 34.8x faster |
| 10M | ClickHouse 192.6ms | ClickHouse 41.4ms | 52.8x faster |

*Last updated: 8/1/2025, 12:12:55 PM*

## Key Insights

1. **Crossover Point**: ClickHouse becomes faster than PostgreSQL at ~25K-50K records
2. **Scaling Pattern**: ClickHouse advantage increases dramatically with dataset size
3. **Small Dataset Penalty**: PostgreSQL (especially with indexes) outperforms ClickHouse on small datasets
4. **Index Impact**: PostgreSQL indexes provide 1.3-2.0x speedup but still lose to ClickHouse at scale

## Detailed Results by Dataset Size

*Last updated: 8/4/2025, 9:44:20 AM*

### 2025/08/01 23:01:38

#### Load Test Results

*Source: test-results_2025-08-01_23-01-38.json*

**200K Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (33.0ms total)
- **ClickHouse (no-idx)**: 33.0ms queries + 0.0s setup
  - Query breakdown: Q1: 8.5ms, Q2: 8.8ms, Q3: 9.0ms, Q4: 6.7ms
- **PostgreSQL (idx)**: 102.0ms queries + 0.0s setup
  - Query breakdown: Q1: 3.2ms, Q2: 1.6ms, Q3: 69.3ms, Q4: 27.9ms
- **PostgreSQL (no-idx)**: 179.3ms queries + 0.0s setup
  - Query breakdown: Q1: 3.9ms, Q2: 1.9ms, Q3: 120.0ms, Q4: 53.5ms



## Query Breakdown

The LLM query pattern simulates: *"How many aircraft are in the air on average every minute for the past hour?"*

1. **Q1 (Discovery)**: `SHOW TABLES` / `information_schema` queries
2. **Q2 (Exploration)**: `SELECT * LIMIT 10` to understand data structure  
3. **Q3 (Analysis)**: Hourly aircraft counts with time bucketing and filtering
4. **Q4 (Calculation)**: CTE-based average calculation across time periods

## Statistical Analysis

All query test results include:
- **100 iterations** per configuration for statistical significance
- **95% confidence intervals** using t-distribution approximation
- **Standard deviation** showing consistency of performance
- **Timeout protection** (60-minute limit per database configuration)

## Visualizations

Generate interactive performance graphs:

```bash
npm run graphs                    # Terminal display
npm run graphs -- --update-readme # Update this file with latest results
```

## Raw Data

Complete results with individual query timings available in:
- `output/test-results.json` - Detailed timing data
- `output/test-results.csv` - Spreadsheet format
- CSV includes confidence intervals for statistical analysis