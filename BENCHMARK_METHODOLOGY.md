# Benchmark Methodology

This document explains the technical design decisions and methodology behind the LLM query performance testing.

## Database Design Differences

### NULL Handling Strategy

The benchmark intentionally preserves realistic database design differences between ClickHouse and PostgreSQL:

**ClickHouse (OLAP Best Practice):**
```sql
aircraft_type LowCardinality(String) DEFAULT '',
geom_rate Int16 DEFAULT 0,
nav_qnh UInt16 DEFAULT 0,
nav_altitude_mcp UInt16 DEFAULT 0,
nav_heading UInt16 DEFAULT 0
```

**PostgreSQL (OLTP Flexibility):**
```sql
aircraft_type VARCHAR(50) DEFAULT '',
geom_rate INTEGER,           -- Allows NULL
nav_qnh DOUBLE PRECISION,    -- Allows NULL  
nav_altitude_mcp INTEGER,    -- Allows NULL
nav_heading DOUBLE PRECISION -- Allows NULL
```

**Impact on Data:**
- **ClickHouse**: NULL values from data generator are converted to defaults (e.g., 0, '') 
- **PostgreSQL**: NULL values are preserved as actual NULLs
- **Result**: ~20% of records have NULLs in PostgreSQL vs 0% in ClickHouse for nullable fields

**Why This Is Intentional:**
- ClickHouse's DEFAULT strategy is optimal for analytical queries (avoids NULL handling overhead)
- PostgreSQL's NULL preservation is standard for transactional systems (data integrity)
- Represents real-world database design patterns, not a benchmarking flaw
- Performance comparisons remain valid as both databases handle their respective data optimally

## Query Optimization Strategy

The benchmark uses database-specific best practices rather than forcing identical queries:

**ClickHouse (OLAP Optimization):**
- Leverages columnar storage with `ORDER BY (timestamp, hex)` 
- Uses native ClickHouse functions and data types optimized for analytics
- Takes advantage of automatic query parallelization and vectorization
- Optimized for aggregate queries over large datasets

**PostgreSQL (OLTP Optimization):**
- Uses proper B-tree indexes for row-level lookups and range queries
- Leverages PostgreSQL's query planner for join optimization
- Optimized for transactional patterns and concurrent access
- Uses standard SQL for maximum compatibility

**Impact on Benchmarking:**
- Each database performs queries using its native strengths
- Results reflect real-world performance characteristics
- Shows how databases perform when used with appropriate optimization strategies
- More realistic than artificially identical queries that may not be optimal for either system

## Query Optimization Differences

Each database uses optimized queries that leverage its specific strengths rather than identical SQL:

### Q1: Table Discovery
```sql
-- ClickHouse (Direct metadata access)
SHOW TABLES

-- PostgreSQL (Standards-compliant metadata)
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
```

### Q2: Schema Exploration  
```sql
-- Both databases (Columnar selection, timestamp ordering)
SELECT hex, flight, aircraft_type, lat, lon, alt_baro, gs, track,
       timestamp, alt_baro_is_ground, nav_qnh, category
FROM performance_test ORDER BY timestamp DESC LIMIT 10
```

### Q3 & Q4: Time-Series Analytics
```sql
-- ClickHouse (OLAP-optimized)
SELECT
  toStartOfHour(timestamp) AS hour_bucket,
  uniq(hex) AS unique_aircraft_count     -- Faster cardinality estimation
FROM performance_test
WHERE alt_baro_is_ground = 0            -- Integer comparison (faster)
GROUP BY hour_bucket
ORDER BY hour_bucket ASC

-- PostgreSQL (OLTP-optimized) 
SELECT
  date_trunc('hour', timestamp) AS hour_bucket,
  count(DISTINCT hex) AS unique_aircraft_count  -- Exact DISTINCT count
FROM performance_test
WHERE alt_baro_is_ground = false               -- Boolean comparison (standard)
GROUP BY date_trunc('hour', timestamp)         -- Explicit GROUP BY (optimizer friendly)
ORDER BY hour_bucket ASC
```

**Key Differences:**
- **ClickHouse**: Uses `uniq()` for approximate cardinality (faster), integer boolean comparisons, implicit GROUP BY
- **PostgreSQL**: Uses exact `COUNT(DISTINCT)`, boolean comparisons, explicit GROUP BY for query planner
- **Time Functions**: `toStartOfHour()` vs `date_trunc()` - both optimized for their respective engines
- **Boolean Handling**: `= 0` vs `= false` reflects each database's internal boolean representation

These differences ensure each database performs optimally rather than being constrained by artificial query equivalence.

## Timestamp Consistency

Both databases receive identical timestamp values to ensure fair time-based comparisons:

**Format Used:** `'YYYY-MM-DD HH:MM:SS'` (no timezone, no milliseconds)
```sql
-- Example: '2024-08-01 14:30:00'
-- ClickHouse: Interpreted as DateTime (local time)
-- PostgreSQL: Stored as TIMESTAMP (no timezone)
```

**Why This Matters:**
- Ensures time range queries filter the same logical time periods
- Eliminates timezone interpretation differences between databases
- Maintains data consistency for accurate performance comparisons
- Both databases work with the same temporal dataset

## Statistical Improvements

The benchmark includes three key statistical enhancements to ensure reproducible and reliable results:

### 1. Deterministic Data Generation
- Uses seedrandom library for reproducible random data generation
- Same seed produces identical datasets across runs
- Configurable via `BENCHMARK_SEED` environment variable
- Eliminates data variance as a factor in performance differences

### 2. Database Warmup Period
- Each database runs all queries 3 times during warmup phase
- Warmup occurs after table setup but before benchmark timing
- Ensures database caches, query plans, and buffers are optimized
- Eliminates cold-start effects from measurements

### 3. 95% Confidence Intervals
- Statistical analysis includes confidence intervals using t-distribution approximation
- Formula: `mean ± (t-value × stdDev / √n)` where t=1.96 for n>30, t=2.0 for smaller samples
- Console output shows: `CI95=[lower-upper]` for query-only tests
- CSV exports include confidence interval columns for detailed analysis

## Memory & Connection Management

### Memory Optimization
- **Streaming Data Generation**: Parallel mode generates data in chunks on-the-fly (no full dataset in memory)
- **Large Dataset Warning**: Alerts when non-parallel mode generates >1GB datasets
- **Lazy Worker Creation**: Worker threads created on-demand instead of pre-allocated
- **Batch Processing**: Data generated and inserted in configurable chunks (default 50K records)

### Connection Resilience  
- **Retry Logic**: Both databases retry connections 3 times with exponential backoff
- **Worker Cleanup**: Database connections properly closed even on errors
- **Connection Pooling**: PostgreSQL uses configurable connection pool (max 20 connections)
- **Resource Limits**: Worker threads have configurable timeout (WORKER_TIMEOUT_MS)

### Best Practices
- For datasets >10M records, ensure adequate Docker memory allocation
- Monitor worker thread creation in logs during large inserts
- Use `PARALLEL_WORKERS` env var to control memory usage (default 4)
- Database connections are created per-worker for isolation