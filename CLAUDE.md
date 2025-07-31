# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a database performance testing application that compares ClickHouse (analytical) vs PostgreSQL (transactional) performance. The application tests both databases with identical datasets (1M and 100M rows) and measures execution times for 4 specific queries.

## Commands

### Development
- `npm run dev` - Run in development mode with ts-node
- `npm run build` - Build TypeScript to JavaScript (outputs to `dist/`)
- `npm start` - Run the compiled application
- `npm run test` - Build and run the performance tests

### Database Setup
Before running tests, ensure database servers are running:
- ClickHouse: `docker run -d --name clickhouse-server --ulimit nofile=262144:262144 -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server`
- PostgreSQL: `docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15`

## Architecture

### Core Components
- `PerformanceTester` - Main orchestrator that runs all test configurations
- `ClickHouseDatabase` & `PostgreSQLDatabase` - Database-specific implementations
- `DataGenerator` - Creates test datasets and handles batch insertions
- `TestQueries` - Defines the 4 test queries with database-specific versions
- `ResultsReporter` - Outputs results to console, JSON, and CSV formats

### Test Flow
1. Initialize database connections
2. For each configuration: drop table → create table (±index) → generate data → insert data → run queries
3. Measure setup time and individual query execution times
4. Generate comprehensive reports

### Configuration
- Database connections configured via `.env` file (see README for format)
- Test configurations hardcoded in `PerformanceTester.runAllTests()`:
  - 1M/100M rows for ClickHouse (no index)
  - 1M/100M rows for PostgreSQL (with/without timestamp index)

### Data Structure
Test data uses this schema:
- `id` (auto-increment)
- `timestamp` (DateTime/TIMESTAMP)
- `value` (Float64/REAL)
- `category` (String/VARCHAR)

### Output
Results saved to `output/` directory:
- `test-results.json` - Detailed timing data
- `test-results.csv` - Spreadsheet format
- Console table with formatted execution times