# LLM Query Performance Testing

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

LLM Query Performance Testing is a Node.js/TypeScript application that benchmarks database performance (ClickHouse vs PostgreSQL) using LLM-style query patterns. It demonstrates how database latency affects AI-powered data conversations through realistic chat simulations.

## Working Effectively

### Prerequisites and Setup
**CRITICAL**: Ensure you have the exact versions before starting:
- Node.js v18+ (verified working)
- Docker v20+ (verified working)
- At least 8GB RAM available for database containers

### Bootstrap, Build, and Test
**ALWAYS run these commands in sequence for a fresh setup:**

```bash
# 1. Install dependencies (takes ~8 seconds)
npm install

# 2. Build TypeScript (takes ~2 seconds)  
npm run build

# 3. Configure environment
cp .env.example .env

# 4. Start database containers (takes ~26 seconds first time, ~10 seconds subsequent)
# NEVER CANCEL: Docker image downloads take time on first run
npm run start-dbs

# 5. Verify basic functionality (takes ~3 seconds)
npm run test:smoke
```

**Build Timing - NEVER CANCEL:**
- `npm install`: 8 seconds
- `npm run build`: 2 seconds  
- `npm run start-dbs`: 26 seconds (first time), 10 seconds (subsequent)
- `npm run test:smoke`: 3 seconds

### Core Testing Commands

**Query-only tests (recommended for development):**
```bash
# Quick validation test (takes ~51 seconds) - NEVER CANCEL: Set timeout to 120+ seconds
npm run query-test -- --iterations 5 --time-limit 1

# Full statistical test (takes 5-15 minutes) - NEVER CANCEL: Set timeout to 30+ minutes  
npm run query-test -- --iterations 100 --time-limit 60
```

**Full benchmark with data generation:**
```bash
# Single dataset test - NEVER CANCEL: Set timeout to 60+ minutes
npm start

# Comprehensive bulk testing - NEVER CANCEL: Set timeout to 180+ minutes  
npm run bulk-test
```

**Interactive demonstrations:**
```bash
# Chat latency simulator (interactive)
npm run latency-sim
```

### Cleanup and Reset
```bash
# Clear databases and results (takes ~3 seconds)
npm run clean

# Stop and remove database containers (takes ~1 second)
npm run kill-dbs

# Complete reset for fresh start
npm run kill-dbs && npm run clean && npm run start-dbs
```

## Validation

### Manual Validation Requirements
**ALWAYS test these scenarios after making changes:**

1. **Database Connectivity Test**: Run `npm run test:smoke` - should pass all 14 tests in ~3 seconds
2. **Query Execution Test**: Run `npm run query-test -- --iterations 5 --time-limit 1` - should complete in ~51 seconds
3. **Chat Simulation Test**: Run `npm run latency-sim` and select any dataset size - should show interactive menu

### Expected Results
- **Smoke tests**: 14/14 passed in ~3 seconds
- **Query tests**: ClickHouse typically 6-10x faster than unindexed PostgreSQL
- **Bulk tests**: Generate timestamped JSON/CSV files in `output/` directory
- **Latency sim**: Interactive menu with 7 dataset size options (10K to 10M rows)

### Build Validation
**ALWAYS run before committing changes:**
```bash
# Verify TypeScript compilation
npm run build

# Run full smoke test suite  
npm run test:smoke
```

The repository has no linting or formatting scripts - TypeScript strict mode provides code validation.

## Common Tasks

### Working with Database Performance
- **Start fresh**: `npm run kill-dbs && npm run start-dbs` 
- **Reset data only**: `npm run clean:db`
- **Clear results only**: `npm run clean:output`
- **Check container status**: `docker ps` (should show 3 containers: clickhouse-server, postgres, postgres-indexed)

### Troubleshooting Commands
```bash
# Check Docker containers
docker ps

# View container logs
docker logs clickhouse-server
docker logs postgres
docker logs postgres-indexed

# Force container reset
npm run kill-dbs
docker system prune -f
npm run start-dbs
```

### Configuration
Key `.env` settings for performance tuning:
- `DATASET_SIZE`: Single test size (default: 10000000)
- `BULK_TEST_SIZES`: Comma-separated sizes for bulk testing (default: 10000,50000,100000,500000,1000000,5000000,10000000)
- `QUERY_TEST_ITERATIONS`: Number of test iterations (default: 100)
- `PARALLEL_INSERT`: Enable faster data loading (default: true)

### Repository Structure
```
src/
├── config/          # Environment configuration and validation
├── database/        # ClickHouse and PostgreSQL database adapters  
├── data/            # Test data generation (deterministic, seeded)
├── testing/         # Performance testing and bulk test runners
├── reporting/       # Results formatting and CSV/JSON output
└── utils/           # Database startup, cleanup, latency simulator

tests/
└── smoke.test.ts    # Comprehensive functionality validation

output/              # Generated test results (JSON/CSV)
```

### Port Configuration
- **ClickHouse**: localhost:8123 (HTTP), localhost:9000 (native)
- **PostgreSQL (unindexed)**: localhost:5432  
- **PostgreSQL (indexed)**: localhost:5433

### Common Outputs
The following are sample outputs from frequently used commands:

#### npm run test:smoke (success)
```
🚀 Running Smoke Tests
✓ Configuration validation
✓ Database connections
✓ Table creation
✓ Data generation (deterministic)
✓ Data validation - required fields
✓ Data validation - field types
✓ Data insertion - ClickHouse
✓ Data insertion - PostgreSQL
✓ Query correctness - Q1 (metadata)
✓ Query correctness - Q2 (sample)
✓ Query correctness - Q3 (analytical)
✓ Query correctness - Q4 (hourly buckets)
✓ Full query execution flow
✓ Cleanup

==================================================
Passed: 14
Failed: 0
==================================================

✅ All smoke tests passed!
```

#### docker ps (when databases running)
```
CONTAINER ID   IMAGE                          COMMAND                  CREATED          STATUS          PORTS                              NAMES
d2bc2fc64dfb   postgres:15                    "docker-entrypoint.s…"   21 seconds ago   Up 20 seconds   0.0.0.0:5433->5432/tcp             postgres-indexed
2ab772ec756f   postgres:15                    "docker-entrypoint.s…"   21 seconds ago   Up 20 seconds   0.0.0.0:5432->5432/tcp             postgres
15cb275cc2c3   clickhouse/clickhouse-server   "/entrypoint.sh"         27 seconds ago   Up 26 seconds   0.0.0.0:8123->8123/tcp, 9000/tcp   clickhouse-server
```

## Critical Timing Guidelines

**NEVER CANCEL these operations - use appropriate timeouts:**

- **npm install**: 8 seconds (timeout: 60 seconds)
- **npm run build**: 2 seconds (timeout: 30 seconds)
- **npm run start-dbs**: 26 seconds first time, 10 seconds subsequent (timeout: 120 seconds)
- **npm run test:smoke**: 3 seconds (timeout: 60 seconds)
- **npm run query-test**: 51 seconds for 5 iterations (timeout: 120+ seconds)
- **npm run query-test** (full): 5-15 minutes for 100 iterations (timeout: 30+ minutes)
- **npm start**: 15-60 minutes with data generation (timeout: 120+ minutes)
- **npm run bulk-test**: 60-180 minutes for all dataset sizes (timeout: 240+ minutes)
- **npm run clean**: 3 seconds (timeout: 30 seconds)
- **npm run kill-dbs**: 1 second (timeout: 30 seconds)

**Container startup may take longer on first run due to Docker image downloads. This is normal - wait for completion.**

## Error Recovery

**Common issues and solutions:**

1. **Port conflicts**: `npm run kill-dbs` then check no other services on ports 5432, 5433, 8123
2. **Container startup failures**: `docker system prune -f && npm run start-dbs`
3. **Memory issues**: Reduce `DATASET_SIZE` in `.env` or increase Docker memory allocation
4. **Database connection errors**: Verify containers are running with `docker ps`, restart with `npm run kill-dbs && npm run start-dbs`
5. **Build failures**: Delete `dist/` directory and run `npm run build`

**Always verify with smoke tests after recovery:**
```bash
npm run test:smoke
```