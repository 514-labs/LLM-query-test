# Benchmark Methodology

Technical design decisions and implementation details.

## Database Design Differences

### NULL Handling Strategy

Different NULL handling between databases:

**ClickHouse:**
```sql
aircraft_type LowCardinality(String) DEFAULT '',
geom_rate Int16 DEFAULT 0,
nav_qnh UInt16 DEFAULT 0,
nav_altitude_mcp UInt16 DEFAULT 0,
nav_heading UInt16 DEFAULT 0
```

**PostgreSQL:**
```sql
aircraft_type VARCHAR(50) DEFAULT '',
geom_rate INTEGER,           -- Allows NULL
nav_qnh DOUBLE PRECISION,    -- Allows NULL  
nav_altitude_mcp INTEGER,    -- Allows NULL
nav_heading DOUBLE PRECISION -- Allows NULL
```

**Impact:**
- ClickHouse: NULLs → defaults (0, '')
- PostgreSQL: NULLs preserved
- ~20% of PostgreSQL records contain NULLs vs 0% in ClickHouse

**Rationale:**
- ClickHouse avoids NULL overhead for analytics
- PostgreSQL maintains transactional data integrity
- Both follow database-specific best practices

## Query Optimization Strategy

Database-specific optimizations:

**ClickHouse:**
- Columnar storage with `ORDER BY (timestamp, hex)`
- Native functions (uniq, toStartOfHour)
- Automatic parallelization

**PostgreSQL:**
- B-tree indexes on timestamp and hex
- Standard SQL functions
- Query planner optimization

## Query Differences

### Q1: Table Discovery
```sql
-- ClickHouse
SHOW TABLES

-- PostgreSQL
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
```

### Q2: Schema Exploration  
```sql
SELECT hex, flight, aircraft_type, lat, lon, alt_baro, gs, track,
       timestamp, alt_baro_is_ground, nav_qnh, category
FROM performance_test ORDER BY timestamp DESC LIMIT 10
```

### Q3 & Q4: Time-Series Analytics
```sql
-- ClickHouse
SELECT
  toStartOfHour(timestamp) AS hour_bucket,
  uniq(hex) AS unique_aircraft_count
FROM performance_test
WHERE alt_baro_is_ground = 0
GROUP BY hour_bucket
ORDER BY hour_bucket ASC

-- PostgreSQL
SELECT
  date_trunc('hour', timestamp) AS hour_bucket,
  count(DISTINCT hex) AS unique_aircraft_count
FROM performance_test
WHERE alt_baro_is_ground = false
GROUP BY date_trunc('hour', timestamp)
ORDER BY hour_bucket ASC
```

**Differences:**
- `uniq()` vs `COUNT(DISTINCT)` - approximate vs exact
- `toStartOfHour()` vs `date_trunc()` - native time functions
- `= 0` vs `= false` - integer vs boolean comparison

## Timestamp Consistency

Format: `YYYY-MM-DD HH:MM:SS` (no timezone, no milliseconds)

Both databases receive identical timestamps for fair comparison.

## Statistical Rigor

### 1. Deterministic Data
- Seedrandom for reproducible datasets
- Configurable via `BENCHMARK_SEED`

### 2. Warmup
- 3x query execution before timing
- Eliminates cold-start effects

### 3. Confidence Intervals
- 95% CI using t-distribution
- Formula: `mean ± (t × stdDev / √n)`
- t=1.96 (n>30), t=2.0 (n≤30)

## Memory & Connection Management

### Memory
- Streaming data generation (chunks, not full dataset)
- Worker threads on-demand
- Batch size: 50K records default

### Connections
- 3x retry with exponential backoff
- PostgreSQL: connection pool (max 20)
- Per-worker database connections
- Configurable timeout: `WORKER_TIMEOUT_MS`

### Configuration
- `PARALLEL_WORKERS`: control memory usage (default 4)
- Datasets >10M: increase Docker memory allocation