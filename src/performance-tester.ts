import { ClickHouseDatabase } from './database/clickhouse';
import { PostgreSQLDatabase } from './database/postgresql';
import { DataGenerator, AircraftTrackingRecord } from './data-generator';
import { TestQueries, QueryResult } from './queries';
import { config as appConfig } from './config';

export interface TestConfiguration {
  rowCount: number;
  withIndex: boolean;
  database: 'clickhouse' | 'postgresql';
}

export interface TestResults {
  configuration: TestConfiguration;
  setupTime: number;
  queryResults: QueryResult[];
  totalQueryTime: number;
  totalTime: number;
}

export class PerformanceTester {
  private clickhouse: ClickHouseDatabase;
  private postgresql: PostgreSQLDatabase;
  private dataGenerator: DataGenerator;

  constructor() {
    this.clickhouse = new ClickHouseDatabase();
    this.postgresql = new PostgreSQLDatabase();
    this.dataGenerator = new DataGenerator();
  }

  async initialize(): Promise<void> {
    console.log('Initializing database connections...');
    await this.clickhouse.connect();
    await this.postgresql.connect();
    console.log('Database connections established');
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up database connections...');
    await this.clickhouse.disconnect();
    await this.postgresql.disconnect();
    console.log('Database connections closed');
  }

  async runTest(config: TestConfiguration): Promise<TestResults> {
    console.log(`\n=== Running test: ${config.database.toUpperCase()} ${config.rowCount.toLocaleString()} rows ${config.withIndex ? '(with index)' : '(no index)'} ===`);
    
    const startTime = process.hrtime.bigint();
    
    // Setup phase
    const setupStartTime = process.hrtime.bigint();
    await this.setupTest(config);
    const setupEndTime = process.hrtime.bigint();
    const setupTime = Number(setupEndTime - setupStartTime) / 1_000_000;

    // Query execution phase
    const queryResults = await this.executeQueries(config);
    const totalQueryTime = queryResults.reduce((sum, result) => sum + result.duration, 0);

    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1_000_000;

    return {
      configuration: config,
      setupTime,
      queryResults,
      totalQueryTime,
      totalTime
    };
  }

  private async setupTest(config: TestConfiguration): Promise<void> {
    const database = config.database === 'clickhouse' ? this.clickhouse : this.postgresql;
    
    console.log('Dropping existing table...');
    await database.dropTable();
    
    console.log('Creating table...');
    if (config.withIndex) {
      await database.createTableWithIndex();
    } else {
      await database.createTable();
    }
    
    console.log('Generating and inserting test data...');
    await this.dataGenerator.generateAndInsertInBatches(database, config.rowCount, config.database, appConfig.test.batchSize);
    
    console.log('Test setup complete');
  }

  private async executeQueries(config: TestConfiguration): Promise<QueryResult[]> {
    const database = config.database === 'clickhouse' ? this.clickhouse : this.postgresql;
    const queries = TestQueries.getQueries();
    const results: QueryResult[] = [];

    for (const [key, queryDef] of Object.entries(queries)) {
      const query = config.database === 'clickhouse' ? queryDef.clickhouse : queryDef.postgresql;
      const result = await TestQueries.executeQuery(database, query, queryDef.name);
      results.push(result);
    }

    return results;
  }

  async runAllTests(): Promise<TestResults[]> {
    const configurations: TestConfiguration[] = [
      { rowCount: appConfig.test.smallDataset, withIndex: false, database: 'clickhouse' },
      { rowCount: appConfig.test.largeDataset, withIndex: false, database: 'clickhouse' },
      { rowCount: appConfig.test.smallDataset, withIndex: true, database: 'postgresql' },
      { rowCount: appConfig.test.largeDataset, withIndex: true, database: 'postgresql' },
      { rowCount: appConfig.test.smallDataset, withIndex: false, database: 'postgresql' },
      { rowCount: appConfig.test.largeDataset, withIndex: false, database: 'postgresql' },
    ];

    const allResults: TestResults[] = [];

    for (const config of configurations) {
      try {
        const result = await this.runTest(config);
        allResults.push(result);
      } catch (error) {
        console.error(`Test failed for configuration:`, config, error);
      }
    }

    return allResults;
  }
}