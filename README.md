# LLM Query Performance Testing

Compares OLAP (ClickHouse) vs OLTP (PostgreSQL) performance using realistic LLM query patterns that simulate progressive data discovery and analysis.

## Key Results

**Summary**: ClickHouse becomes faster than PostgreSQL at ~50K records and maintains significant advantage at scale (up to 50x faster at 10M records). PostgreSQL with indexes outperforms on small datasets (<25K records).

📊 **[Detailed benchmark results →](RESULTS.md)**

## Quick Start

```bash
npm run start-dbs    # Start databases (ClickHouse + 2x PostgreSQL)
npm install && npm run build
npm start           # Run full benchmark with data generation
```

## Commands

- `npm start` - Full benchmark (data generation + queries)
- `npm run query-test` - Query-only test with statistical analysis
- `npm run bulk-test` - Comprehensive testing across multiple dataset sizes  
- `npm run generate-graphs` - Generate ASCII performance visualizations
- `npm run latency-sim` - Interactive LLM conversation delay simulator
- `npm run clean` - Reset databases and clear results

**Advanced options:**
```bash
# Direct CLI usage with options
node dist/src/index.js --query-only --iterations 50 --time-limit 30
node dist/src/reporting/graph-generator.js --update-readme
node dist/src/testing/bulk-tester.js --sizes "1000,50000,100000"

# Get help for any command
npm run help        # Main application help  
npm run bulk-test   # --help for bulk testing options
npm run start-dbs   # --help for database startup options
```

## CLI Options

Professional CLI interface with help, validation, and error handling:

**Main Application (`npm start` or `node dist/src/index.js`)**
- Configuration read from `.env` file first, then overridden by CLI flags
- `--query-only` - Run query tests without data generation
- `--iterations <number>` - Number of test iterations (default: 100)  
- `--time-limit <minutes>` - Time limit per test (default: 60)
- `--help` - Show detailed help and available npm scripts
- Environment variables: `QUERY_TEST_ITERATIONS`, `QUERY_TEST_TIME_LIMIT`, `DATASET_SIZE`, `BATCH_SIZE`

**Bulk Testing (`npm run bulk-test`)**
- Configuration read from `.env` file first, then overridden by CLI flags
- `--sizes <sizes>` - Comma-separated dataset sizes (e.g., "1000,10000,100000")
- `--time-limit <minutes>` - Time limit for each query test (default: 60)
- `--output-dir <dir>` - Results output directory (default: "output")
- Environment variables: `BULK_TEST_SIZES`, `BULK_TEST_TIME_LIMIT`, `BULK_TEST_OUTPUT_DIR`

**Database Management (`npm run start-dbs`)**
- `--cleanup-first` - Remove existing containers before starting
- Shows configured memory/CPU limits and port assignments
- Environment variables: `CLICKHOUSE_MEMORY/CPUS`, `POSTGRES_MEMORY/CPUS`, `POSTGRES_INDEXED_MEMORY/CPUS`

**Other Tools**
- All tools support `--version` and `--help` for consistent CLI experience
- `npm run latency-sim` supports `--output-dir` for custom result locations

## Test Design

**Data**: 46-column aircraft tracking records with realistic telemetry (position, altitude, transponder codes, etc.)

**Query Pattern**: Simulates LLM answering *"How many aircraft are in the air on average every minute for the past hour?"*

1. **Q1**: `SHOW TABLES` - Discovery
2. **Q2**: `SELECT * LIMIT 10` - Schema exploration  
3. **Q3**: Hourly aircraft counts with time bucketing and filtering
4. **Q4**: CTE-based average calculation across time periods

## Configuration

**Basic setup:**
```bash
cp .env.example .env  # Edit database connections and dataset size
```

**Key settings:**
- `DATASET_SIZE=10000000` - Number of records for single tests
- `BATCH_SIZE=50000` - Batch size for data insertion
- `PARALLEL_INSERT=true` - Enable faster data loading
- `QUERY_TEST_ITERATIONS=100` - Number of iterations for query tests
- `QUERY_TEST_TIME_LIMIT=60` - Time limit for single query tests (minutes)
- `CLICKHOUSE_MEMORY=4g` - ClickHouse container memory limit
- `CLICKHOUSE_CPUS=2` - ClickHouse container CPU limit
- `POSTGRES_MEMORY=4g` - PostgreSQL container memory limit
- `POSTGRES_CPUS=2` - PostgreSQL container CPU limit
- `POSTGRES_INDEXED_MEMORY=4g` - PostgreSQL (indexed) container memory limit
- `POSTGRES_INDEXED_CPUS=2` - PostgreSQL (indexed) container CPU limit
- `BULK_TEST_SIZES=5000,10000,50000,100000,500000,1000000,5000000,10000000,25000000` - Bulk test dataset sizes
- `BULK_TEST_TIME_LIMIT=60` - Bulk test time limit in minutes

🔧 **[Complete configuration guide →](CONFIGURATION.md)**

## Output

Results saved to `output/` directory:
- `test-results.json` - Detailed timing data with confidence intervals
- `test-results.csv` - Spreadsheet format for analysis
- Console output with performance comparisons and insights

## Methodology

The benchmark uses scientifically sound testing practices:

- **Deterministic data generation** - Seeded random generation for reproducible results
- **Database warmup** - 3x query execution before timing to eliminate cold-start effects  
- **Statistical analysis** - 95% confidence intervals, standard deviations across 100+ iterations
- **Database-specific optimization** - Each database uses native strengths (not artificially identical queries)

🔬 **[Detailed methodology →](BENCHMARK_METHODOLOGY.md)**

## Troubleshooting

**Common issues:**
1. Database connection errors → Check containers: `docker ps`
2. Memory issues → Reduce `DATASET_SIZE` or enable `PARALLEL_INSERT=true`
3. Port conflicts → Verify ports 8123, 5432, 5433 are available

**Reset everything:**
```bash
npm run clean     # Clear databases + results
npm run kill-dbs  # Remove Docker containers
npm run start-dbs # Fresh database setup
```