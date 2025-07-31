import { TestResults } from './performance-tester';
import * as fs from 'fs';
import * as path from 'path';

export class ResultsReporter {
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)} ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)} s`;
    } else {
      return `${(ms / 60000).toFixed(1)} m`;
    }
  }

  static printResults(results: TestResults[]): void {
    console.log('\n' + '='.repeat(100));
    const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
    console.log(`DATABASE PERFORMANCE COMPARISON - LLM QUERY PATTERNS${isQueryOnly ? ' (QUERY STATS)' : ''}`);
    console.log('='.repeat(100));

    // Group results by dataset size for better comparison
    const grouped = this.groupResultsBySize(results);
    
    for (const [size, sizeResults] of Object.entries(grouped)) {
      console.log(`\n📊 DATASET SIZE: ${size} ROWS`);
      if (isQueryOnly && sizeResults[0]?.iterations) {
        console.log(`   (${sizeResults[0].iterations} iterations per test)`);
      }
      console.log('-'.repeat(80));
      
      const tableData = this.createComparisonTable(sizeResults);
      this.printTable(tableData);
      
      // Add statistical details for query-only tests
      if (isQueryOnly) {
        this.printQueryStatistics(sizeResults);
      }
      
      // Add performance insights
      this.printPerformanceInsights(sizeResults);
    }

    // Overall summary
    console.log('\n' + '='.repeat(100));
    console.log('SUMMARY');
    console.log('='.repeat(100));
    this.printOverallSummary(results);
  }

  private static createComparisonTable(results: TestResults[]): any[][] {
    const headers = [
      'Database',
      'Index',
      'Rows',
      'Q1 (ms)',
      'Q2 (ms)',
      'Q3 (ms)',
      'Q4 (ms)',
      'Total (ms)',
      'Setup (s)'
    ];

    const rows = results.map(result => {
      const config = result.configuration;
      const dbName = config.database === 'clickhouse' ? 'ClickHouse' : 'PostgreSQL';
      const indexStatus = config.withIndex ? '✓' : '✗';
      const rowCount = config.rowCount >= 1000000 
        ? `${(config.rowCount / 1000000).toFixed(0)}M`
        : `${(config.rowCount / 1000).toFixed(0)}K`;
      
      return [
        dbName,
        indexStatus,
        rowCount,
        (result.queryResults[0]?.duration || 0).toFixed(1),
        (result.queryResults[1]?.duration || 0).toFixed(1),
        (result.queryResults[2]?.duration || 0).toFixed(1),
        (result.queryResults[3]?.duration || 0).toFixed(1),
        result.totalQueryTime.toFixed(1),
        (result.setupTime / 1000).toFixed(1)
      ];
    });

    return [headers, ...rows];
  }

  private static groupResultsBySize(results: TestResults[]): Record<string, TestResults[]> {
    const grouped: Record<string, TestResults[]> = {};
    
    for (const result of results) {
      const size = result.configuration.rowCount >= 1000000 
        ? `${(result.configuration.rowCount / 1000000).toFixed(0)}M`
        : `${(result.configuration.rowCount / 1000).toFixed(0)}K`;
      
      if (!grouped[size]) {
        grouped[size] = [];
      }
      grouped[size].push(result);
    }
    
    return grouped;
  }

  private static printPerformanceInsights(results: TestResults[]): void {
    if (results.length < 2) return;
    
    const ch = results.find(r => r.configuration.database === 'clickhouse');
    const pgIndexed = results.find(r => r.configuration.database === 'postgresql' && r.configuration.withIndex);
    const pgNoIndex = results.find(r => r.configuration.database === 'postgresql' && !r.configuration.withIndex);
    
    console.log('\n💡 Performance Insights:');
    
    if (ch && pgIndexed) {
      const speedup = pgIndexed.totalQueryTime / ch.totalQueryTime;
      if (speedup > 1.2) {
        console.log(`   • ClickHouse is ${speedup.toFixed(1)}x faster than PostgreSQL (indexed)`);
      } else if (speedup < 0.8) {
        console.log(`   • PostgreSQL (indexed) is ${(1/speedup).toFixed(1)}x faster than ClickHouse`);
      } else {
        console.log(`   • ClickHouse and PostgreSQL (indexed) have similar performance`);
      }
    }
    
    if (pgIndexed && pgNoIndex) {
      const indexBenefit = pgNoIndex.totalQueryTime / pgIndexed.totalQueryTime;
      console.log(`   • PostgreSQL indexes provide ${indexBenefit.toFixed(1)}x speedup`);
    }
    
    // Find fastest for each query
    for (let i = 0; i < 4; i++) {
      const times = results.map(r => ({ db: r.configuration.database + (r.configuration.withIndex ? ' (indexed)' : ''), time: r.queryResults[i]?.duration || 0 }));
      const fastest = times.reduce((min, curr) => curr.time < min.time ? curr : min);
      const queryName = ['Q1', 'Q2', 'Q3', 'Q4'][i];
      console.log(`   • ${queryName} fastest: ${fastest.db} (${fastest.time.toFixed(1)}ms)`);
    }
  }

  private static printOverallSummary(results: TestResults[]): void {
    const ch = results.filter(r => r.configuration.database === 'clickhouse');
    const pgIndexed = results.filter(r => r.configuration.database === 'postgresql' && r.configuration.withIndex);
    const pgNoIndex = results.filter(r => r.configuration.database === 'postgresql' && !r.configuration.withIndex);
    
    console.log('🏆 Winner by Category:');
    console.log(`   • Fastest overall queries: ${this.getFastestDatabase(results)}`);
    console.log(`   • Most consistent performance: ${this.getMostConsistent(results)}`);
    console.log(`   • Best for large datasets: ${this.getBestForLargeData(results)}`);
    console.log(`   • Index effectiveness: ${this.getIndexEffectiveness(results)}`);
  }

  private static getFastestDatabase(results: TestResults[]): string {
    const avgTimes = this.getAverageQueryTimes(results);
    const fastest = Object.entries(avgTimes).reduce((min, [db, time]) => time < min.time ? { db, time } : min, { db: '', time: Infinity });
    return fastest.db;
  }

  private static getMostConsistent(results: TestResults[]): string {
    const consistency = this.getConsistencyScores(results);
    const mostConsistent = Object.entries(consistency).reduce((min, [db, score]) => score < min.score ? { db, score } : min, { db: '', score: Infinity });
    return mostConsistent.db;
  }

  private static getBestForLargeData(results: TestResults[]): string {
    const largeResults = results.filter(r => r.configuration.rowCount >= 1000000);
    return this.getFastestDatabase(largeResults);
  }

  private static getIndexEffectiveness(results: TestResults[]): string {
    const pgResults = results.filter(r => r.configuration.database === 'postgresql');
    const indexed = pgResults.filter(r => r.configuration.withIndex);
    const noIndex = pgResults.filter(r => !r.configuration.withIndex);
    
    if (indexed.length === 0 || noIndex.length === 0) return 'N/A';
    
    const indexedAvg = indexed.reduce((sum, r) => sum + r.totalQueryTime, 0) / indexed.length;
    const noIndexAvg = noIndex.reduce((sum, r) => sum + r.totalQueryTime, 0) / noIndex.length;
    
    const improvement = noIndexAvg / indexedAvg;
    return `${improvement.toFixed(1)}x improvement`;
  }

  private static getAverageQueryTimes(results: TestResults[]): Record<string, number> {
    const groups: Record<string, number[]> = {};
    
    for (const result of results) {
      const key = result.configuration.database + (result.configuration.withIndex ? ' (indexed)' : '');
      if (!groups[key]) groups[key] = [];
      groups[key].push(result.totalQueryTime);
    }
    
    const averages: Record<string, number> = {};
    for (const [key, times] of Object.entries(groups)) {
      averages[key] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }
    
    return averages;
  }

  private static getConsistencyScores(results: TestResults[]): Record<string, number> {
    const groups: Record<string, number[]> = {};
    
    for (const result of results) {
      const key = result.configuration.database + (result.configuration.withIndex ? ' (indexed)' : '');
      if (!groups[key]) groups[key] = [];
      
      // Calculate coefficient of variation for each result's query times
      const queryTimes = result.queryResults.map(q => q.duration);
      const mean = queryTimes.reduce((sum, t) => sum + t, 0) / queryTimes.length;
      const variance = queryTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / queryTimes.length;
      const cv = Math.sqrt(variance) / mean;
      
      groups[key].push(cv);
    }
    
    const consistency: Record<string, number> = {};
    for (const [key, cvs] of Object.entries(groups)) {
      consistency[key] = cvs.reduce((sum, cv) => sum + cv, 0) / cvs.length;
    }
    
    return consistency;
  }

  private static printQueryStatistics(results: TestResults[]): void {
    console.log('\n📈 Query Statistics (ms):');
    
    for (const result of results) {
      if (!result.queryStats) continue;
      
      const config = result.configuration;
      const dbName = config.database === 'clickhouse' ? 'ClickHouse' : 'PostgreSQL';
      const indexStatus = config.withIndex ? '(indexed)' : '(no index)';
      
      console.log(`\n${dbName} ${indexStatus}${result.timedOut ? ' ⚠️ TIMED OUT' : ''}:`);
      if (result.timedOut) {
        console.log(`  Completed: ${result.completedIterations}/${result.iterations} iterations`);
      }
      
      const queryNames = ['Q1', 'Q2', 'Q3', 'Q4'];
      for (let i = 0; i < queryNames.length; i++) {
        const stats = result.queryStats;
        console.log(`  ${queryNames[i]}: median=${stats.median[i].toFixed(1)} mean=${stats.mean[i].toFixed(1)} ±${stats.stdDev[i].toFixed(1)} range=[${stats.min[i].toFixed(1)}-${stats.max[i].toFixed(1)}]`);
      }
    }
  }

  private static printTable(data: any[][]): void {
    const columnWidths = data[0].map((_, colIndex) => 
      Math.max(...data.map(row => String(row[colIndex]).length))
    );

    const printRow = (row: any[], separator = ' ') => {
      const formattedRow = row.map((cell, index) => 
        String(cell).padEnd(columnWidths[index])
      ).join(separator + '|' + separator);
      console.log('|' + separator + formattedRow + separator + '|');
    };

    // Print header
    const horizontalLine = '+' + columnWidths.map(width => 
      '-'.repeat(width + 2)
    ).join('+') + '+';
    
    console.log(horizontalLine);
    printRow(data[0]);
    console.log(horizontalLine);
    
    // Print data rows
    for (let i = 1; i < data.length; i++) {
      printRow(data[i]);
    }
    console.log(horizontalLine);
  }

  private static printDetailedResult(result: TestResults): void {
    const config = result.configuration;
    console.log(`\n${config.database.toUpperCase()} - ${config.rowCount.toLocaleString()} rows ${config.withIndex ? '(indexed)' : '(no index)'}`);
    console.log('-'.repeat(50));
    console.log(`Setup time: ${this.formatDuration(result.setupTime)}`);
    
    for (const queryResult of result.queryResults) {
      console.log(`${queryResult.name}: ${this.formatDuration(queryResult.duration)} (${queryResult.rows} rows)`);
    }
    
    console.log(`Total query time: ${this.formatDuration(result.totalQueryTime)}`);
    console.log(`Total test time: ${this.formatDuration(result.totalTime)}`);
  }

  static saveToFile(results: TestResults[], filename?: string): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Generate timestamped filename if not provided
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
      filename = `test-results_${timestamp}.json`;
    }

    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to: ${filepath}`);
  }

  static generateCSV(results: TestResults[]): string {
    const headers = [
      'Database',
      'Rows',
      'Index',
      'Q1_Show_table_ms',
      'Q2_Select_limit_ms',
      'Q3_Hourly_count_ms',
      'Q4_Average_calculation_ms',
      'Total_time_ms',
      'Conversation_time_ms',
      'Session_time_ms',
      'Setup_time_ms'
    ];

    const csvRows = results.map(result => {
      const config = result.configuration;
      const totalTime = result.totalTime;
      const conversationTime = totalTime * 5;
      const sessionTime = totalTime * 3;
      
      return [
        config.database,
        config.rowCount,
        config.withIndex ? 'yes' : 'no',
        result.queryResults[0]?.duration.toFixed(2) || '0',
        result.queryResults[1]?.duration.toFixed(2) || '0',
        result.queryResults[2]?.duration.toFixed(2) || '0',
        result.queryResults[3]?.duration.toFixed(2) || '0',
        totalTime.toFixed(2),
        conversationTime.toFixed(2),
        sessionTime.toFixed(2),
        result.setupTime.toFixed(2)
      ];
    });

    return [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
  }

  static generateQueryOnlyCSV(results: TestResults[]): string {
    const headers = [
      'Database',
      'Rows',
      'Index',
      'Iterations',
      'Completed_Iterations',
      'Timed_Out',
      'Q1_Mean_ms',
      'Q1_Median_ms',
      'Q1_StdDev_ms',
      'Q1_Min_ms',
      'Q1_Max_ms',
      'Q2_Mean_ms',
      'Q2_Median_ms',
      'Q2_StdDev_ms',
      'Q2_Min_ms',
      'Q2_Max_ms',
      'Q3_Mean_ms',
      'Q3_Median_ms',
      'Q3_StdDev_ms',
      'Q3_Min_ms',
      'Q3_Max_ms',
      'Q4_Mean_ms',
      'Q4_Median_ms',
      'Q4_StdDev_ms',
      'Q4_Min_ms',
      'Q4_Max_ms',
      'Total_Mean_ms',
      'Total_Median_ms',
      'Total_StdDev_ms',
      'Total_Min_ms',
      'Total_Max_ms',
      'Setup_Time_ms'
    ];

    const csvRows = results.map(result => {
      const config = result.configuration;
      const stats = result.queryStats;
      
      if (!stats) {
        // Fallback for non-query-only tests
        return [
          config.database,
          config.rowCount,
          config.withIndex ? 'yes' : 'no',
          '1',
          '1',
          'false',
          result.queryResults[0]?.duration.toFixed(2) || '0',
          result.queryResults[0]?.duration.toFixed(2) || '0',
          '0',
          result.queryResults[0]?.duration.toFixed(2) || '0',
          result.queryResults[0]?.duration.toFixed(2) || '0',
          result.queryResults[1]?.duration.toFixed(2) || '0',
          result.queryResults[1]?.duration.toFixed(2) || '0',
          '0',
          result.queryResults[1]?.duration.toFixed(2) || '0',
          result.queryResults[1]?.duration.toFixed(2) || '0',
          result.queryResults[2]?.duration.toFixed(2) || '0',
          result.queryResults[2]?.duration.toFixed(2) || '0',
          '0',
          result.queryResults[2]?.duration.toFixed(2) || '0',
          result.queryResults[2]?.duration.toFixed(2) || '0',
          result.queryResults[3]?.duration.toFixed(2) || '0',
          result.queryResults[3]?.duration.toFixed(2) || '0',
          '0',
          result.queryResults[3]?.duration.toFixed(2) || '0',
          result.queryResults[3]?.duration.toFixed(2) || '0',
          result.totalQueryTime.toFixed(2),
          result.totalQueryTime.toFixed(2),
          '0',
          result.totalQueryTime.toFixed(2),
          result.totalQueryTime.toFixed(2),
          result.setupTime.toFixed(2)
        ];
      }
      
      // Calculate total query time statistics
      const totalMean = stats.mean.reduce((sum, mean) => sum + mean, 0);
      const totalMedian = stats.median.reduce((sum, median) => sum + median, 0);
      const totalStdDev = Math.sqrt(stats.stdDev.reduce((sum, stdDev) => sum + stdDev * stdDev, 0));
      const totalMin = stats.min.reduce((sum, min) => sum + min, 0);
      const totalMax = stats.max.reduce((sum, max) => sum + max, 0);
      
      return [
        config.database,
        config.rowCount,
        config.withIndex ? 'yes' : 'no',
        result.iterations?.toString() || '1',
        result.completedIterations?.toString() || '1',
        result.timedOut ? 'true' : 'false',
        stats.mean[0].toFixed(2),
        stats.median[0].toFixed(2),
        stats.stdDev[0].toFixed(2),
        stats.min[0].toFixed(2),
        stats.max[0].toFixed(2),
        stats.mean[1].toFixed(2),
        stats.median[1].toFixed(2),
        stats.stdDev[1].toFixed(2),
        stats.min[1].toFixed(2),
        stats.max[1].toFixed(2),
        stats.mean[2].toFixed(2),
        stats.median[2].toFixed(2),
        stats.stdDev[2].toFixed(2),
        stats.min[2].toFixed(2),
        stats.max[2].toFixed(2),
        stats.mean[3].toFixed(2),
        stats.median[3].toFixed(2),
        stats.stdDev[3].toFixed(2),
        stats.min[3].toFixed(2),
        stats.max[3].toFixed(2),
        totalMean.toFixed(2),
        totalMedian.toFixed(2),
        totalStdDev.toFixed(2),
        totalMin.toFixed(2),
        totalMax.toFixed(2),
        result.setupTime.toFixed(2)
      ];
    });

    return [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
  }

  static saveCSV(results: TestResults[], filename?: string): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Generate timestamped filename if not provided
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);
      const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
      const prefix = isQueryOnly ? 'query-test' : 'test-results';
      filename = `${prefix}_${timestamp}.csv`;
    }

    // Check if this is a query-only test
    const isQueryOnly = results.some(r => r.iterations && r.iterations > 1);
    const csv = isQueryOnly ? this.generateQueryOnlyCSV(results) : this.generateCSV(results);
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, csv);
    console.log(`CSV results saved to: ${filepath}`);
  }
}