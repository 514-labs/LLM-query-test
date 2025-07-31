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
  iterations?: number;
  queryStats?: {
    mean: number[];
    median: number[];
    min: number[];
    max: number[];
    stdDev: number[];
  };
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

  async runQueryOnlyTests(iterations: number = 100): Promise<TestResults[]> {
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
        console.log(`\n=== Running ${iterations} query iterations: ${config.database.toUpperCase()} ${config.rowCount.toLocaleString()} rows ${config.withIndex ? '(with index)' : '(no index)'} ===`);
        console.log(`    Testing 4 queries: Q1 (discovery), Q2 (exploration), Q3 (aggregation), Q4 (calculation)`);
        
        const database = config.database === 'clickhouse' ? this.clickhouse : this.postgresql;
        const queries = TestQueries.getQueries();
        
        // Store all iteration results for statistical analysis
        const allIterationResults: QueryResult[][] = [];
        const startTime = Date.now();
        
        for (let iteration = 1; iteration <= iterations; iteration++) {
          const iterationResults: QueryResult[] = [];
          
          for (const [key, queryDef] of Object.entries(queries)) {
            const query = config.database === 'clickhouse' ? queryDef.clickhouse : queryDef.postgresql;
            const result = await TestQueries.executeQuery(database, query, queryDef.name, true); // Silent mode
            iterationResults.push(result);
          }
          
          allIterationResults.push(iterationResults);
          
          if (iteration % 5 === 0 || iteration === iterations) {
            const elapsed = Date.now() - startTime;
            const avgIterationTime = elapsed / iteration;
            const remainingIterations = iterations - iteration;
            const estimatedRemaining = remainingIterations * avgIterationTime;
            
            console.log(`   Progress: ${iteration}/${iterations} iterations (${(iteration/iterations*100).toFixed(1)}%) | Elapsed: ${this.formatTime(elapsed)} | ETA: ${this.formatTime(estimatedRemaining)}`);
          }
        }
        
        console.log(`    Completed all ${iterations} iterations in ${this.formatTime(Date.now() - startTime)}`);
        console.log(`    Calculating statistics...`);
        
        // Calculate statistics
        const queryStats = this.calculateQueryStatistics(allIterationResults);
        
        // Create representative result using median values
        const representativeResults: QueryResult[] = queries ? Object.values(queries).map((queryDef, index) => ({
          name: queryDef.name,
          duration: queryStats.median[index],
          rows: allIterationResults[0][index].rows,
          data: undefined
        })) : [];
        
        const result: TestResults = {
          configuration: config,
          setupTime: 0, // No setup for query-only tests
          queryResults: representativeResults,
          totalQueryTime: queryStats.median.reduce((sum, duration) => sum + duration, 0),
          totalTime: queryStats.median.reduce((sum, duration) => sum + duration, 0),
          iterations,
          queryStats
        };
        
        allResults.push(result);
        
      } catch (error) {
        console.error(`Query test failed for configuration:`, config, error);
      }
    }

    return allResults;
  }

  private calculateQueryStatistics(allIterationResults: QueryResult[][]): {
    mean: number[];
    median: number[];
    min: number[];
    max: number[];
    stdDev: number[];
  } {
    const numQueries = allIterationResults[0].length;
    const stats = {
      mean: new Array(numQueries).fill(0),
      median: new Array(numQueries).fill(0),
      min: new Array(numQueries).fill(Infinity),
      max: new Array(numQueries).fill(0),
      stdDev: new Array(numQueries).fill(0)
    };

    // Collect all durations for each query
    const queryDurations: number[][] = Array(numQueries).fill(null).map(() => []);
    
    for (const iterationResults of allIterationResults) {
      for (let queryIndex = 0; queryIndex < numQueries; queryIndex++) {
        const duration = iterationResults[queryIndex].duration;
        queryDurations[queryIndex].push(duration);
        
        stats.min[queryIndex] = Math.min(stats.min[queryIndex], duration);
        stats.max[queryIndex] = Math.max(stats.max[queryIndex], duration);
      }
    }

    // Calculate mean, median, and standard deviation for each query
    for (let queryIndex = 0; queryIndex < numQueries; queryIndex++) {
      const durations = queryDurations[queryIndex];
      
      // Mean
      stats.mean[queryIndex] = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      
      // Median
      const sorted = [...durations].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      stats.median[queryIndex] = sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
      
      // Standard deviation
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - stats.mean[queryIndex], 2), 0) / durations.length;
      stats.stdDev[queryIndex] = Math.sqrt(variance);
    }

    return stats;
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }
}