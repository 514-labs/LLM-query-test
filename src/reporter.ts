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
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE PERFORMANCE TEST RESULTS');
    console.log('='.repeat(80));

    // Create comparison table
    const tableData = this.createComparisonTable(results);
    this.printTable(tableData);

    // Print detailed results
    console.log('\n' + '-'.repeat(80));
    console.log('DETAILED RESULTS');
    console.log('-'.repeat(80));

    for (const result of results) {
      this.printDetailedResult(result);
    }
  }

  private static createComparisonTable(results: TestResults[]): any[][] {
    const headers = [
      'Database',
      'Rows',
      'Index',
      'Q1 Show table',
      'Q2 Select * limit 10',
      'Q3 Hourly count',
      'Q4 Average calculation',
      'Total Time',
      'Conversation (x5)',
      'Session (x3)',
      'Setup Time'
    ];

    const rows = results.map(result => {
      const config = result.configuration;
      const dbName = config.database === 'clickhouse' ? 'CH' : 'PG';
      const rowCount = config.rowCount >= 1000000 
        ? `${(config.rowCount / 1000000).toFixed(0)}m`
        : `${(config.rowCount / 1000).toFixed(0)}k`;
      const indexStatus = config.withIndex ? 'yes' : 'no';
      
      // Calculate new columns
      const totalTime = result.totalTime;
      const conversationTime = totalTime * 5;
      const sessionTime = totalTime * 3;
      const setupTime = result.setupTime;
      
      return [
        dbName,
        rowCount,
        indexStatus,
        this.formatDuration(result.queryResults[0]?.duration || 0),
        this.formatDuration(result.queryResults[1]?.duration || 0),
        this.formatDuration(result.queryResults[2]?.duration || 0),
        this.formatDuration(result.queryResults[3]?.duration || 0),
        this.formatDuration(totalTime),
        this.formatDuration(conversationTime),
        this.formatDuration(sessionTime),
        this.formatDuration(setupTime)
      ];
    });

    return [headers, ...rows];
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
    console.log(`\n${config.database.toUpperCase()} - ${config.rowCount.toLocaleString()} rows ${config.withIndex ? '(with index)' : '(no index)'}`);
    console.log('-'.repeat(50));
    console.log(`Setup time: ${this.formatDuration(result.setupTime)}`);
    
    for (const queryResult of result.queryResults) {
      console.log(`${queryResult.name}: ${this.formatDuration(queryResult.duration)} (${queryResult.rows} rows)`);
    }
    
    console.log(`Total query time: ${this.formatDuration(result.totalQueryTime)}`);
    console.log(`Total test time: ${this.formatDuration(result.totalTime)}`);
  }

  static saveToFile(results: TestResults[], filename: string = 'test-results.json'): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
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

  static saveCSV(results: TestResults[], filename: string = 'test-results.csv'): void {
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const csv = this.generateCSV(results);
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, csv);
    console.log(`CSV results saved to: ${filepath}`);
  }
}