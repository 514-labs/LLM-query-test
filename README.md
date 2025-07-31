# Database Performance Testing Application

A comprehensive testing application to compare the performance of ClickHouse (analytical) vs PostgreSQL (transactional) databases across different scenarios.

## Features

- Tests both ClickHouse and PostgreSQL with identical datasets
- Supports 1M and 100M row datasets
- Tests with and without timestamp indexes
- Measures precise execution times using high-resolution timers
- Generates detailed reports in console, JSON, and CSV formats
- Implements the exact 4 queries from your comparison table

## Test Scenarios

The application runs these exact test configurations:

1. **1M rows ClickHouse**
2. **100M rows ClickHouse**
3. **1M rows PostgreSQL (with timestamp index)**
4. **100M rows PostgreSQL (with timestamp index)**
5. **1M rows PostgreSQL (no timestamp index)**
6. **100M rows PostgreSQL (no timestamp index)**

## Test Queries

1. **Q1 Show table** - Describes table structure
2. **Q2 Select * limit 10** - Simple select with limit
3. **Q3 Hourly count** - Aggregation by hour with grouping
4. **Q4 Average calculation** - Complex aggregation with multiple functions

## Setup

### Prerequisites

1. **ClickHouse Server**
   ```bash
   # Docker
   docker run -d --name clickhouse-server --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
   
   # Or install locally
   curl https://clickhouse.com/ | sh
   ./clickhouse server
   ```

2. **PostgreSQL Server**
   ```bash
   # Docker
   docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
   
   # Or install locally
   brew install postgresql
   brew services start postgresql
   ```

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database connection details
   ```

3. **Build the application**
   ```bash
   npm run build
   ```

## Usage

### Run all tests
```bash
npm start
```

### Run in development mode
```bash
npm run dev
```

## Configuration

Edit `.env` file to configure database connections:

```env
# ClickHouse Configuration
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=performance_test
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=performance_test
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres

# Test Configuration
# Small dataset size for faster iteration (default: 1000) 
SMALL_DATASET_SIZE=1000
# Large dataset size for comparison (default: 10000)
LARGE_DATASET_SIZE=10000
```

### Dataset Size Configuration

For faster development and testing, you can adjust the dataset sizes:

- **Small dataset**: Set `SMALL_DATASET_SIZE` (default: 1000 rows)
- **Large dataset**: Set `LARGE_DATASET_SIZE` (default: 10000 rows)

For quick iteration during development:
```env
SMALL_DATASET_SIZE=100
LARGE_DATASET_SIZE=500
```

For production-like testing:
```env
SMALL_DATASET_SIZE=1000000
LARGE_DATASET_SIZE=100000000
```

## Output

The application generates:

1. **Console output** - Real-time progress and formatted results table
2. **JSON file** - Detailed results in `output/test-results.json`
3. **CSV file** - Spreadsheet-friendly format in `output/test-results.csv`

## Example Output

```
+----------+------+-------+---------------+-------------------+---------------+---------------------+----------+
| Database | Rows | Index | Q1 Show table | Q2 Select * limit | Q3 Hourly count | Q4 Average calc   | Total    |
+----------+------+-------+---------------+-------------------+---------------+---------------------+----------+
| CH       | 1m   | no    | 50 ms         | 100 ms            | 500 ms        | 500 ms              | 1.2 s    |
| CH       | 100m | no    | 50 ms         | 100 ms            | 2.5 s         | 2.5 s               | 5.2 s    |
| PG       | 1m   | yes   | 100 ms        | 100 ms            | 2.0 s         | 2.0 s               | 4.2 s    |
| PG       | 100m | yes   | 100 ms        | 100 ms            | 30.0 s        | 30.0 s              | 1.0 m    |
| PG       | 1m   | no    | 100 ms        | 100 ms            | 5.0 s         | 5.0 s               | 10.2 s   |
| PG       | 100m | no    | 100 ms        | 100 ms            | 10.0 m        | 10.0 m              | 20.2 m   |
+----------+------+-------+---------------+-------------------+---------------+---------------------+----------+
```

## Architecture

- **TypeScript** for type safety and better development experience
- **Modular design** with separate classes for each responsibility
- **High-precision timing** using `process.hrtime.bigint()`
- **Batch data insertion** for efficient large dataset handling
- **Connection pooling** for PostgreSQL performance
- **Error handling** with graceful cleanup

## Troubleshooting

1. **Database connection issues** - Check that both ClickHouse and PostgreSQL are running and accessible
2. **Memory issues with 100M rows** - Ensure sufficient RAM (recommended 8GB+)
3. **Timeout errors** - Large dataset operations may take significant time
4. **Permission errors** - Ensure database users have CREATE/DROP/INSERT permissions