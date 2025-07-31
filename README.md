# LLM Query Performance Testing

Tests LLM-style query patterns against transactional (PostgreSQL) and OLAP (ClickHouse) databases with equivalent setups to compare performance characteristics.

## Benchmark Results

### Test Environment
- **Machine**: Apple M3 Pro, 18GB RAM
- **Docker**: ClickHouse server, PostgreSQL 15
- **Dataset**: 10M aircraft tracking records (46 columns each)

### Results

[Benchmark results will be added here]

## Setup

### Prerequisites

**Quick Start - Docker Containers**
```bash
# Start both databases with equal resource allocation for fair testing
npm run start-dbs
```

**Manual Setup**

*ClickHouse Server*
```bash
# Docker (with equal resource allocation for fair testing)
docker run -d --name clickhouse-server --memory=4g --cpus=2 --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 -e CLICKHOUSE_PASSWORD=password clickhouse/clickhouse-server

# Or install locally
curl https://clickhouse.com/ | sh
./clickhouse server
```

*PostgreSQL Server*
```bash
# Docker (with equal resource allocation for fair testing)
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 --memory=4g --cpus=2 postgres:15

# Or install locally
brew install postgresql && brew services start postgresql
```

### Installation

```bash
npm install
cp .env.example .env  # Edit database connections
npm run build
```

## Usage

```bash
npm start                                          # Run full test (with data generation)
npm run dev                                        # Development mode
npm run query-test                                 # Query-only test (100 iterations, 1hr time limit)
npm run query-test -- --time-limit=120            # Query-only test (2hr time limit)
npm run query-test -- --iterations=50             # Query-only test (50 iterations)
npm run query-test -- --iterations=200 --time-limit=30  # 200 iterations with 30min time limit
npm run graphs                                     # Generate ASCII performance graphs from output files
npm run graphs -- --update-readme                 # Generate graphs AND update README results section
npm run clean                                      # Clear databases and result files (fresh start)
npm run clean:db                                   # Clear database tables only
npm run clean:output                               # Clear result files only
npm run help                                       # Show detailed command reference
```

**Help Options:**
```bash
npm start --help                                   # Show help for main test command
npm run query-test -- --help                      # Show help for query-only tests
```

## Configuration

Edit `.env` file to configure:
- Database connections (host, port, password)
- Dataset size for testing (`DATASET_SIZE`)
- Batch size for data insertion
- **Parallel insertion**: Set `PARALLEL_INSERT=true` for 2-4x faster data loading
- Worker count: `PARALLEL_WORKERS=4` (adjust based on CPU cores)

### Advanced Features

**⏱️ Time Limits**: Query-only tests include automatic timeout protection:
- Default: 60 minutes per test configuration
- Each database/index combination gets its own time limit
- Partial results are saved if tests timeout
- Use `--time-limit=X` to customize (X = minutes)

**🔄 Auto-Resume**: Tests automatically resume from checkpoints if interrupted:
- Safe to use Ctrl+C to interrupt long-running tests
- Progress is saved after each configuration completes
- Automatically resumes from last checkpoint on restart
- Use `npm run clean:output` to clear checkpoints and start fresh

**💾 Memory Monitoring**: Built-in memory usage protection:
- Pre-test memory checks before large operations
- Real-time monitoring during data generation
- Automatic warnings at 85% memory usage
- Critical alerts at 95% memory usage with suggestions

## Output

Results in console, `output/test-results.json`, and `output/test-results.csv`.

### ASCII Performance Graphs

Generate visual performance comparisons from saved results:

```bash
npm run graphs                    # Terminal display only
npm run graphs -- --update-readme # Update README + terminal display
```

**Prerequisites**: Run tests first to generate result files:
```bash
npm start          # Generate load test results
npm run query-test # Generate query-only test results
npm run graphs     # Then visualize both test results
```

Features:
- Reads all JSON result files from `output/` directory
- Automatically detects load tests vs query-only tests
- Shows horizontal bar charts for query performance
- Highlights timeout warnings for incomplete tests (⚠️)
- Displays both mean and median statistics for multi-iteration tests
- Includes setup time visualization
- Groups results by dataset size for easy comparison
- **`--update-readme`**: Injects benchmark summaries into README.md (preserves Test Environment section)

### Cleanup Commands

Reset your testing environment:

```bash
npm run clean        # Complete cleanup (databases + result files)
npm run clean:db     # Clear database tables only (keep results)
npm run clean:output # Clear result files only (keep data)
```

Use cleanup commands to:
- Start fresh testing with clean databases
- Remove old result files before new test runs
- Free up disk space from large datasets
- Reset after configuration changes

## Test Data & Queries

**Data**: 46-column ADS-B aircraft tracking records with realistic telemetry (altitude, speed, position, transponder codes, etc.)

**Query Pattern**: Simulates LLM answering "How many aircraft are in the air on average every minute for the past hour?"
1. `SHOW TABLES` - Discovery
2. `SELECT * LIMIT 10` - Schema exploration  
3. Hourly aircraft counts with time bucketing
4. CTE-based average calculation

## Troubleshooting

1. **Database connection issues** - Check that both ClickHouse and PostgreSQL are running and accessible
2. **ClickHouse authentication** - Ensure CLICKHOUSE_PASSWORD is set correctly
3. **Data type errors** - ClickHouse requires exact data types (use provided schema)
4. **Memory issues** - Streaming generation handles large datasets, but ensure 4GB+ RAM
5. **Long insertion times** - Large datasets take significant time, monitor progress with ETA
6. **Permission errors** - Ensure database users have CREATE/DROP/INSERT permissions

