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
- `npm run query-test -- --time-limit=120` - Custom time limit
- `npm run query-test -- --iterations=50` - Custom iterations

### Database Setup
Before running tests, ensure database servers are running:
- ClickHouse: `docker run -d --name clickhouse-server --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server`
- PostgreSQL: `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`

## Architecture

### Core Components
- `PerformanceTester` - Main orchestrator that runs test configurations with optional timeout protection
- `ClickHouseDatabase` & `PostgreSQLDatabase` - Database-specific implementations with optimized schemas
- `DataGenerator` - Creates realistic aircraft tracking datasets with streaming insertion
- `TestQueries` - Defines 4 LLM-style queries with database-specific versions
- `ResultsReporter` - Outputs results with statistical analysis to console, JSON, and CSV

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
- Database connections configured via `.env` file
- Dataset sizes: `SMALL_DATASET_SIZE` (default 1M), `LARGE_DATASET_SIZE` (default 10M)
- Batch size: `BATCH_SIZE` (default 100K)
- Test configurations run automatically:
  - 1M/10M rows ClickHouse (no indexes needed)
  - 1M/10M rows PostgreSQL (with optimized indexes)  
  - 1M/10M rows PostgreSQL (no indexes - baseline)

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