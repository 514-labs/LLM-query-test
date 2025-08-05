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

# Start databases and run benchmark
npm run start-dbs
npm start
```

Default: 10M records. Adjust `DATASET_SIZE` in `.env`.

## Commands

- `npm start` - Full benchmark (data generation + queries)
- `npm run query-test` - Query-only test with statistical analysis
- `npm run bulk-test` - Comprehensive testing across multiple dataset sizes  
- `npm run generate-graphs` - Generate ASCII performance visualizations
- `npm run latency-sim` - Interactive LLM conversation delay simulator
- `npm run clean` - Reset databases and clear results

CLI options: `--query-only`, `--iterations N`, `--time-limit N`. Use `--help` for details.

## Data

46-column aircraft tracking records (position, altitude, transponder codes)

## Query Pattern

LLM simulation: "How many aircraft are in the air on average every minute for the past hour?"

1. Q1: Table discovery
2. Q2: Schema exploration
3. Q3: Hourly counts
4. Q4: Average calculation

## Configuration

Key `.env` settings: `DATASET_SIZE`, `BATCH_SIZE`, `PARALLEL_INSERT`, container resources.

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