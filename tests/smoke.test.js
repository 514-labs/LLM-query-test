#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const clickhouse_1 = require("../src/database/clickhouse");
const postgresql_1 = require("../src/database/postgresql");
const data_generator_1 = require("../src/data-generator");
const queries_1 = require("../src/queries");
const config_validator_1 = require("../src/config-validator");
// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
let passedTests = 0;
let failedTests = 0;
function log(message, type = 'info') {
    const prefix = {
        info: '🔍',
        success: `${GREEN}✓${RESET}`,
        error: `${RED}✗${RESET}`,
        warning: `${YELLOW}⚠${RESET}`
    };
    console.log(`${prefix[type]} ${message}`);
}
async function test(name, fn) {
    try {
        await fn();
        passedTests++;
        log(name, 'success');
    }
    catch (error) {
        failedTests++;
        log(`${name}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
}
async function runSmokeTests() {
    console.log('\n🚀 Running Smoke Tests\n');
    // Test 1: Configuration Validation
    await test('Configuration validation', async () => {
        const validator = new config_validator_1.ConfigValidator();
        // This will throw if validation fails
        validator.validatePort('CLICKHOUSE_PORT', 8123);
        validator.validatePort('POSTGRES_PORT', 5432);
        validator.validateMemory('CLICKHOUSE_MEMORY', '4g');
        validator.validateCPUs('CLICKHOUSE_CPUS', 2);
        const errors = validator.getErrors();
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.map(e => e.message).join(', ')}`);
        }
    });
    // Test 2: Database Connections
    const clickhouse = new clickhouse_1.ClickHouseDatabase();
    const postgresql = new postgresql_1.PostgreSQLDatabase();
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
    let testData = [];
    await test('Data generation (deterministic)', async () => {
        const generator1 = new data_generator_1.DataGenerator('test-seed');
        const generator2 = new data_generator_1.DataGenerator('test-seed');
        const data1 = generator1.generateTestData(10, 'clickhouse');
        const data2 = generator2.generateTestData(10, 'clickhouse');
        // Check deterministic generation
        if (JSON.stringify(data1) !== JSON.stringify(data2)) {
            throw new Error('Data generation is not deterministic with same seed');
        }
        testData = data1;
    });
    await test('Data validation - required fields', async () => {
        const generator = new data_generator_1.DataGenerator();
        const data = generator.generateTestData(TEST_SIZE, 'clickhouse');
        const requiredFields = [
            'hex', 'flight', 'lat', 'lon', 'alt_baro', 'timestamp',
            'zorderCoordinate', 'approach', 'autopilot', 'dbFlags'
        ];
        for (const record of data) {
            for (const field of requiredFields) {
                if (record[field] === undefined) {
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
        const queries = queries_1.TestQueries.getQueries();
        // ClickHouse
        const chResult = await queries_1.TestQueries.executeQuery(clickhouse, queries.q1.clickhouse, 'Q1 ClickHouse Test', true);
        if (!chResult || chResult.rows === 0) {
            throw new Error('ClickHouse Q1 returned no results');
        }
        // PostgreSQL
        const pgResult = await queries_1.TestQueries.executeQuery(postgresql, queries.q1.postgresql, 'Q1 PostgreSQL Test', true);
        if (!pgResult || pgResult.rows === 0) {
            throw new Error('PostgreSQL Q1 returned no results');
        }
    });
    await test('Query correctness - Q2 (sample)', async () => {
        const queries = queries_1.TestQueries.getQueries();
        // Both should return exactly 10 rows
        const chResult = await clickhouse.query(queries.q2.clickhouse);
        const pgResult = await postgresql.query(queries.q2.postgresql);
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
        const queries = queries_1.TestQueries.getQueries();
        const chResult = await clickhouse.query(queries.q3.clickhouse);
        const pgResult = await postgresql.query(queries.q3.postgresql);
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
    await test('Query correctness - Q4 (CTE calculation)', async () => {
        const queries = queries_1.TestQueries.getQueries();
        const chResult = await clickhouse.query(queries.q4.clickhouse);
        const pgResult = await postgresql.query(queries.q4.postgresql);
        // Should return single row with average
        if (chResult.length !== 1) {
            throw new Error(`ClickHouse Q4 returned ${chResult.length} rows, expected 1`);
        }
        if (pgResult.length !== 1) {
            throw new Error(`PostgreSQL Q4 returned ${pgResult.length} rows, expected 1`);
        }
        // Verify average calculation
        if (!('avg_aircraft_per_minute' in chResult[0])) {
            throw new Error('ClickHouse Q4 missing avg_aircraft_per_minute');
        }
        if (!('avg_aircraft_per_minute' in pgResult[0])) {
            throw new Error('PostgreSQL Q4 missing avg_aircraft_per_minute');
        }
        // Both should return numeric values
        const chAvg = parseFloat(chResult[0].avg_aircraft_per_minute);
        const pgAvg = parseFloat(pgResult[0].avg_aircraft_per_minute);
        if (isNaN(chAvg) || chAvg < 0) {
            throw new Error(`Invalid ClickHouse average: ${chAvg}`);
        }
        if (isNaN(pgAvg) || pgAvg < 0) {
            throw new Error(`Invalid PostgreSQL average: ${pgAvg}`);
        }
    });
    // Test 7: Full Query Execution Flow
    await test('Full query execution flow', async () => {
        const queries = queries_1.TestQueries.getQueries();
        const results = [];
        for (const [key, queryDef] of Object.entries(queries)) {
            const chResult = await queries_1.TestQueries.executeQuery(clickhouse, queryDef.clickhouse, `${queryDef.name} (ClickHouse)`, true);
            const pgResult = await queries_1.TestQueries.executeQuery(postgresql, queryDef.postgresql, `${queryDef.name} (PostgreSQL)`, true);
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
    }
    else {
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
