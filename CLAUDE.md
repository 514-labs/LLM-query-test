# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an LLM query performance testing application that compares ClickHouse (OLAP) vs PostgreSQL (OLTP) performance using realistic aircraft tracking data and LLM-style query patterns. The application simulates how an AI would progressively discover and analyze data to answer questions.

## Commands

### Development
- `npm run dev` - Run in development mode with ts-node
- `npm run build` - Build TypeScript to JavaScript (outputs to `dist/`)
- `npm start` - Run full test with data generation
- `npm run query-test` - Run query-only test (100 iterations, 60min time limit)

### CLI Options (Commander.js)
All tools now use Commander.js for professional CLI experience:

**Main application:** 
- `node dist/src/index.js --query-only --iterations 50 --time-limit 120`
- Use `--help` to see all options and npm script documentation

**Bulk testing:**
- `node dist/src/testing/bulk-tester.js --sizes "1000,10000,100000" --time-limit 30`
- Custom dataset sizes and time limits via CLI flags

**Database management:**
- `npm run start-dbs` - Start all database containers automatically
- `node dist/src/utils/start-databases.js --cleanup-first` - Clean existing containers first

### Database Setup  
Use the automated database starter instead of manual Docker commands:
```bash
npm run start-dbs    # Starts ClickHouse + 2x PostgreSQL with proper configuration
npm run kill-dbs     # Stops and removes all containers
```

Manual setup (if needed):
- ClickHouse: `docker run -d --name clickhouse-server --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server`
- PostgreSQL: `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`

## Architecture

### Core Components (Organized by Module)
**Testing Module (`src/testing/`):**
- `PerformanceTester` - Main orchestrator that runs test configurations with optional timeout protection
- `getQueries()`, `executeQuery()` - LLM-style query definitions and execution (refactored from static class)
- `BulkTester` - Comprehensive testing across multiple dataset sizes with Commander.js CLI

**Database Module (`src/database/`):**  
- `ClickHouseDatabase` & `PostgreSQLDatabase` - Database-specific implementations with optimized schemas

**Data Module (`src/data/`):**
- `DataGenerator` - Creates realistic aircraft tracking datasets with streaming insertion  
- `generateAndInsertParallel()` - Parallel data insertion with worker threads

**Reporting Module (`src/reporting/`):**
- `ResultsReporter` - Outputs results with statistical analysis to console, JSON, and CSV
- `ASCIIGraphGenerator` - Performance visualization with Commander.js CLI

**Utils Module (`src/utils/`):**
- `cleanup()`, `clearDatabasesOnly()` - Database and file cleanup functions (refactored from static class)
- Database startup utilities with Commander.js CLI

### Test Flow
**Full Test (`npm start`):**
1. Initialize database connections
2. For each configuration: drop table → create table (±index) → generate data → insert data → run queries
3. Measure setup time and individual query execution times

**Query-Only Test (`npm run query-test`):**
1. Initialize database connections
2. For each configuration: run queries N iterations with timeout protection
3. Calculate statistical analysis (mean, median, std dev, min/max)
4. Generate comprehensive reports with confidence intervals

### Configuration
All configuration is read from `.env` file first, then overridden by CLI flags:

**Database Configuration:**
- Connection settings: `CLICKHOUSE_HOST/PORT`, `POSTGRES_HOST/PORT`, `POSTGRES_INDEXED_HOST/PORT`
- Container resources: `CLICKHOUSE_MEMORY/CPUS`, `POSTGRES_MEMORY/CPUS`, `POSTGRES_INDEXED_MEMORY/CPUS`

**Single Test Configuration:**
- `DATASET_SIZE` (default 10M) - Dataset size for single tests
- `BATCH_SIZE` (default 50K) - Batch size for data insertion
- `QUERY_TEST_ITERATIONS` (default 100) - Number of query test iterations
- `QUERY_TEST_TIME_LIMIT` (default 60) - Time limit for single query tests (minutes)

**Bulk Test Configuration:**
- `BULK_TEST_SIZES` - Comma-separated dataset sizes for bulk testing
- `BULK_TEST_TIME_LIMIT` - Time limit for each bulk test (minutes)
- `BULK_TEST_OUTPUT_DIR` - Output directory for bulk test results

**Test Configurations:**
- ClickHouse (no indexes needed - columnar storage optimized)
- PostgreSQL (with optimized indexes)  
- PostgreSQL (no indexes - baseline comparison)

### Data Structure - Aircraft Tracking (46 columns)
Realistic ADS-B aircraft tracking records with:
- **Position**: `lat`, `lon`, `alt_baro`, `alt_geom`, `gs`, `track`
- **Aircraft Info**: `hex`, `flight`, `aircraft_type`, `category`, `r`
- **Navigation**: `nav_qnh`, `nav_altitude_mcp`, `nav_heading`, `nav_modes`
- **Status Flags**: `approach`, `autopilot`, `althold`, `lnav`, `tcas`, `alt_baro_is_ground`
- **Technical**: `squawk`, `emergency`, `transponder_type`, `messages`, `rssi`
- **Quality Indicators**: `nic`, `rc`, `version`, `nic_baro`, `nac_p`, `nac_v`, `sil`
- **Arrays**: `nav_modes`, `mlat`, `tisb`
- **Timestamp**: `timestamp` (DateTime)

### LLM Query Pattern
Simulates progressive AI discovery for "How many aircraft are in the air on average every minute for the past hour?":
1. **Q1 Discovery**: `SHOW TABLES` / `information_schema` queries
2. **Q2 Exploration**: `SELECT * LIMIT 10` to understand data structure  
3. **Q3 Analysis**: Hourly aircraft counts with time bucketing and filtering
4. **Q4 Calculation**: CTE-based average calculation across time periods

### Output
Results saved to `output/` directory:
- `test-results.json` - Detailed timing data
- `test-results.csv` - Spreadsheet format
- Console table with formatted execution times