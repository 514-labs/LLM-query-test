# Benchmark Results

Performance comparison: ClickHouse (OLAP) vs PostgreSQL (OLTP).

## Test Environment

- Apple M3 Pro, 18GB RAM
- Docker: 4GB RAM, 2 CPUs per container
- ClickHouse (8123), PostgreSQL no-idx (5432), PostgreSQL idx (5433)
- Dataset: 46-column aircraft tracking records

## Key Insights

- Crossover: ~25K-50K records
- ClickHouse advantage scales exponentially
- PostgreSQL wins on small datasets (<25K)
- Indexes: 1.3-2.0x speedup, insufficient at scale

## Detailed Results by Dataset Size

### Performance Overview

📊 Performance Overview by Dataset Size
| Size | ClickHouse (ms) | PostgreSQL+Idx (ms) | PostgreSQL (ms) | CH Advantage |
|------|-----------------|---------------------|-----------------|--------------|
| 10K  | 27.9            | 12.9                | 16.6            | 2.2x slower  |
| 50K  | 75.5            | 60.5                | 87.0            | Similar      |
| 100K | 60.5            | 141.5               | 125.1           | 2.3x faster  |
| 500K | 75.3            | 490.6               | 615.3           | 6.5x faster  |
| 1M   | 121.1           | 1066.7              | 974.1           | 8.8x faster  |
| 5M   | 415.7           | 4053.6              | 5850.7          | 9.8x faster  |
| 10M  | 452.9           | 7594.9              | 12201.1         | 16.8x faster |

```
Total (all queries combined):
Legend: █ Q1 ▓ Q2 ▒ Q3 ░ Q4
  10K CH       │ 27.9 ms
  10K PG       │ 16.6 ms
  10K PG w/Idx │ 12.9 ms

  50K CH       │ 75.5 ms
  50K PG       │ 87.0 ms
  50K PG w/Idx │ 60.5 ms

  100K CH      │ 60.5 ms
  100K PG      │ 125.1 ms
  100K PG w/Idx │ 141.5 ms

  500K CH      │ 75.3 ms
  500K PG      │▓▒ 615.3 ms
  500K PG w/Idx │▒░ 490.6 ms

  1M CH        │ 121.1 ms
  1M PG        │▓▒░ 974.1 ms
  1M PG w/Idx  │▒▒▒░░ 1066.7 ms

  5M CH        │▓░ 415.7 ms
  5M PG        │▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░ 5850.7 ms
  5M PG w/Idx  │▒▒▒▒▒▒▒▒▒▒▒░░░░░░ 4053.6 ms

  10M CH       │▓░ 452.9 ms
  10M PG       │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░ 12201.1 ms
  10M PG w/Idx │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░ 7594.9 ms

```


*Last updated: 8/5/2025, 11:03:03 AM*

### 2025/08/05 04:51:32

#### Load Test Results

*Source: test-results_2025-08-05_04-51-32.json*

**10K Dataset:**

- **Fastest Overall**: PostgreSQL (idx) (12.9ms total)
- **ClickHouse (no-idx)**: 27.9ms queries + 0.0s setup
  - Query breakdown: Q1: 8.3ms, Q2: 6.8ms, Q3: 7.1ms, Q4: 5.8ms
- **PostgreSQL (idx)**: 12.9ms queries + 0.0s setup
  - Query breakdown: Q1: 3.1ms, Q2: 1.6ms, Q3: 5.7ms, Q4: 2.5ms
- **PostgreSQL (no-idx)**: 16.6ms queries + 0.0s setup
  - Query breakdown: Q1: 2.5ms, Q2: 6.0ms, Q3: 4.1ms, Q4: 4.1ms


### 2025/08/05 04:52:16

#### Load Test Results

*Source: test-results_2025-08-05_04-52-16.json*

**50K Dataset:**

- **Fastest Overall**: PostgreSQL (idx) (60.5ms total)
- **ClickHouse (no-idx)**: 75.5ms queries + 0.0s setup
  - Query breakdown: Q1: 15.7ms, Q2: 20.4ms, Q3: 24.5ms, Q4: 14.9ms
- **PostgreSQL (idx)**: 60.5ms queries + 0.0s setup
  - Query breakdown: Q1: 11.8ms, Q2: 6.5ms, Q3: 31.0ms, Q4: 11.2ms
- **PostgreSQL (no-idx)**: 87.0ms queries + 0.0s setup
  - Query breakdown: Q1: 7.2ms, Q2: 36.5ms, Q3: 23.3ms, Q4: 20.0ms


### 2025/08/05 04:53:13

#### Load Test Results

*Source: test-results_2025-08-05_04-53-13.json*

**100K Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (60.5ms total)
- **ClickHouse (no-idx)**: 60.5ms queries + 0.0s setup
  - Query breakdown: Q1: 16.0ms, Q2: 21.5ms, Q3: 11.6ms, Q4: 11.2ms
- **PostgreSQL (idx)**: 141.5ms queries + 0.0s setup
  - Query breakdown: Q1: 20.1ms, Q2: 5.1ms, Q3: 90.3ms, Q4: 26.0ms
- **PostgreSQL (no-idx)**: 125.1ms queries + 0.0s setup
  - Query breakdown: Q1: 6.3ms, Q2: 34.3ms, Q3: 42.9ms, Q4: 41.6ms


### 2025/08/05 04:54:51

#### Load Test Results

*Source: test-results_2025-08-05_04-54-51.json*

**500K Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (75.3ms total)
- **ClickHouse (no-idx)**: 75.3ms queries + 0.0s setup
  - Query breakdown: Q1: 15.9ms, Q2: 35.2ms, Q3: 13.4ms, Q4: 10.8ms
- **PostgreSQL (idx)**: 490.6ms queries + 0.0s setup
  - Query breakdown: Q1: 13.6ms, Q2: 2.0ms, Q3: 288.4ms, Q4: 186.5ms
- **PostgreSQL (no-idx)**: 615.3ms queries + 0.0s setup
  - Query breakdown: Q1: 18.6ms, Q2: 281.7ms, Q3: 204.0ms, Q4: 110.9ms


### 2025/08/05 04:58:34

#### Load Test Results

*Source: test-results_2025-08-05_04-58-34.json*

**1M Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (121.1ms total)
- **ClickHouse (no-idx)**: 121.1ms queries + 0.0s setup
  - Query breakdown: Q1: 32.8ms, Q2: 49.7ms, Q3: 18.1ms, Q4: 20.6ms
- **PostgreSQL (idx)**: 1066.7ms queries + 0.0s setup
  - Query breakdown: Q1: 16.7ms, Q2: 2.1ms, Q3: 611.7ms, Q4: 436.2ms
- **PostgreSQL (no-idx)**: 974.1ms queries + 0.0s setup
  - Query breakdown: Q1: 56.2ms, Q2: 353.2ms, Q3: 275.4ms, Q4: 289.3ms


### 2025/08/05 05:10:00

#### Load Test Results

*Source: test-results_2025-08-05_05-10-00.json*

**5M Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (415.7ms total)
- **ClickHouse (no-idx)**: 415.7ms queries + 0.0s setup
  - Query breakdown: Q1: 83.6ms, Q2: 145.9ms, Q3: 61.4ms, Q4: 124.8ms
- **PostgreSQL (idx)**: 4053.6ms queries + 0.0s setup
  - Query breakdown: Q1: 31.7ms, Q2: 4.6ms, Q3: 2606.9ms, Q4: 1410.5ms
- **PostgreSQL (no-idx)**: 5850.7ms queries + 0.0s setup
  - Query breakdown: Q1: 27.6ms, Q2: 3071.3ms, Q3: 1472.5ms, Q4: 1279.3ms


### 2025/08/05 05:40:30

#### Load Test Results

*Source: test-results_2025-08-05_05-40-30.json*

**10M Dataset:**

- **Fastest Overall**: ClickHouse (no-idx) (452.9ms total)
- **ClickHouse (no-idx)**: 452.9ms queries + 0.0s setup
  - Query breakdown: Q1: 68.7ms, Q2: 132.6ms, Q3: 75.3ms, Q4: 176.2ms
- **PostgreSQL (idx)**: 7594.9ms queries + 0.0s setup
  - Query breakdown: Q1: 31.2ms, Q2: 5.7ms, Q3: 4191.2ms, Q4: 3366.8ms
- **PostgreSQL (no-idx)**: 12201.1ms queries + 0.0s setup
  - Query breakdown: Q1: 21.7ms, Q2: 4444.7ms, Q3: 4085.5ms, Q4: 3649.2ms


### 2025/08/05 04:51:36

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_04-51-36.json*

**10K Dataset** (100 iterations each):

- **Fastest (median)**: PostgreSQL (idx) (7.5ms total)
- **ClickHouse (no-idx)**: 10.9ms ±1.1ms
  - Q1: median=1.7ms, mean=1.9ms ±0.6 CI95=[1.7-2.0]
  - Q2: median=3.0ms, mean=3.3ms ±0.8 CI95=[3.1-3.4]
  - Q3: median=3.0ms, mean=3.3ms ±0.9 CI95=[3.1-3.4]
  - Q4: median=3.1ms, mean=3.5ms ±2.3 CI95=[3.1-4.0]
- **PostgreSQL (idx)**: 7.5ms ±0.4ms
  - Q1: median=0.8ms, mean=0.9ms ±0.4 CI95=[0.8-1.0]
  - Q2: median=0.6ms, mean=0.7ms ±0.3 CI95=[0.6-0.7]
  - Q3: median=4.0ms, mean=4.2ms ±0.6 CI95=[4.0-4.3]
  - Q4: median=2.1ms, mean=2.2ms ±0.4 CI95=[2.1-2.3]
- **PostgreSQL (no-idx)**: 13.7ms ±0.5ms
  - Q1: median=0.9ms, mean=0.9ms ±0.4 CI95=[0.9-1.0]
  - Q2: median=4.9ms, mean=4.9ms ±0.5 CI95=[4.8-5.0]
  - Q3: median=3.9ms, mean=4.0ms ±0.5 CI95=[3.9-4.1]
  - Q4: median=4.1ms, mean=4.1ms ±0.6 CI95=[4.0-4.3]


### 2025/08/05 04:52:26

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_04-52-26.json*

**50K Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (14.7ms total)
- **ClickHouse (no-idx)**: 14.7ms ±1.2ms
  - Q1: median=1.8ms, mean=1.9ms ±0.5 CI95=[1.8-2.0]
  - Q2: median=5.0ms, mean=5.2ms ±1.0 CI95=[5.0-5.4]
  - Q3: median=3.8ms, mean=4.1ms ±1.0 CI95=[3.9-4.2]
  - Q4: median=4.1ms, mean=4.5ms ±2.4 CI95=[4.1-5.0]
- **PostgreSQL (idx)**: 17.7ms ±0.8ms
  - Q1: median=0.9ms, mean=1.0ms ±0.6 CI95=[0.9-1.1]
  - Q2: median=0.8ms, mean=0.8ms ±0.2 CI95=[0.7-0.8]
  - Q3: median=7.8ms, mean=8.1ms ±1.0 CI95=[7.9-8.3]
  - Q4: median=8.3ms, mean=8.7ms ±1.3 CI95=[8.5-9.0]
- **PostgreSQL (no-idx)**: 56.8ms ±1.1ms
  - Q1: median=1.0ms, mean=1.1ms ±0.5 CI95=[1.0-1.2]
  - Q2: median=21.0ms, mean=21.2ms ±1.1 CI95=[21.0-21.5]
  - Q3: median=17.2ms, mean=17.4ms ±1.1 CI95=[17.2-17.6]
  - Q4: median=17.6ms, mean=18.0ms ±1.9 CI95=[17.7-18.4]


### 2025/08/05 04:53:35

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_04-53-35.json*

**100K Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (20.8ms total)
- **ClickHouse (no-idx)**: 20.8ms ±1.6ms
  - Q1: median=2.3ms, mean=2.5ms ±0.8 CI95=[2.3-2.6]
  - Q2: median=8.5ms, mean=8.9ms ±2.2 CI95=[8.4-9.3]
  - Q3: median=4.8ms, mean=5.1ms ±0.9 CI95=[4.9-5.3]
  - Q4: median=5.1ms, mean=5.6ms ±2.7 CI95=[5.1-6.2]
- **PostgreSQL (idx)**: 67.0ms ±2.6ms
  - Q1: median=1.5ms, mean=1.6ms ±0.4 CI95=[1.5-1.7]
  - Q2: median=0.9ms, mean=1.0ms ±0.4 CI95=[0.9-1.1]
  - Q3: median=41.7ms, mean=42.7ms ±4.3 CI95=[41.9-43.5]
  - Q4: median=22.8ms, mean=23.9ms ±5.3 CI95=[22.9-24.9]
- **PostgreSQL (no-idx)**: 101.3ms ±4.4ms
  - Q1: median=1.6ms, mean=1.7ms ±0.7 CI95=[1.6-1.8]
  - Q2: median=21.5ms, mean=23.3ms ±6.5 CI95=[22.1-24.6]
  - Q3: median=38.3ms, mean=39.4ms ±3.8 CI95=[38.6-40.1]
  - Q4: median=40.0ms, mean=41.5ms ±6.4 CI95=[40.2-42.8]


### 2025/08/05 04:56:29

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_04-56-29.json*

**500K Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (30.4ms total)
- **ClickHouse (no-idx)**: 30.4ms ±2.1ms
  - Q1: median=2.3ms, mean=2.5ms ±1.1 CI95=[2.3-2.7]
  - Q2: median=13.1ms, mean=13.5ms ±2.9 CI95=[12.9-14.1]
  - Q3: median=7.1ms, mean=7.3ms ±1.3 CI95=[7.1-7.6]
  - Q4: median=7.9ms, mean=8.5ms ±3.0 CI95=[7.9-9.1]
- **PostgreSQL (idx)**: 406.1ms ±17.5ms
  - Q1: median=1.8ms, mean=1.9ms ±0.6 CI95=[1.8-2.1]
  - Q2: median=1.1ms, mean=1.2ms ±0.5 CI95=[1.1-1.3]
  - Q3: median=198.6ms, mean=200.8ms ±10.3 CI95=[198.8-202.8]
  - Q4: median=204.5ms, mean=214.1ms ±58.8 CI95=[202.6-225.6]
- **PostgreSQL (no-idx)**: 500.5ms ±32.1ms
  - Q1: median=1.6ms, mean=2.3ms ±4.6 CI95=[1.4-3.3]
  - Q2: median=101.8ms, mean=103.6ms ±21.6 CI95=[99.4-107.8]
  - Q3: median=195.1ms, mean=207.3ms ±66.0 CI95=[194.3-220.2]
  - Q4: median=202.0ms, mean=209.1ms ±36.4 CI95=[202.0-216.3]


### 2025/08/05 05:01:13

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_05-01-13.json*

**1M Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (43.9ms total)
- **ClickHouse (no-idx)**: 43.9ms ±7.7ms
  - Q1: median=2.8ms, mean=3.1ms ±1.1 CI95=[2.9-3.3]
  - Q2: median=18.4ms, mean=22.6ms ±18.4 CI95=[19.0-26.2]
  - Q3: median=10.3ms, mean=11.1ms ±3.9 CI95=[10.4-11.9]
  - Q4: median=12.4ms, mean=14.2ms ±7.4 CI95=[12.8-15.7]
- **PostgreSQL (idx)**: 770.4ms ±42.6ms
  - Q1: median=1.8ms, mean=2.0ms ±1.3 CI95=[1.8-2.3]
  - Q2: median=1.1ms, mean=1.2ms ±0.5 CI95=[1.1-1.3]
  - Q3: median=376.3ms, mean=398.1ms ±127.2 CI95=[373.2-423.1]
  - Q4: median=391.2ms, mean=401.1ms ±41.3 CI95=[393.0-409.2]
- **PostgreSQL (no-idx)**: 690.1ms ±39.5ms
  - Q1: median=1.7ms, mean=1.9ms ±2.0 CI95=[1.5-2.3]
  - Q2: median=211.1ms, mean=216.6ms ±40.9 CI95=[208.6-224.6]
  - Q3: median=247.2ms, mean=257.0ms ±59.1 CI95=[245.4-268.6]
  - Q4: median=230.2ms, mean=242.2ms ±56.0 CI95=[231.3-253.2]


### 2025/08/05 05:21:24

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_05-21-24.json*

**5M Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (71.8ms total)
- **ClickHouse (no-idx)**: 71.8ms ±6.8ms
  - Q1: median=2.2ms, mean=2.5ms ±1.2 CI95=[2.3-2.7]
  - Q2: median=22.8ms, mean=23.8ms ±5.2 CI95=[22.8-24.8]
  - Q3: median=19.4ms, mean=19.7ms ±1.4 CI95=[19.5-20.0]
  - Q4: median=27.4ms, mean=30.1ms ±19.5 CI95=[26.2-33.9]
- **PostgreSQL (idx)**: 2492.6ms ±84.3ms
  - Q1: median=1.6ms, mean=1.7ms ±0.5 CI95=[1.6-1.8]
  - Q2: median=1.1ms, mean=1.1ms ±0.3 CI95=[1.0-1.2]
  - Q3: median=1215.9ms, mean=1290.5ms ±198.7 CI95=[1251.5-1329.4]
  - Q4: median=1274.1ms, mean=1333.3ms ±137.5 CI95=[1306.4-1360.3]
- **PostgreSQL (no-idx)**: 3891.3ms ±168.9ms
  - Q1: median=2.1ms, mean=2.6ms ±2.8 CI95=[2.0-3.1]
  - Q2: median=1226.2ms, mean=1313.8ms ±256.9 CI95=[1263.5-1364.2]
  - Q3: median=1292.0ms, mean=1363.7ms ±200.4 CI95=[1324.4-1403.0]
  - Q4: median=1371.0ms, mean=1432.4ms ±215.3 CI95=[1390.2-1474.6]


### 2025/08/05 06:07:21

#### Query Test Results (Statistical)

*Source: test-results_2025-08-05_06-07-21.json*

**10M Dataset** (100 iterations each):

- **Fastest (median)**: ClickHouse (no-idx) (115.3ms total)
- **ClickHouse (no-idx)**: 115.3ms ±8.8ms
  - Q1: median=2.4ms, mean=2.8ms ±1.7 CI95=[2.4-3.1]
  - Q2: median=32.6ms, mean=35.7ms ±13.4 CI95=[33.1-38.3]
  - Q3: median=31.6ms, mean=33.4ms ±5.1 CI95=[32.4-34.4]
  - Q4: median=48.7ms, mean=52.2ms ±15.0 CI95=[49.3-55.1]
- **PostgreSQL (idx)**: 6668.7ms ±365.2ms
  - Q1: median=2.3ms, mean=2.9ms ±1.8 CI95=[2.5-3.2]
  - Q2: median=1.3ms, mean=1.4ms ±0.5 CI95=[1.3-1.5]
  - Q3: median=2819.7ms, mean=3162.0ms ±858.2 CI95=[2993.8-3330.3]
  - Q4: median=3845.5ms, mean=4077.7ms ±600.1 CI95=[3960.1-4195.4]
- **PostgreSQL (no-idx)**: 8600.3ms ±184.7ms
  - Q1: median=4.4ms, mean=5.5ms ±4.6 CI95=[4.6-6.4]
  - Q2: median=2474.8ms, mean=2502.0ms ±261.1 CI95=[2450.8-2553.1]
  - Q3: median=3005.8ms, mean=3057.0ms ±243.4 CI95=[3009.3-3104.7]
  - Q4: median=3115.4ms, mean=3140.7ms ±229.7 CI95=[3095.7-3185.7]



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