# Configuration

Environment variables and CLI options.

## Database Connections

```env
# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=performance_test
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=password

# PostgreSQL (no index)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=performance_test
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres

# PostgreSQL (with index)
POSTGRES_INDEXED_HOST=localhost
POSTGRES_INDEXED_PORT=5433
POSTGRES_INDEXED_DATABASE=performance_test
POSTGRES_INDEXED_USERNAME=postgres
POSTGRES_INDEXED_PASSWORD=postgres

# PG Hydra (optional)
# If you have a PG Hydra deployment, point these to the router
PG_HYDRA_HOST=localhost
PG_HYDRA_PORT=5434
PG_HYDRA_DATABASE=performance_test
PG_HYDRA_USERNAME=postgres
PG_HYDRA_PASSWORD=postgres
```

## Container Resources

```env
# Memory (1g, 4g, 8g)
CLICKHOUSE_MEMORY=4g
POSTGRES_MEMORY=4g
POSTGRES_INDEXED_MEMORY=4g

# CPUs
CLICKHOUSE_CPUS=2
POSTGRES_CPUS=2
POSTGRES_INDEXED_CPUS=2
```

## Performance Testing

```env
# Single test
DATASET_SIZE=10000000
BATCH_SIZE=50000
QUERY_TEST_ITERATIONS=100
QUERY_TEST_TIME_LIMIT=60

# Parallel processing
PARALLEL_INSERT=true
PARALLEL_WORKERS=4
WORKER_TIMEOUT_MS=300000

# Bulk test
BULK_TEST_SIZES=5000,10000,50000,100000,500000,1000000,5000000,10000000,25000000
BULK_TEST_TIME_LIMIT=60
BULK_TEST_OUTPUT_DIR=output

# Reproducibility
BENCHMARK_SEED=default-benchmark-seed
```

## CLI Overrides

```bash
# Single tests
npm run query-test -- --iterations 200
npm run query-test -- --time-limit 120
npm start -- --query-only --iterations 50

# Bulk tests
npm run bulk-test -- --databases "clickhouse,postgresql,postgresql-indexed,pg_hydra,pg_hydra-sharded"
npm run bulk-test -- --sizes "1000,10000,100000"
npm run bulk-test -- --time-limit 30
npm run bulk-test -- --output-dir my-results
```

## Features

- **Time limits**: 60 min default, partial results saved on timeout
- **Auto-resume**: Ctrl+C safe, automatic checkpoint recovery
- **Memory monitoring**: Warnings at 85%, critical at 95%
- **Latency simulator**: `npm run latency-sim` - interactive performance demo
- **PG Hydra support**: Use `--databases pg_hydra` (single node) or `--databases pg_hydra-sharded`

## Container Management

```bash
npm run start-dbs    # Start all databases
npm run kill-dbs     # Remove containers
```

Manual setup: See Docker commands in `src/utils/start-databases.ts`

## Performance Tuning

**Large datasets (>10M):**
- `BATCH_SIZE=25000` - reduce memory
- `PARALLEL_WORKERS=2` - reduce load

**Speed optimization:**
- `PARALLEL_WORKERS=8` - match CPU cores
- `BATCH_SIZE=100000` - reduce overhead
- Use SSD storage

## Troubleshooting

**Connection issues:** `docker ps`, check ports 8123/5432/5433

**Memory issues:** Reduce `DATASET_SIZE` or `PARALLEL_WORKERS`

**Slow inserts:** Enable `PARALLEL_INSERT=true`

**Validation:** Automatic port/memory/CPU checks on startup