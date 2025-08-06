# Database Performance Lessons: Comparing PostgreSQL and ClickHouse

## TL;DR: Key Learnings

1. **Dataset size determines winner**: PostgreSQL faster <50K rows, ClickHouse faster >50K rows (16.8x at 10M)
2. **ORDER BY in OLAP is physical storage**: Changed ClickHouse query time from 4191ms to 75ms at 10M rows
3. **Type precision matters more in OLAP**: 15% storage reduction, 10-15% query improvement
4. **Bulk loading architectures differ**: PostgreSQL needs client parallelism (25x speedup), ClickHouse optimizes internally
5. **NULL handling philosophy**: ClickHouse treats missing as zero (better compression, faster aggregates), PostgreSQL preserves NULL semantics
6. **Native functions matter**: 20-30% performance improvement over generic SQL
7. **Memory limits are critical**: Both databases failed unpredictably with <2GB RAM

## Introduction
This documents my first attempt at benchmarking databases. I compared PostgreSQL (OLTP) and ClickHouse (OLAP) using aircraft tracking data to understand the user experience of "chatting" with an LLM that refers to different database types. The process revealed several differences between row-based and columnar databases.

## 1. Type Systems and Storage

### Initial Implementation (commit 3e9fd31)
Started with generic types in both databases:
- PostgreSQL: `DOUBLE PRECISION` for most numeric fields
- ClickHouse: Mixed approach with some specific types

### Observations
- ClickHouse benefits from precise type definitions: `UInt8`, `Float32`, `FixedString(6)`
- PostgreSQL's flexible typing worked well for initial development
- Storage difference: ~15% reduction with specific types in ClickHouse
- Query performance: 10-15% improvement with proper types

### Practical Takeaway
Type precision had measurable impact in ClickHouse (15% storage, 10-15% query improvement) but minimal noticeable difference in PostgreSQL for this workload. Columnar compression and analytics queries appear to benefit more from precise types.

### Code Example
```sql
-- commit 3e9fd31: Initial implementation
CREATE TABLE performance_test (
  -- ClickHouse: Mixed approach
  approach UInt8,
  hex FixedString(6),
  lat Float64,
  alt_baro Int32,
  
  -- PostgreSQL: Generic types
  approach BOOLEAN,
  hex VARCHAR(6), 
  lat DOUBLE PRECISION,
  alt_baro DOUBLE PRECISION
)

-- Result: 15% storage reduction in ClickHouse, minimal difference in PostgreSQL
```

## 2. Physical Data Organization

### ORDER BY Evolution (commits 710212a → 8924b53)
Tried three approaches:
1. `ORDER BY (timestamp, hex)` - chronological ordering
2. `ORDER BY (alt_baro_is_ground, timestamp, hex)` - filter column first
3. `ORDER BY (alt_baro_is_ground, hex, timestamp)` - optimized for COUNT(DISTINCT)

### Results
- Query times for 10M rows improved from 4191ms to 75ms
- ORDER BY in ClickHouse determines physical storage layout
- PostgreSQL uses indexes instead, allowing multiple access patterns

### Practical Takeaway
In columnar databases, ORDER BY is permanent and affects all queries. Choose carefully based on primary access patterns.

### Code Example
```sql
-- commit 710212a: Initial chronological approach
CREATE TABLE performance_test (
  ...
) ENGINE = MergeTree()
ORDER BY (timestamp, hex)

-- commit 8924b53: Optimized for query patterns
CREATE TABLE performance_test (
  ...
) ENGINE = MergeTree()  
-- Optimized ORDER BY: low cardinality filter column first (boolean),
-- then aircraft ID for better clustering and uniq(hex) performance,
-- finally timestamp for temporal ordering within each aircraft
ORDER BY (alt_baro_is_ground, hex, timestamp)

-- Result: Query times improved from 4191ms to 75ms at 10M rows
```

## 3. Bulk Insert Performance

### Implementation Progress
1. **Individual inserts**: Projected 7.5 hours for 10M records
2. **Batch size 100**: 80 minutes (limited by parameter count concerns)
3. **Batch size 50,000**: 30 minutes (after calculating actual limits)
4. **4 parallel workers**: 18 minutes final time

### Key Findings
- PostgreSQL parameter limit: 65,535 (practical limit ~60,000)
- PostgreSQL benefited from parallel connections (4 workers = 3-4x speedup)
- ClickHouse showed minimal improvement with parallel inserts
- Both databases maintained consistent insert rates regardless of table size

### Practical Takeaway
OLTP databases benefit from client-side parallelism. OLAP databases already optimize bulk operations internally.

### Code Example
```javascript
// commit 3e9fd31: Individual inserts (projected 7.5 hours for 10M)
for (const record of records) {
  await client.query('INSERT INTO table VALUES ($1, $2, $3...)', record);
}

// commit fde3baf: Bulk VALUES clause (30 minutes for 10M)
const maxParams = 60000; // PostgreSQL limit: 65,535
const batchSize = Math.floor(maxParams / columnCount);
const placeholders = records.map((_, i) => 
  `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
).join(', ');
await client.query(`INSERT INTO table VALUES ${placeholders}`, values);

// commit fde3baf: Parallel workers (18 minutes for 10M)
const workers = Array(4).fill(null).map(() => new Worker('insert-worker.js'));
// Result: 25x improvement in PostgreSQL, minimal gain in ClickHouse
```

## 4. NULL Handling Differences (commit 1ac99b1)

### Implementation
- ClickHouse: `nav_qnh UInt16 DEFAULT 0`
- PostgreSQL: `nav_qnh DOUBLE PRECISION` (NULLable)

### Observed Behavior
- ClickHouse AVG() includes zero values
- PostgreSQL AVG() excludes NULL values
- This produces different results for the same logical query

### Practical Takeaway
Default values instead of NULLs improve performance through better compression, simpler memory layout, and faster vectorized operations. The trade-off is semantic precision: can't distinguish "zero" from "missing".

### Code Example
```sql
-- commit 1ac99b1: Schema design differences
-- ClickHouse: Default values for performance
CREATE TABLE performance_test (
  nav_qnh UInt16 DEFAULT 0,           -- Missing = 0
  nav_altitude_mcp UInt16 DEFAULT 0,  -- Missing = 0
  nav_heading UInt16 DEFAULT 0        -- Missing = 0
)

-- PostgreSQL: NULL semantics preserved
CREATE TABLE performance_test (
  nav_qnh DOUBLE PRECISION,           -- Missing = NULL
  nav_altitude_mcp DOUBLE PRECISION,  -- Missing = NULL  
  nav_heading DOUBLE PRECISION        -- Missing = NULL
)

-- Query results differ:
-- ClickHouse: AVG([1, 2, 0, 4]) = 1.75 (includes zero)
-- PostgreSQL: AVG([1, 2, NULL, 4]) = 2.33 (excludes NULL)
```

## 5. Query Syntax and Functions (commit bf9f8c2)

### Different Approaches
```sql
-- PostgreSQL
COUNT(DISTINCT hex)              -- Exact count
date_trunc('hour', timestamp)    -- Generic SQL
WHERE alt_baro_is_ground = false -- Boolean type

-- ClickHouse  
uniq(hex)                        -- Approximate count
toStartOfHour(timestamp)         -- Native function
WHERE alt_baro_is_ground = 0     -- Numeric comparison
```

### Performance Impact
- Approximate functions in ClickHouse: 40x faster for large datasets
- Native date functions: 20-30% improvement over generic SQL
- `uniq()` accuracy: 99%+ typical (0.08% error in our 1M row test with 5000 unique values)
- ClickHouse provides `uniqExact()` when precision is required
- Trade-off acceptable for analytics, not for financial/compliance use cases

### Practical Takeaway
Database-specific functions exist for performance reasons. The trade-off between accuracy and speed is often worthwhile for analytics.

### Code Example
```sql
-- commit bf9f8c2: Optimized queries for each database
-- PostgreSQL: Exact and generic
SELECT
  date_trunc('hour', timestamp) AS hour_bucket,
  COUNT(DISTINCT hex) AS unique_aircraft_count,  -- Exact count
  avg(alt_baro) AS avg_altitude
FROM performance_test
WHERE timestamp >= '2025-01-01'::timestamp
  AND alt_baro_is_ground = false               -- Boolean type
GROUP BY date_trunc('hour', timestamp);

-- ClickHouse: Approximate and native
SELECT
  toStartOfHour(timestamp) AS hour_bucket,
  uniq(hex) AS unique_aircraft_count,          -- Approximate (99%+ accuracy)
  avg(alt_baro) AS avg_altitude
FROM performance_test  
WHERE timestamp >= '2025-01-01'
  AND alt_baro_is_ground = 0                   -- Numeric comparison
GROUP BY hour_bucket;

-- Result: 40x faster approximate count, 20-30% faster with native functions
```

## 6. Performance by Dataset Size

### Benchmark Results
| Rows | ClickHouse | PostgreSQL | PG + Index | Fastest |
|------|------------|------------|------------|---------|
| 10K  | 27.9ms     | 16.6ms     | 12.9ms     | PG+Idx  |
| 50K  | 75.5ms     | 87.0ms     | 60.5ms     | CH      |
| 100K | 60.5ms     | 125.1ms    | 141.5ms    | CH      |
| 1M   | 121.1ms    | 974.1ms    | 1066.7ms   | CH      |
| 10M  | 452.9ms    | 12,201ms   | 7,595ms    | CH      |

### Observations
- Crossover point around 25-50K rows
- PostgreSQL indexes helped until ~500K rows
- Index performance degraded with dataset size
- ClickHouse performance scaled linearly

### Practical Takeaway
Row-based databases excel at small datasets. Columnar databases show advantages as data grows. The UX impact becomes noticeable around 500K-1M rows where query times exceed 1 second - beyond this threshold, users lose the feeling of "flow" in their interaction (see UX Response Time Appendix). Whether supporting a second database is worthwhile depends on query frequency, user tolerance, and operational complexity - highly subjective to each use case.

### Code Example
```bash
# Same queries, different performance by dataset size
# 10K rows: PostgreSQL wins
npm start -- DATASET_SIZE=10000
# Result: PG+Idx (12.9ms) vs ClickHouse (27.9ms)

# 1M rows: ClickHouse wins  
npm start -- DATASET_SIZE=1000000
# Result: ClickHouse (121.1ms) vs PG+Idx (1066.7ms)

# The crossover: ~50K rows where performance is similar
```

## 7. Connection Management (commit ae1971b)

### Issues Encountered
- Docker containers hitting memory limits
- Connections dropping during long inserts
- Need for retry logic with exponential backoff

### Solution
```javascript
// Exponential backoff: 1s, 2s, 4s...
await new Promise(resolve => 
  setTimeout(resolve, Math.pow(2, i) * 1000)
);
```

### Practical Takeaway
Production systems need connection pooling and retry logic, especially for long-running operations.

### Code Example
```javascript
// commit ae1971b: Added connection resilience
// Before: Basic connection, failed on long operations
await this.client.connect();

// After: Retry logic with exponential backoff
async connectWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.connect();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)  // 1s, 2s, 4s
      );
    }
  }
}

// Connection pooling for PostgreSQL
this.pool = new Pool({ max: 10, idleTimeoutMillis: 30000 });
```

## 8. Index Strategies

### PostgreSQL Implementation
Created three indexes:
- `idx_timestamp`: Time-based queries
- `idx_hex_timestamp`: Aircraft tracking
- `idx_lat_lon`: Spatial queries

Results: 1.3-2x improvement on average
Insert cost: Index creation added ~30% overhead to bulk loading time

### ClickHouse Implementation
Single ORDER BY clause, no traditional indexes
Insert cost: No additional overhead - data sorted once during insertion

### Practical Takeaway
OLTP databases offer flexibility through multiple indexes. OLAP databases require upfront decisions about access patterns.

### Code Example
```sql
-- PostgreSQL: Multiple indexes for flexibility
CREATE INDEX IF NOT EXISTS idx_performance_test_timestamp 
ON performance_test (timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_test_hex_timestamp 
ON performance_test (hex, timestamp);

CREATE INDEX IF NOT EXISTS idx_performance_test_lat_lon 
ON performance_test (lat, lon);

-- Cost: 30% slower bulk loading, storage overhead
-- Benefit: 1.3-2x query improvement, flexible access patterns

-- ClickHouse: Single ORDER BY, no traditional indexes  
CREATE TABLE performance_test (
  ...
) ENGINE = MergeTree()
ORDER BY (alt_baro_is_ground, hex, timestamp);

-- Cost: Must choose ORDER BY carefully, no flexibility after creation
-- Benefit: No insert overhead, optimal for chosen access pattern
```

## Summary of Findings

1. **Type precision matters more in columnar databases** due to full column scans
2. **ORDER BY in OLAP is physical storage**, not just logical ordering
3. **Bulk loading reveals architectural differences**: OLTP needs client optimization, OLAP handles it internally
4. **NULL handling differs by design**: OLTP preserves semantics, OLAP optimizes for speed
5. **Native functions improve performance** by 20-30% over generic SQL
6. **Dataset size determines optimal choice**: <50K rows favor OLTP, >50K favor OLAP
7. **Indexes have diminishing returns** as datasets grow
8. **Connection management is critical** for production workloads

## Notes on Methodology

This was my first database benchmarking project. The test setup used:
- Docker containers with equal resources (4GB RAM, 2 CPUs)
- 46-column aircraft tracking dataset
- 100 iterations per test for statistical significance
- Single machine (M3 Pro) to eliminate network variables

Limitations include single-node testing only and a specific query pattern that may not represent all workloads.

## Appendix: Infrastructure and Testing Lessons

### Docker Resource Management
- **Memory limits**: Both databases failed unpredictably with <2GB RAM
- **CPU allocation**: 2 CPUs sufficient, more didn't help for this workload
- **Volume cleanup**: Docker volumes accumulated between test runs (commit 54ef5b6)
- **Container startup time**: ClickHouse ~15 seconds, PostgreSQL ~5 seconds

### Test Infrastructure Evolution
- **Statistical methodology** (commit 3a243bd): Added 100-iteration testing with confidence intervals
- **Timeout protection** (commit c115a77): 60-minute limits prevented hanging tests
- **Checkpoint system**: Resume capability for long-running bulk tests
- **Progress tracking**: Multi-database progress bars for visual feedback

### Development Workflow Insights
- **Incremental testing**: Started with 10K rows, scaled to 10M
- **Git history as documentation**: Each commit represents a testable hypothesis
- **Environment variables**: Extensive configuration needed for fair comparisons
- **Cleanup automation**: Manual cleanup led to inconsistent results

### Performance Testing Gotchas
- **Cold cache effects**: First query run often 2-3x slower
- **Memory pressure**: Performance degraded sharply above 85% memory usage  
- **Container networking**: All containers on same host eliminated network variables
- **Parallel test isolation**: Separate databases prevented interference

### Reproducibility Requirements
- **Seeded random data**: Same dataset across all test runs
- **Docker resource limits**: Prevented one database from using more resources
- **Container restart**: Fresh state for each test configuration
- **Fixed batch sizes**: Consistent insertion patterns across databases

## Appendix: Why ClickHouse Uses Zero Defaults Instead of NULLs

### Technical Reasons
1. **Compression efficiency**: Columns full of zeros compress much better than sparse NULL columns
2. **Vectorized operations**: CPUs can process arrays of zeros faster than checking for NULL flags
3. **Memory layout**: No need for separate NULL bitmap alongside data columns
4. **Aggregate functions**: `SUM(column)` can run without NULL checks in tight loops

### OLAP Use Case Alignment
- Analytics often treats "no data" as "zero events" (e.g., zero sales, zero visits)
- Time series data with gaps logically means "nothing happened" = zero
- Business metrics: missing revenue data usually means $0, not unknown

### Effects on Users

**Positive Effects:**
- **Faster queries**: No NULL checking overhead in aggregations
- **Simpler mental model**: "No data recorded" = zero is intuitive for metrics
- **Better compression**: Smaller storage and faster I/O

**Negative Effects:**
- **Different results from PostgreSQL**: Same query, different answers
- **Can't distinguish "zero" from "missing"**: Important for some analytics
- **Migration surprises**: Existing SQL queries may behave differently

### Practical Example
```sql
-- Same data, different results
-- PostgreSQL: AVG([1, 2, NULL, 4]) = 2.33 (excludes NULL)
-- ClickHouse: AVG([1, 2, 0, 4]) = 1.75 (includes zero)
```

The trade-off is **semantic purity vs performance**. ClickHouse chose speed for analytics workloads where the distinction often doesn't matter.

## Appendix: UX Response Time Thresholds

### Research-Based Thresholds
**Nielsen, Jakob** established the foundational UX response time thresholds:

1. **100 milliseconds (0.1 seconds)** - Instantaneous threshold
2. **1 second** - Flow interruption threshold (users lose sense of control)  
3. **10 seconds** - Attention limit

Source: "Response Times: The 3 Important Limits" (Nielsen Norman Group)  
https://www.nngroup.com/articles/response-times-3-important-limits/

### Supporting Research
These thresholds are consistently referenced in subsequent UX research:

- Doherty, Walter J. & Thadani, Ahrvind J. (1982) - "Computer Response Time: A User Productivity Study" (IBM Systems Journal)
- Nielsen Norman Group - "Powers of 10: Time Scales in User Experience"
- Laws of UX - "Doherty Threshold"
- Henty, Steve - "UI Response Times" (Medium)
- Kim, Moses - "Milliseconds matter. How time builds UX" (Shakuro/Medium)

---

*Full implementation and results: [github.com/oatsandsugar/LLM-query-test](https://github.com/oatsandsugar/LLM-query-test)*