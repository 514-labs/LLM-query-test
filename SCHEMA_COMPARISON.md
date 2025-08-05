# Database Schema Comparison

Complete schema definitions for aircraft tracking performance test across ClickHouse (OLAP) and PostgreSQL (OLTP) implementations.

## Overview

This benchmark uses a 46-column aircraft tracking dataset based on ADS-B (Automatic Dependent Surveillance-Broadcast) data, representing realistic aviation telemetry with position, navigation, transponder, and metadata fields.

## Complete Schema Comparison

| Field | ClickHouse | PostgreSQL | PostgreSQL w/Index | Notes |
|-------|------------|------------|-------------------|--------|
| **zorderCoordinate** | `UInt64` | `BIGINT` | `BIGINT` | |
| **approach** | `Bool` | `BOOLEAN` | `BOOLEAN` | |
| **autopilot** | `Bool` | `BOOLEAN` | `BOOLEAN` | |
| **althold** | `Bool` | `BOOLEAN` | `BOOLEAN` | |
| **lnav** | `Bool` | `BOOLEAN` | `BOOLEAN` | |
| **tcas** | `Bool` | `BOOLEAN` | `BOOLEAN` | |
| **hex** | `FixedString(6)` | `CHAR(6)` | `CHAR(6)` + `idx_hex` | CH: ORDER BY field, PG: indexed for performance |
| **transponder_type** | `LowCardinality(String)` | `VARCHAR(50)` | `VARCHAR(50)` | CH: categorical optimization |
| **flight** | `String` | `VARCHAR(50)` | `VARCHAR(50)` | PG: length limit for compatibility |
| **r** | `String` | `VARCHAR(10)` | `VARCHAR(10)` | PG: length limit for compatibility |
| **aircraft_type** | `LowCardinality(String) DEFAULT ''` | `VARCHAR(50) DEFAULT ''` | `VARCHAR(50) DEFAULT ''` | CH: categorical optimization, PG: length limit |
| **dbFlags** | `UInt32` | `INTEGER` (as `dbflags`) | `INTEGER` (as `dbflags`) | PG: lowercase naming convention |
| **lat** | `Float64` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | |
| **lon** | `Float64` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | |
| **alt_baro** | `Int32` | `INTEGER` | `INTEGER` | |
| **alt_baro_is_ground** | `Bool` | `BOOLEAN` | `BOOLEAN` + `idx_ground_timestamp` | CH: ORDER BY field (first), PG: composite index for query optimization |
| **alt_geom** | `Int32` | `INTEGER` | `INTEGER` | |
| **gs** | `UInt16` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **track** | `UInt16` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **baro_rate** | `Int16` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **geom_rate** | `Int16 DEFAULT 0` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **squawk** | `FixedString(4)` | `CHAR(4)` | `CHAR(4)` | |
| **emergency** | `LowCardinality(String)` | `VARCHAR(50)` | `VARCHAR(50)` | CH: categorical optimization, PG: length limit |
| **category** | `LowCardinality(String)` | `VARCHAR(10)` | `VARCHAR(10)` | CH: categorical optimization, PG: length limit |
| **nav_qnh** | `UInt16 DEFAULT 0` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **nav_altitude_mcp** | `UInt16 DEFAULT 0` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **nav_heading** | `UInt16 DEFAULT 0` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **nav_modes** | `Array(LowCardinality(String))` | `TEXT[]` | `TEXT[]` | CH: nested categorical optimization |
| **nic** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **rc** | `UInt16` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **seen_pos** | `Float32` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **version** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **nic_baro** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **nac_p** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **nac_v** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **sil** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **sil_type** | `LowCardinality(String)` | `VARCHAR(50)` | `VARCHAR(50)` | CH: categorical optimization, PG: length limit |
| **gva** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **sda** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **alert** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **spi** | `UInt8` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **mlat** | `Array(LowCardinality(String))` | `TEXT[]` | `TEXT[]` | CH: nested categorical optimization |
| **tisb** | `Array(LowCardinality(String))` | `TEXT[]` | `TEXT[]` | CH: nested categorical optimization |
| **messages** | `UInt32` | `INTEGER` | `INTEGER` | CH: storage optimization |
| **seen** | `Float32` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **rssi** | `Float32` | `DOUBLE PRECISION` | `DOUBLE PRECISION` | CH: storage optimization, PG: standard precision |
| **timestamp** | `DateTime` | `TIMESTAMP` | `TIMESTAMP` + multiple indexes | CH: ORDER BY field (third), PG: indexed for query performance |

## Storage Engine & Optimization

### ClickHouse (OLAP)
```sql
ENGINE = MergeTree()
ORDER BY (alt_baro_is_ground, hex, timestamp)
```
- **Optimized for analytics**: Columnar storage, compression
- **Smart ordering**: Boolean filter first, then aircraft ID, then time
- **Type efficiency**: `UInt8/16/32`, `FixedString`, `LowCardinality` for storage savings
- **No indexes needed**: ORDER BY clause provides sorting optimization

### PostgreSQL (OLTP)
```sql
-- Base table (no additional indexes)
CREATE TABLE performance_test (...);
```
- **Standard SQL types**: Compatible with existing tools
- **Row-based storage**: Better for transactional workloads
- **Flexible typing**: `DOUBLE PRECISION`, `VARCHAR`, `TEXT[]`

### PostgreSQL with Indexes
```sql
-- Optimized indexes for analytical queries
CREATE INDEX idx_performance_test_timestamp_ground ON performance_test(timestamp, alt_baro_is_ground);
CREATE INDEX idx_performance_test_ground_timestamp ON performance_test(alt_baro_is_ground, timestamp);
CREATE INDEX idx_performance_test_hex ON performance_test(hex);
CREATE INDEX idx_performance_test_hex_timestamp ON performance_test(hex, timestamp);
CREATE INDEX idx_performance_test_timestamp ON performance_test(timestamp);
```

## Field Mapping

PostgreSQL uses lowercase field names for compatibility:
- `zorderCoordinate` → `zordercoordinate`
- `dbFlags` → `dbflags`

All other fields maintain consistent naming across implementations.