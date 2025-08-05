# LLM Query Performance Testing

OLAP (ClickHouse) vs OLTP (PostgreSQL) performance using LLM query patterns.

**Results**: ClickHouse wins at >50K records (up to 50x faster at 10M). PostgreSQL wins on small datasets.

📊 **[Results →](RESULTS.md)**

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://docs.docker.com/get-docker/) v20+
- 8GB RAM minimum (16GB recommended for large datasets)
- 10GB free disk space

## Setup

```bash
# Get the code
git clone https://github.com/514-labs/llm-test.git
cd llm-test

# Setup and build
npm install
npm run build

# Configure (optional - defaults work fine)
cp .env.example .env

# Run comprehensive bulk test
npm run bulk-test
```

Bulk test runs 9 dataset sizes (5K to 25M records). Configure in `.env` or use `npm start` for single 10M test.

## Commands

- `npm start` - Run Benchmark (data generation + queries)
- `npm run query-test` - Query-only test with statistical analysis (requires databases running/populated)
- `npm run bulk-test` - Comprehensive testing across multiple dataset sizes  
- `npm run generate-graphs` - Generate performance visualizations
- `npm run latency-sim` - Interactive LLM conversation delay simulator
- `npm run clean` - Reset databases and clear results

CLI options: see `npm run help`. Use `-- --help` for details for a particular command.

## Data

46-column aircraft tracking records (position, altitude, transponder codes). See [Schema Comparison](SCHEMA_COMPARISON.md)

## Query Pattern

LLM simulation: "How many aircraft are in the air on average every minute for the past hour?"

1. Q1: Table discovery
2. Q2: Schema exploration
3. Q3: Hourly counts
4. Q4: Average calculation

## Configuration

Key `.env` settings: `BULK_TEST_SIZES`, `DATASET_SIZE`, `BATCH_SIZE`, `PARALLEL_INSERT`, container resources.

🔧 **[Full config →](CONFIGURATION.md)**

## Output

`output/test-results.{json,csv}` with timing data and 95% confidence intervals.

## Methodology

- Deterministic data (seeded)
- 3x warmup queries
- 95% CI across 100+ iterations
- Database-specific optimizations

🔬 **[Details →](BENCHMARK_METHODOLOGY.md)** | **[Schema →](SCHEMA_COMPARISON.md)**

## Troubleshooting

- Connection errors: `docker ps`
- Memory issues: reduce `DATASET_SIZE`
- Port conflicts: check 8123, 5432, 5433
- Reset: `npm run clean && npm run kill-dbs && npm run start-dbs`