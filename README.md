# LLM Query Performance Testing

Tests LLM-style query patterns against transactional (PostgreSQL) and OLAP (ClickHouse) databases with equivalent setups to compare performance characteristics.

## Benchmark Results

### Test Environment
- **Machine**: Apple M3 Pro, 18GB RAM
- **Docker**: ClickHouse server, PostgreSQL 15
- **Dataset**: 1M and 10M aircraft tracking records (46 columns each)

### Results

#### First Run - Single Iteration

**10M Row Dataset Performance:**

| Database   | Index | Q1 (ms) | Q2 (ms) | Q3 (ms)   | Q4 (ms)   | Total (ms) | Setup (s) |
|------------|-------|---------|---------|-----------|-----------|------------|-----------|
| ClickHouse | ✗     | 8.1     | 17.2    | 66.7      | 63.5      | 155.5      | 140.4     |
| PostgreSQL | ✓     | 3.7     | 5.1     | 19,262.6  | 15,878.1  | 35,149.5   | 1,187.8   |
| PostgreSQL | ✗     | 2.3     | 2.1     | 16,154.2  | 15,916.0  | 32,074.5   | 529.7     |

**Key Findings:**
- **ClickHouse is 226x faster** than PostgreSQL for analytical queries (Q3, Q4)
- **PostgreSQL excels** at simple queries (Q1, Q2) with 2-8ms response times
- **PostgreSQL indexes** provide minimal benefit (0.9x improvement) for this workload
- **Query pattern matters**: Discovery queries favor PostgreSQL, aggregation queries favor ClickHouse

## Setup

### Prerequisites

**ClickHouse Server**
```bash
# Docker
docker run -d --name clickhouse-server --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server

# Or install locally
curl https://clickhouse.com/ | sh
./clickhouse server
```

**PostgreSQL Server**
```bash
# Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15

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
npm start                                              # Run full test (with data generation)
npm run dev                                            # Development mode
npm run query-test                                     # Query-only test (100 iterations, requires existing data)
npm run query-test:custom -- --iterations=50          # Query-only test (custom iterations)
```

## Configuration

Edit `.env` file to configure:
- Database connections (host, port, password)
- Dataset sizes (small/large test datasets)
- Batch size for data insertion

## Output

Results in console, `output/test-results.json`, and `output/test-results.csv`.

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
5. **Long insertion times** - 10M+ rows take significant time, monitor progress with ETA
6. **Permission errors** - Ensure database users have CREATE/DROP/INSERT permissions

