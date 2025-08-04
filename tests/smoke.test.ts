#!/usr/bin/env node
import { ClickHouseDatabase } from '../src/database/clickhouse';
import { PostgreSQLDatabase } from '../src/database/postgresql';
import { DataGenerator } from '../src/data/generator';
import { getQueries, executeQuery } from '../src/testing/queries';
import { ConfigValidator } from '../src/config/validator';
import * as fs from 'fs';
import * as path from 'path';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const prefix = {
    info: '🔍',
    success: `${GREEN}✓${RESET}`,
    error: `${RED}✗${RESET}`,
    warning: `${YELLOW}⚠${RESET}`
  };
  console.log(`${prefix[type]} ${message}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passedTests++;
    log(name, 'success');
  } catch (error) {
    failedTests++;
    log(`${name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

async function runSmokeTests() {
  console.log('\n🚀 Running Smoke Tests\n');

  // Test 1: Configuration Validation
  await test('Configuration validation', async () => {
    const validator = new ConfigValidator();
    
    // This will throw if validation fails
    validator.validatePort('CLICKHOUSE_PORT', 8123);
    validator.validatePort('POSTGRES_PORT', 5432);
    validator.validateMemory('CLICKHOUSE_MEMORY', '4g');
    validator.validateCpus('CLICKHOUSE_CPUS', '2');
    
    const errors = validator.getErrors();
    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.map(e => e.message).join(', ')}`);
    }
  });

  // Test 2: Database Connections
  const clickhouse = new ClickHouseDatabase();
  const postgresql = new PostgreSQLDatabase();
  let dbsConnected = false;

  await test('Database connections', async () => {
    await clickhouse.ensureDatabaseExists();
    await postgresql.ensureDatabaseExists();
    
    await clickhouse.connect();
    await postgresql.connect();
    dbsConnected = true;
  });

  if (!dbsConnected) {
    log('Cannot continue without database connections', 'error');
    process.exit(1);
  }

  // Test 3: Table Creation
  await test('Table creation', async () => {
    await clickhouse.dropTable();
    await postgresql.dropTable();
    
    await clickhouse.createTable();
    await postgresql.createTable();
  });

  // Test 4: Data Generation and Validation
  const TEST_SIZE = 100;
  let testData: any[] = [];

  await test('Data generation (deterministic)', async () => {
    const generator1 = new DataGenerator('test-seed');
    const generator2 = new DataGenerator('test-seed');
    
    const data1 = generator1.generateTestData(10, 'clickhouse');
    const data2 = generator2.generateTestData(10, 'clickhouse');
    
    // Check deterministic generation
    if (JSON.stringify(data1) !== JSON.stringify(data2)) {
      throw new Error('Data generation is not deterministic with same seed');
    }
    
    testData = data1;
  });

  await test('Data validation - required fields', async () => {
    // Create a generator that produces data spanning multiple days for query testing
    const generator = new DataGenerator('test-seed-validation');
    const data = [];
    
    // Generate data for today, yesterday, and day before yesterday
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    
    // Mock the date range by temporarily modifying the generator's time logic
    // Generate some records for each day to ensure Q4 has data to work with
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const dayData = generator.generateTestData(Math.ceil(TEST_SIZE / 3), 'clickhouse');
      
      // Adjust timestamps to span multiple days
      const targetDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      dayData.forEach((record: any) => {
        // Set timestamp to target day with some randomness within the day
        const randomHour = Math.floor(Math.random() * 24);
        const randomMinute = Math.floor(Math.random() * 60);
        const adjustedDate = new Date(targetDate);
        adjustedDate.setHours(randomHour, randomMinute, 0, 0);
        record.timestamp = adjustedDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      });
      
      data.push(...dayData);
    }
    
    // Use the combined data for validation
    const validationData = data.slice(0, TEST_SIZE);
    
    const requiredFields = [
      'hex', 'flight', 'lat', 'lon', 'alt_baro', 'timestamp',
      'zorderCoordinate', 'approach', 'autopilot', 'dbFlags'
    ];
    
    for (const record of validationData) {
      for (const field of requiredFields) {
        if ((record as any)[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    testData = data;
  });

  await test('Data validation - field types', async () => {
    for (const record of testData) {
      // Check numeric fields
      if (typeof record.lat !== 'number' || record.lat < -90 || record.lat > 90) {
        throw new Error(`Invalid latitude: ${record.lat}`);
      }
      if (typeof record.lon !== 'number' || record.lon < -180 || record.lon > 180) {
        throw new Error(`Invalid longitude: ${record.lon}`);
      }
      if (typeof record.alt_baro !== 'number' || record.alt_baro < -2000 || record.alt_baro > 60000) {
        throw new Error(`Invalid altitude: ${record.alt_baro}`);
      }
      
      // Check boolean fields
      if (typeof record.approach !== 'boolean') {
        throw new Error(`Invalid boolean field 'approach': ${record.approach}`);
      }
      
      // Check string fields
      if (typeof record.hex !== 'string' || record.hex.length !== 6) {
        throw new Error(`Invalid hex code: ${record.hex}`);
      }
      
      // Check timestamp format
      if (typeof record.timestamp !== 'string' || !record.timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        throw new Error(`Invalid timestamp format: ${record.timestamp}`);
      }
    }
  });

  // Test 5: Data Insertion
  await test('Data insertion - ClickHouse', async () => {
    await clickhouse.insertBatch(testData);
  });

  await test('Data insertion - PostgreSQL', async () => {
    await postgresql.insertBatch(testData);
  });

  // Test 6: Query Correctness
  await test('Query correctness - Q1 (metadata)', async () => {
    const queries = getQueries();
    
    // ClickHouse
    const chResult = await executeQuery(
      clickhouse, 
      queries.q1_show_tables.clickhouse, 
      'Q1 ClickHouse Test', 
      true
    );
    
    if (!chResult || chResult.rows === 0) {
      throw new Error('ClickHouse Q1 returned no results');
    }
    
    // PostgreSQL
    const pgResult = await executeQuery(
      postgresql, 
      queries.q1_show_tables.postgresql, 
      'Q1 PostgreSQL Test', 
      true
    );
    
    if (!pgResult || pgResult.rows === 0) {
      throw new Error('PostgreSQL Q1 returned no results');
    }
  });

  await test('Query correctness - Q2 (sample)', async () => {
    const queries = getQueries();
    
    // Both should return exactly 10 rows
    const chResult = await clickhouse.query(queries.q2_explore_schema.clickhouse);
    const pgResult = await postgresql.query(queries.q2_explore_schema.postgresql);
    
    if (chResult.length !== 10) {
      throw new Error(`ClickHouse Q2 returned ${chResult.length} rows, expected 10`);
    }
    
    if (pgResult.length !== 10) {
      throw new Error(`PostgreSQL Q2 returned ${pgResult.length} rows, expected 10`);
    }
    
    // Verify essential fields exist
    const essentialFields = ['hex', 'flight', 'lat', 'lon', 'alt_baro', 'timestamp'];
    
    for (const field of essentialFields) {
      if (!(field in chResult[0])) {
        throw new Error(`ClickHouse Q2 missing field: ${field}`);
      }
      if (!(field in pgResult[0])) {
        throw new Error(`PostgreSQL Q2 missing field: ${field}`);
      }
    }
  });

  await test('Query correctness - Q3 (analytical)', async () => {
    const queries = getQueries();
    
    const chResult = await clickhouse.query(queries.q3_hourly_aircraft_today.clickhouse);
    const pgResult = await postgresql.query(queries.q3_hourly_aircraft_today.postgresql);
    
    // Should return hourly buckets
    if (chResult.length === 0) {
      throw new Error('ClickHouse Q3 returned no hourly buckets');
    }
    
    if (pgResult.length === 0) {
      throw new Error('PostgreSQL Q3 returned no hourly buckets');
    }
    
    // Verify result structure
    if (!('hour_bucket' in chResult[0]) || !('unique_aircraft_count' in chResult[0])) {
      throw new Error('ClickHouse Q3 missing expected columns');
    }
    
    if (!('hour_bucket' in pgResult[0]) || !('unique_aircraft_count' in pgResult[0])) {
      throw new Error('PostgreSQL Q3 missing expected columns');
    }
  });

  await test('Query correctness - Q4 (hourly buckets)', async () => {
    const queries = getQueries();
    
    const chResult = await clickhouse.query(queries.q4_hourly_aircraft_day_before_yesterday.clickhouse);
    const pgResult = await postgresql.query(queries.q4_hourly_aircraft_day_before_yesterday.postgresql);
    
    // Should return hourly buckets (may be multiple rows)
    if (chResult.length === 0) {
      throw new Error('ClickHouse Q4 returned no hourly buckets');
    }
    
    if (pgResult.length === 0) {
      throw new Error('PostgreSQL Q4 returned no hourly buckets');
    }
    
    // Verify result structure for hourly data
    if (!('hour_bucket' in chResult[0]) || !('unique_aircraft_count' in chResult[0])) {
      throw new Error('ClickHouse Q4 missing expected columns (hour_bucket, unique_aircraft_count)');
    }
    
    if (!('hour_bucket' in pgResult[0]) || !('unique_aircraft_count' in pgResult[0])) {
      throw new Error('PostgreSQL Q4 missing expected columns (hour_bucket, unique_aircraft_count)');
    }
    
    // Both should return numeric aircraft counts
    const chCount = parseInt(chResult[0].unique_aircraft_count);
    const pgCount = parseInt(pgResult[0].unique_aircraft_count);
    
    if (isNaN(chCount) || chCount < 0) {
      throw new Error(`Invalid ClickHouse aircraft count: ${chCount}`);
    }
    
    if (isNaN(pgCount) || pgCount < 0) {
      throw new Error(`Invalid PostgreSQL aircraft count: ${pgCount}`);
    }
  });

  // Test 7: Full Query Execution Flow
  await test('Full query execution flow', async () => {
    const queries = getQueries();
    const results = [];
    
    for (const [key, queryDef] of Object.entries(queries)) {
      const chResult = await executeQuery(
        clickhouse,
        queryDef.clickhouse,
        `${queryDef.name} (ClickHouse)`,
        true
      );
      
      const pgResult = await executeQuery(
        postgresql,
        queryDef.postgresql,
        `${queryDef.name} (PostgreSQL)`,
        true
      );
      
      if (!chResult || !pgResult) {
        throw new Error(`Failed to execute ${queryDef.name}`);
      }
      
      results.push({ query: queryDef.name, clickhouse: chResult, postgresql: pgResult });
    }
    
    // All 4 queries should have executed
    if (results.length !== 4) {
      throw new Error(`Expected 4 query results, got ${results.length}`);
    }
  });

  // Cleanup
  await test('Cleanup', async () => {
    await clickhouse.dropTable();
    await postgresql.dropTable();
    await clickhouse.disconnect();
    await postgresql.disconnect();
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`${GREEN}Passed:${RESET} ${passedTests}`);
  console.log(`${RED}Failed:${RESET} ${failedTests}`);
  console.log('='.repeat(50));
  
  if (failedTests > 0) {
    console.log(`\n${RED}❌ Smoke tests failed!${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}✅ All smoke tests passed!${RESET}\n`);
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  runSmokeTests().catch(error => {
    console.error('Smoke test runner failed:', error);
    process.exit(1);
  });
}