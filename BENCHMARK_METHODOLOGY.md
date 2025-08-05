# Benchmark Methodology

Comprehensive methodology for testing ClickHouse (OLAP) vs PostgreSQL (OLTP) performance using LLM-style query patterns.

## Test Overview

This benchmark compares database performance using a realistic aircraft tracking dataset with progressive query patterns that simulate how an AI system would explore and analyze data.

### Bulk Test Process

1. **Container Initialization**: Spin up Docker containers for each database configuration:
   - ClickHouse (columnar OLAP)
   - PostgreSQL (row-based OLTP) 
   - PostgreSQL with optimized indexes

2. **Data Generation**: Create deterministic datasets using seeded random generation:
   - 46-column aircraft tracking records
   - Configurable sizes via `BULK_TEST_SIZES` (default: 10K, 50K, 100K, 500K, 1M, 5M, 10M)
   - Parallel insertion with configurable batch size (`BATCH_SIZE`, default: 50K)
   - Optional parallel workers (`PARALLEL_WORKERS`, default: 4)

3. **Query Execution**: Run 4 progressive queries per iteration:
   - Q1: Table discovery (`SHOW TABLES`, `information_schema`)
   - Q2: Schema exploration (`SELECT * LIMIT 10`)
   - Q3: Time-series aggregation (hourly aircraft counts)
   - Q4: Statistical calculation (average counts)
   - Default: 100 iterations per configuration (configurable via `QUERY_TEST_ITERATIONS`)

4. **Results Collection**: Capture timing data with statistical analysis

## Results Location

- **Console Output**: Real-time progress and ASCII graphs via `npm run generate-graphs`
- **Structured Data**: `output/test-results.json` and `output/test-results.csv`
- **Documentation**: Performance summaries in `RESULTS.md`

## Statistical Methodology

### Measurement Approach
- **Iterations**: 100 runs per configuration (configurable via `QUERY_TEST_ITERATIONS`, range: 1-10,000)
- **Warmup**: 3 complete query cycles run before measurement begins
- **Timeout Protection**: 60-minute limit per configuration (configurable via `QUERY_TEST_TIME_LIMIT`, range: 1-1,440 minutes)
- **Query Structure**: 4 queries executed sequentially per iteration

### Statistical Analysis
- **Central Tendency**: Mean and median execution times per query
- **Variability**: Standard deviation and range (min/max) calculations
- **Confidence Intervals**: 95% CI using t-distribution (t=1.96 for n>30, t=2.0 for n≤30)
- **Partial Results**: Timeout handling preserves completed iterations for analysis

### Data Quality
- **Deterministic Generation**: Seeded random data ensures reproducible results
- **Consistent Environment**: Docker containers with fixed resource allocation
- **Multiple Iterations**: Statistical significance through repeated measurements

## Database Design Differences

Each database implementation follows platform-specific best practices and optimizations. The implementations differ significantly in:

- **Storage Models**: Columnar (ClickHouse) vs Row-based (PostgreSQL)
- **Type Systems**: Storage-optimized vs SQL-standard types
- **Indexing Strategies**: ORDER BY optimization vs explicit B-tree indexes
- **NULL Handling**: Default values vs preserved NULLs
- **Query Syntax**: Native functions vs standard SQL

For complete schema comparison including field types, indexes, and optimization strategies, see **[Schema Comparison →](SCHEMA_COMPARISON.md)**.

## Query Pattern Design

The benchmark simulates a realistic LLM workflow: *"How many aircraft are in the air on average every minute for the past hour?"*

This question requires progressive discovery:

1. **Q1 - Discovery**: Find available tables in the database
2. **Q2 - Exploration**: Examine data structure and sample records  
3. **Q3 - Analysis**: Aggregate aircraft counts by time periods
4. **Q4 - Calculation**: Compute statistical averages across time

### Query Implementations

Each database uses optimized, idiomatic SQL:

**Q1 - Table Discovery:**
```sql
-- ClickHouse
SHOW TABLES

-- PostgreSQL  
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
```

**Q2 - Schema Exploration:**
```sql
-- Both databases (identical)
SELECT hex, flight, aircraft_type, lat, lon, alt_baro, gs, track,
       timestamp, alt_baro_is_ground, nav_qnh, category
FROM performance_test ORDER BY timestamp DESC LIMIT 10
```

**Q3 - Time-Series Aggregation:**
```sql
-- ClickHouse (native functions)
SELECT
  toStartOfHour(timestamp) AS hour_bucket,
  uniq(hex) AS unique_aircraft_count
FROM performance_test
WHERE alt_baro_is_ground = 0
GROUP BY hour_bucket
ORDER BY hour_bucket ASC

-- PostgreSQL (standard SQL)
SELECT
  date_trunc('hour', timestamp) AS hour_bucket,
  count(DISTINCT hex) AS unique_aircraft_count
FROM performance_test
WHERE alt_baro_is_ground = false
GROUP BY hour_bucket
ORDER BY hour_bucket ASC
```

**Q4 - Statistical Calculation:**
```sql
-- Both databases use CTE pattern for average calculation
WITH hourly_counts AS (
  -- Q3 query results
)
SELECT AVG(unique_aircraft_count) AS avg_aircraft_per_hour
FROM hourly_counts
```

## Performance Optimization

### ClickHouse Optimizations
- **Columnar Storage**: MergeTree engine with compression
- **Smart Ordering**: `ORDER BY (alt_baro_is_ground, hex, timestamp)`
- **Native Functions**: `uniq()`, `toStartOfHour()` for performance
- **Automatic Parallelization**: Query execution across CPU cores

### PostgreSQL Optimizations
- **Strategic Indexing**: Multiple B-tree indexes for query patterns
- **Query Planner**: Cost-based optimization with statistics
- **Connection Pooling**: Efficient connection management
- **Standard Compliance**: Portable SQL for broad compatibility

### Test Environment
- **Hardware**: Apple M3 Pro, 18GB RAM
- **Containerization**: Docker containers with configurable resource limits
- **Default Resources**: 4GB RAM, 2 CPUs per database (configurable via `*_MEMORY`, `*_CPUS`)
- **Isolation**: Separate containers prevent resource contention
- **Ports**: ClickHouse (8123), PostgreSQL (5432), PostgreSQL+Index (5433)

## Reproducibility

All tests are designed for reproducibility:

- **Seeded Generation**: Deterministic data creation
- **Fixed Environment**: Containerized database configurations  
- **Version Control**: Schema and query definitions in source code
- **Documentation**: Complete methodology and configuration details

Run the complete benchmark suite:
```bash
npm run bulk-test
```

Or run individual components:
```bash
npm start           # Single dataset test
npm run query-test  # Query-only analysis
npm run generate-graphs  # Visualization
```