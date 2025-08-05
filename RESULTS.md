# Benchmark Results

Performance comparison: ClickHouse (OLAP) vs PostgreSQL (OLTP).

## Test Environment

- Apple M3 Pro, 18GB RAM
- Docker: 4GB RAM, 2 CPUs per container
- ClickHouse (8123), PostgreSQL no-idx (5432), PostgreSQL idx (5433)
- Dataset: 46-column aircraft tracking records

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

- Crossover: ~25K-50K records
- ClickHouse advantage scales exponentially
- PostgreSQL wins on small datasets (<25K)
- Indexes: 1.3-2.0x speedup, insufficient at scale

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



## Query Pattern

LLM simulation: "How many aircraft are in the air on average every minute for the past hour?"

1. Q1: Table discovery
2. Q2: Schema exploration (LIMIT 10)
3. Q3: Hourly counts
4. Q4: Average calculation

## Methodology

- 100 iterations per test
- 95% CI (t-distribution)
- 60-minute timeout protection
- Full statistics in CSV output

## Output

```bash
npm run generate-graphs    # ASCII visualization
```

Raw data: `output/test-results.{json,csv}`