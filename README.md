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
- `npm run graphs` - Generate ASCII performance visualizations
- `npm run latency-sim` - Interactive LLM conversation delay simulator
- `npm run clean` - Reset databases and clear results

**Advanced options:**
```bash
npm run query-test -- --iterations=50 --time-limit=30  # Custom test parameters
npm run graphs -- --update-readme                      # Update RESULTS.md with latest data
npm start --help                                       # Show all options
```

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
- `DATASET_SIZE=1000000` - Number of records to generate
- `PARALLEL_INSERT=true` - Enable faster data loading
- `CLICKHOUSE_MEMORY=4g` - Container resource limits
- `POSTGRES_MEMORY=4g` - Container resource limits

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