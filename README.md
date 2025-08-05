# LLM Query Performance Testing

OLAP (ClickHouse) vs OLTP (PostgreSQL) performance using LLM query patterns.
This repo provides:
1. A benchmarking tool to test ClickHouse (an OLAP database) and Postgres (an OLTP database) with different volumes using typical LLM style query patterns: `npm run bulk-test`.
2. A results visualizer: `npm run generate-graphs`
3. A latency simulator, showing how a chat interface would feel given the results of your benchmark: `npm run latency-sim`.

![Latency Simulation](latency-sim-10m.gif)

The below chat shows the resulting chat performance, at 10m rows, of Postgres (unindexed) and ClickHouse. 
The ClickHouse backed chat is able to answer 4 questions faster than the Postgres backed chat can answer a single question. 
You can run the simulation on any set of test results `npm run latency-sim` (and you can run the tests yourself too `npm run bulk-test`).

📊 **[Results →](RESULTS.md)**
**Results**: ClickHouse wins at >50K records (up to 50x faster at 10M). PostgreSQL wins on small datasets.

This repo ships with the benchmarking, viz and chat sim apps, as well as results for tests run from 10k to 10m rows (see [Benchmarking Methodology](BENCHMARK_METHODOLOGY.md) for how those tests were run). 

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

```

### Run chat sim

Since the repo ships with results, you can run the chat sim with: `npm run latency-sim`.

### Run your own tests

If you want to run the benchmark yourself:
```bash
# Run Docker Desktop

# Optionally, edit .env to set the test sizes you are interested in. 
# Default: BULK_TEST_SIZES=10000,50000,100000,500000,1000000,5000000,10000000

# Run the bulk test tool
npm run bulk-test
```

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