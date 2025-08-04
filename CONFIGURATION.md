# Configuration Guide

Complete configuration reference for the LLM query performance testing tool.

## Environment Variables

Edit `.env` file to configure all aspects of the benchmark:

### Database Connections

**ClickHouse:**
```env
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=performance_test
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=password
```

**PostgreSQL (no index):**
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=performance_test
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres
```

**PostgreSQL (with index):**
```env
POSTGRES_INDEXED_HOST=localhost
POSTGRES_INDEXED_PORT=5433
POSTGRES_INDEXED_DATABASE=performance_test
POSTGRES_INDEXED_USERNAME=postgres
POSTGRES_INDEXED_PASSWORD=postgres
```

### Container Resources

Control Docker container resource allocation for fair testing:

```env
# Memory limits (examples)
CLICKHOUSE_MEMORY=4g
POSTGRES_MEMORY=4g
POSTGRES_INDEXED_MEMORY=4g

# CPU limits  
CLICKHOUSE_CPUS=2
POSTGRES_CPUS=2
POSTGRES_INDEXED_CPUS=2
```

**Memory Examples:**
- `1g` - Lightweight testing
- `4g` - Standard testing (recommended)
- `8g` - High-performance scenarios

### Performance Testing

```env
# Dataset configuration
DATASET_SIZE=10000000          # Default 10M rows
BATCH_SIZE=50000              # Records per batch for insertion
BULK_TEST_SIZES=10K,50K,100K,500K,1M,5M,10M,25M  # Sizes for bulk testing

# Parallel processing
PARALLEL_INSERT=true          # Enable parallel data insertion
PARALLEL_WORKERS=4            # Number of worker threads (adjust based on CPU cores)
WORKER_TIMEOUT_MS=300000      # Worker timeout (5 minutes)

# Statistical improvements
BENCHMARK_SEED=default-benchmark-seed  # Seed for reproducible data generation
```

## Advanced Features

### Time Limits

Query-only tests include automatic timeout protection:

```bash
npm run query-test                     # Default: 60 minutes per test configuration
npm run query-test -- --time-limit=120 # Custom: 120 minutes per test configuration
```

- Each database/index combination gets its own time limit
- Partial results are saved if tests timeout
- Tests can be safely interrupted and resumed

### Auto-Resume

Tests automatically resume from checkpoints if interrupted:

- Safe to use Ctrl+C to interrupt long-running tests
- Progress is saved after each configuration completes
- Automatically resumes from last checkpoint on restart
- Use `npm run clean:output` to clear checkpoints and start fresh

### Memory Monitoring

Built-in memory usage protection:

- Pre-test memory checks before large operations
- Real-time monitoring during data generation
- Automatic warnings at 85% memory usage
- Critical alerts at 95% memory usage with suggestions

### Latency Simulator

Interactive demonstration of real-world performance impact:

```bash
npm run latency-sim
```

- **Uses pre-recorded data**: No live queries - all delays based on statistical analysis from bulk tests
- Choose dataset size and database configuration from actual test results  
- Experience realistic chat conversation delays with natural variance
- Individual query timing (Q1-Q4) with proper standard deviations from real measurements

## Container Management

### Automated Setup

```bash
npm run start-dbs    # Start all databases with resource limits
npm run kill-dbs     # Remove all database containers
```

### Manual Setup

**ClickHouse:**
```bash
docker run -d --name clickhouse-server \
  --memory=4g --cpus=2 \
  --ulimit nofile=262144:262144 \
  -p 8123:8123 -p 9000:9000 \
  -e CLICKHOUSE_PASSWORD=password \
  clickhouse/clickhouse-server
```

**PostgreSQL (no indexes):**
```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  --memory=4g --cpus=2 \
  postgres:15
```

**PostgreSQL (with indexes):**
```bash
docker run -d --name postgres-indexed \
  -e POSTGRES_PASSWORD=postgres \
  -p 5433:5432 \
  --memory=4g --cpus=2 \
  postgres:15
```

## Performance Tuning

### Memory Optimization

For large datasets (>10M records):

```env
BATCH_SIZE=25000              # Smaller batches reduce memory usage
PARALLEL_WORKERS=2            # Fewer workers reduce memory pressure
PARALLEL_INSERT=true          # Use streaming generation
```

### CPU Optimization

For faster data generation:

```env
PARALLEL_WORKERS=8            # Match your CPU core count
BATCH_SIZE=100000             # Larger batches reduce overhead
CLICKHOUSE_CPUS=4             # Allocate more CPU to databases
POSTGRES_CPUS=4
POSTGRES_INDEXED_CPUS=4
```

### Storage Optimization

For faster I/O:

- Use SSD storage for Docker containers
- Increase Docker's allocated storage
- Consider mounting database volumes on fastest available storage

## Troubleshooting

### Common Issues

1. **Database connection issues**
   - Check that containers are running: `docker ps`
   - Verify ports are not in use: `lsof -i :8123 -i :5432 -i :5433`
   - Check container logs: `docker logs clickhouse-server`

2. **Memory issues**
   - Reduce `DATASET_SIZE` for initial testing
   - Lower `PARALLEL_WORKERS` count
   - Increase Docker's memory allocation

3. **Permission errors**
   - Ensure database users have CREATE/DROP/INSERT permissions
   - Check Docker container user permissions

4. **Long insertion times**
   - Enable `PARALLEL_INSERT=true`
   - Increase `PARALLEL_WORKERS` (match CPU cores)
   - Use larger `BATCH_SIZE` for better throughput

### Validation

The tool includes built-in validation for:

- Port conflicts between database instances
- Memory format validation (e.g., "4g", "1024m")
- CPU count validation
- Environment variable completeness

Run any command to see validation results - the tool will warn about configuration issues before starting tests.